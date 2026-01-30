import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkRateLimit } from "@/lib/ratelimit/redis";
import { tokenize } from "@/lib/ai/textNormalize";
import {
  TokenSuggestionsRequestSchema,
  type TokenSuggestionsRequest,
} from "@/lib/ai/suggestions/suggestionsSchemas";
import { generateTokenSuggestions } from "@/lib/ai/suggestions/suggestionsService";
import { createDiagnostics } from "@/lib/diagnostics";

const CACHE_TTL_SECONDS = 3600;
const SUGGESTION_RATE_LIMIT = parseInt(
  process.env.SUGGESTIONS_RATE_LIMIT || "200"
);

function summarizeText(value?: string | null, max = 140): string {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function isPlaceholderTargetLanguage(value?: string | null): boolean {
  if (!value) return true;
  const normalized = value.toLowerCase().trim();
  return normalized === "the target language" || normalized === "target language";
}

function getGuideTargetLanguage(guideAnswers: Record<string, unknown>): string | null {
  const guide = guideAnswers as {
    targetLanguage?: { lang?: string | null; variety?: string | null };
    target_language?: string | null;
  };
  const lang =
    typeof guide.targetLanguage?.lang === "string"
      ? guide.targetLanguage.lang.trim()
      : "";
  const variety =
    typeof guide.targetLanguage?.variety === "string"
      ? guide.targetLanguage.variety.trim()
      : "";
  if (lang) {
    return variety ? `${lang} (${variety})` : lang;
  }
  const legacy = typeof guide.target_language === "string" ? guide.target_language.trim() : "";
  return legacy || null;
}

function hashPayload(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

/**
 * Check if there are any tokens in the source or target text.
 * Used for basic validation that the request has some context.
 */
function hasAnyTokens(payload: TokenSuggestionsRequest): boolean {
  const allTexts = [
    payload.targetLineDraft ?? "",
    payload.variantFullTexts?.A ?? "",
    payload.variantFullTexts?.B ?? "",
    payload.variantFullTexts?.C ?? "",
    payload.sourceLine ?? "",
    payload.currentLine ?? "",
  ].filter((t) => t.trim().length > 0);
  return allTexts.some((text) => tokenize(text).length > 0);
}

/**
 * Check if there are target-language anchors (draft or variants).
 * The prompt builds anchors only from targetLineDraft and variantFullTexts,
 * so we need at least one of these to generate meaningful suggestions.
 */
function hasTargetLanguageAnchors(payload: TokenSuggestionsRequest): boolean {
  const targetAnchors = [
    payload.targetLineDraft ?? "",
    payload.variantFullTexts?.A ?? "",
    payload.variantFullTexts?.B ?? "",
    payload.variantFullTexts?.C ?? "",
  ].filter((t) => t.trim().length > 0);
  return targetAnchors.some((text) => tokenize(text).length > 0);
}

type GuideAnswersState = {
  translationModel?: string | null;
  translationMethod?: string | null;
  translationIntent?: string | null;
  translationZone?: string | null;
  sourceLanguageVariety?: string | null;
};

export async function POST(req: Request) {
  const diag = createDiagnostics("token-suggestions");

  // Auth check
  diag.mark("auth-start");
  const { user, response } = await requireUser();
  diag.mark("auth-end");
  if (!user) {
    diag.mark("auth-failed");
    diag.summary();
    return response;
  }

  try {
    // Parse and validate request body
    diag.mark("parse-body-start");
    const body = await req.json();
    const validation = TokenSuggestionsRequestSchema.safeParse(body);
    diag.mark("parse-body-end");

    if (!validation.success) {
      diag.mark("validation-failed");
      diag.summary();
      return NextResponse.json(
        { ok: false, reason: "invalid_request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const parsed = validation.data;
    if (!parsed.targetLanguage?.trim()) {
      diag.mark("target-language-missing");
      diag.summary();
      return NextResponse.json(
        { ok: false, reason: "target_language_missing" },
        { status: 400 }
      );
    }

    // Check for basic request validity (any tokens at all)
    if (!hasAnyTokens(parsed)) {
      diag.mark("anchors-missing-no-tokens");
      diag.summary();
      return NextResponse.json({
        ok: false,
        reason: "anchors_missing",
      });
    }

    // Check for target-language anchors specifically
    // The prompt needs draft or variant text to generate meaningful suggestions
    if (!hasTargetLanguageAnchors(parsed)) {
      diag.mark("anchors-missing-no-target");
      diag.summary();
      return NextResponse.json({
        ok: false,
        reason: "anchors_missing",
        message: "Add a draft or choose a variant before requesting word suggestions.",
      });
    }

    // Rate limit (daily)
    diag.mark("rate-limit-start");
    const today = new Date().toISOString().split("T")[0];
    const rateLimitKey = `suggestions:token:${user.id}:${today}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      SUGGESTION_RATE_LIMIT,
      86400
    );
    diag.mark("rate-limit-end");

    if (!rateLimit.success) {
      diag.mark("rate-limited");
      diag.summary();
      return NextResponse.json(
        {
          ok: false,
          reason: "rate_limited",
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.reset,
        },
        { status: 429 }
      );
    }

    // Verify thread ownership and fetch guide answers
    diag.mark("db-query-start");
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select(
        "id, state, translation_model, translation_method, translation_intent, translation_zone, source_language_variety"
      )
      .eq("id", parsed.threadId)
      .eq("created_by", user.id)
      .single();
    diag.mark("db-query-end");

    if (threadError || !thread) {
      diag.mark("thread-not-found");
      diag.summary();
      return NextResponse.json(
        { ok: false, reason: "thread_not_found" },
        { status: 404 }
      );
    }

    const state = (thread.state as Record<string, unknown>) || {};
    const guideAnswersState =
      (state as { guide_answers?: GuideAnswersState }).guide_answers ?? {};
    const guideAnswers: Record<string, unknown> = {
      translationModel:
        thread.translation_model ?? guideAnswersState.translationModel ?? null,
      translationMethod:
        thread.translation_method ??
        guideAnswersState.translationMethod ??
        "method-2",
      translationIntent:
        thread.translation_intent ?? guideAnswersState.translationIntent ?? null,
      translationZone:
        thread.translation_zone ?? guideAnswersState.translationZone ?? null,
      sourceLanguageVariety:
        thread.source_language_variety ??
        guideAnswersState.sourceLanguageVariety ??
        null,
      ...(guideAnswersState as Record<string, unknown>),
    };

    const poemAnalysis = (state.poem_analysis as Record<string, unknown>) || {};
    const sourceLanguage =
      (poemAnalysis.language as string) || "the source language";
    const resolvedTargetLanguage = isPlaceholderTargetLanguage(parsed.targetLanguage)
      ? getGuideTargetLanguage(guideAnswers) || "English"
      : parsed.targetLanguage.trim();

    if (process.env.DEBUG_SUGGESTIONS === "1") {
      console.log("[token-suggestions] Debug request:", {
        threadId: parsed.threadId,
        lineIndex: parsed.lineIndex,
        targetLanguage: parsed.targetLanguage,
        resolvedTargetLanguage,
        sourceLanguage,
        anchors: {
          draft: summarizeText(parsed.targetLineDraft),
          variantA: summarizeText(parsed.variantFullTexts?.A),
          variantB: summarizeText(parsed.variantFullTexts?.B),
          variantC: summarizeText(parsed.variantFullTexts?.C),
        },
        focus: {
          word: parsed.focus.word,
          originalWord: parsed.focus.originalWord,
          sourceType: parsed.focus.sourceType,
          position: parsed.focus.position ?? null,
          variantId: parsed.focus.variantId ?? null,
        },
      });
    }

    const cacheKey = `suggestions:token:${parsed.threadId}:${
      parsed.lineIndex
    }:${resolvedTargetLanguage}:${hashPayload({
      focus: parsed.focus,
      targetLineDraft: parsed.targetLineDraft,
      variantFullTexts: parsed.variantFullTexts,
      selectedVariant: parsed.selectedVariant,
      userGuidance: parsed.userGuidance,
      extraHints: parsed.extraHints,
      suggestionRangeMode: parsed.suggestionRangeMode,
      poemTheme: parsed.poemTheme,
    })}`;

    // Check cache
    diag.mark("cache-check-start");
    const cached = await cacheGet<{ suggestions: unknown[] }>(cacheKey);
    diag.mark("cache-check-end");

    if (cached?.suggestions) {
      diag.mark("cache-hit");
      diag.summary();
      return NextResponse.json({
        ok: true,
        suggestions: cached.suggestions,
        cached: true,
        lineIndex: parsed.lineIndex,
      });
    }
    diag.mark("cache-miss");

    // Generate suggestions via OpenAI
    diag.mark("openai-start");
    const result = await generateTokenSuggestions({
      request: parsed,
      guideAnswers,
      targetLanguage: resolvedTargetLanguage,
      sourceLanguage,
    });
    diag.mark("openai-end");

    if (!result.ok || !result.suggestions) {
      diag.mark("generation-failed");
      diag.error("generation", result.reason || "unknown");
      diag.summary();
      return NextResponse.json({
        ok: false,
        reason: result.reason || "generation_failed",
      });
    }

    // Cache the result
    diag.mark("cache-set-start");
    await cacheSet(cacheKey, { suggestions: result.suggestions }, CACHE_TTL_SECONDS);
    diag.mark("cache-set-end");

    diag.mark("success");
    diag.summary();
    return NextResponse.json({
      ok: true,
      suggestions: result.suggestions,
      repaired: result.repaired ?? false,
      lineIndex: parsed.lineIndex,
    });
  } catch (error) {
    diag.error("unhandled", error);

    // Log full error details for Vercel debugging
    console.error("[token-suggestions] FULL ERROR:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      // Check if it's an OpenAI error
      status: (error as Record<string, unknown>)?.status,
      code: (error as Record<string, unknown>)?.code,
      type: (error as Record<string, unknown>)?.type,
    });

    diag.summary();
    return NextResponse.json(
      {
        ok: false,
        reason: "internal_error",
        // Include error message in dev/preview for debugging
        ...(process.env.VERCEL_ENV !== "production" && {
          debug: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 }
    );
  }
}
