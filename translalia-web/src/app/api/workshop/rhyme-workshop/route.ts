/**
 * API endpoint for Rhyme & Sound Workshop
 *
 * Provides instructive suggestions for rhyme, sound patterns, and rhythm
 * to help students improve the sonic qualities of their translations.
 *
 * POST /api/workshop/rhyme-workshop
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkRateLimit } from "@/lib/ratelimit/redis";
import { responsesCall } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import {
  RhymeWorkshopRequestSchema,
  RhymeWorkshopResponseSchema,
  type RhymeWorkshopResponse,
} from "@/types/rhymeWorkshop";
import {
  RHYME_WORKSHOP_SYSTEM_PROMPT,
  buildRhymeWorkshopUserPrompt,
  generateFallbackRhymeWorkshopResponse,
  type RhymeWorkshopPromptParams,
} from "@/lib/ai/rhymeWorkshopPrompts";
import {
  fetchRhymes,
  fetchRhymesForLineEndings,
  getRhymeSound,
  findRhymePairs,
} from "@/lib/rhyme/rhymeService";
import { analyzeLineSound, extractLineEnding } from "@/lib/rhyme/soundAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 1800; // 30 minutes
const RATE_LIMIT_PER_DAY = 100;

function hashPayload(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

function err(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });
}

function ok<T>(data: T & { ok: true }, status = 200) {
  return NextResponse.json<T & { ok: true }>(data, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: unknown[]) =>
    console.log("[/api/workshop/rhyme-workshop]", requestId, ...a);

  try {
    // 1) Auth check
    const { user, response } = await requireUser();
    if (!user) return response;

    // 2) Parse & validate body
    let body: ReturnType<typeof RhymeWorkshopRequestSchema.parse>;
    try {
      body = RhymeWorkshopRequestSchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        lineIndex: body.lineIndex,
        sourceLineLen: body.sourceLine?.length,
        translationLen: body.currentTranslation?.length,
      });
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : String(e);
      log("bad body", errorMessage);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: errorMessage,
      });
    }

    // 3) Rate limit
    const today = new Date().toISOString().split("T")[0];
    const rateLimitKey = `rhyme-workshop:${user.id}:${today}`;
    const rateLimit = await checkRateLimit(rateLimitKey, RATE_LIMIT_PER_DAY, 86400);

    if (!rateLimit.success) {
      log("rate_limited", { limit: rateLimit.limit, remaining: rateLimit.remaining });
      return err(429, "RATE_LIMITED", "Daily limit exceeded", {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.reset,
      });
    }

    // 4) Verify thread ownership
    const supabase = await supabaseServer();
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id, created_by")
      .eq("id", body.threadId)
      .eq("created_by", user.id)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found or unauthorized");
    }

    // 5) Check cache
    const cacheKey = `rhyme-workshop:${body.threadId}:${body.lineIndex}:${hashPayload({
      sourceLine: body.sourceLine,
      currentTranslation: body.currentTranslation,
      sourceRhymeScheme: body.sourceRhymeScheme,
    })}`;

    const cached = await cacheGet<RhymeWorkshopResponse>(cacheKey);
    if (cached) {
      log("cache_hit");
      return ok({
        ok: true as const,
        ...cached,
        cached: true,
        lineIndex: body.lineIndex,
      });
    }

    // 6) Fetch rhyme dictionary data (for English target language only)
    let rhymeDictionaryData = undefined;
    if (body.targetLanguage.toLowerCase().includes("english")) {
      try {
        // Get rhymes for the current translation's line ending
        const lineEnding = extractLineEnding(body.currentTranslation);
        const lineEndingRhymes = lineEnding ? await fetchRhymes(lineEnding) : null;

        // Also get rhymes for lines that should rhyme with this one
        const fullTranslationLines = body.fullTranslation.split("\n").filter((l) => l.trim());
        const allLineRhymes = await fetchRhymesForLineEndings(fullTranslationLines);

        rhymeDictionaryData = {
          lineEndingRhymes: lineEndingRhymes
            ? [lineEndingRhymes, ...allLineRhymes.lineEndingRhymes]
            : allLineRhymes.lineEndingRhymes,
        };

        log("rhyme_dictionary_fetched", {
          lineEnding,
          perfectRhymeCount: lineEndingRhymes?.perfectRhymes.length ?? 0,
        });
      } catch (e) {
        log("rhyme_dictionary_error", e);
        // Continue without rhyme dictionary data
      }
    }

    // 7) Analyze source and current line sounds
    const sourceLineAnalysis = analyzeLineSound(body.sourceLine);
    const currentLineAnalysis = analyzeLineSound(body.currentTranslation);

    log("sound_analysis", {
      sourceSyllables: sourceLineAnalysis.syllableCount,
      currentSyllables: currentLineAnalysis.syllableCount,
      sourceAlliteration: sourceLineAnalysis.alliteration.length,
      currentAlliteration: currentLineAnalysis.alliteration.length,
    });

    // 8) Determine which lines should rhyme with this one
    let rhymeTargetLines: number[] | undefined;
    if (body.sourceRhymeScheme) {
      const pairs = findRhymePairs(body.sourceRhymeScheme);
      rhymeTargetLines = pairs
        .filter((pair) => pair.includes(body.lineIndex))
        .flat()
        .filter((idx) => idx !== body.lineIndex);
    }

    // 9) Get context lines
    const sourceLines = body.fullSourcePoem.split("\n").filter((l) => l.trim());
    const translationLines = body.fullTranslation.split("\n").filter((l) => l.trim());

    const previousLine = body.lineIndex > 0 ? sourceLines[body.lineIndex - 1] : null;
    const nextLine =
      body.lineIndex < sourceLines.length - 1 ? sourceLines[body.lineIndex + 1] : null;
    const previousTranslation =
      body.lineIndex > 0 ? translationLines[body.lineIndex - 1] : null;
    const nextTranslation =
      body.lineIndex < translationLines.length - 1
        ? translationLines[body.lineIndex + 1]
        : null;

    // 10) Build prompt
    const promptParams: RhymeWorkshopPromptParams = {
      lineIndex: body.lineIndex,
      sourceLine: body.sourceLine,
      currentTranslation: body.currentTranslation,
      previousLine,
      nextLine,
      previousTranslation,
      nextTranslation,
      fullSourcePoem: body.fullSourcePoem,
      fullTranslation: body.fullTranslation,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      rhymeDictionaryData,
      sourceLineAnalysis,
      currentLineAnalysis,
      sourceRhymeScheme: body.sourceRhymeScheme,
      rhymeTargetLines,
    };

    const userPrompt = buildRhymeWorkshopUserPrompt(promptParams);

    // 11) Call LLM
    log("calling_llm");
    let llmResponse: unknown;
    try {
      llmResponse = await responsesCall({
        model: TRANSLATOR_MODEL,
        system: RHYME_WORKSHOP_SYSTEM_PROMPT,
        user: userPrompt,
        auditContext: {
          createdBy: user.id,
          threadId: body.threadId,
          stage: "workshop:rhyme-workshop",
          provider: "openai",
        },
      });
    } catch (llmError) {
      log("llm_error", llmError);
      // Return fallback response
      const fallback = generateFallbackRhymeWorkshopResponse(promptParams);
      return ok({
        ok: true as const,
        ...fallback,
        cached: false,
        lineIndex: body.lineIndex,
        fallback: true,
      });
    }

    // 12) Parse response
    let parsedResponse: RhymeWorkshopResponse | null = null;

    try {
      const responseText =
        typeof llmResponse === "string" ? llmResponse : JSON.stringify(llmResponse);

      // Try to extract JSON from response (might be wrapped in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonParsed = JSON.parse(jsonMatch[0]);
        const validated = RhymeWorkshopResponseSchema.safeParse(jsonParsed);

        if (validated.success) {
          parsedResponse = validated.data;
        } else {
          log("validation_error", validated.error.issues);
        }
      }
    } catch (parseError) {
      log("parse_error", parseError);
    }

    // 13) Fallback if parsing failed
    if (!parsedResponse) {
      log("using_fallback");
      const fallback = generateFallbackRhymeWorkshopResponse(promptParams);
      return ok({
        ok: true as const,
        ...fallback,
        cached: false,
        lineIndex: body.lineIndex,
        fallback: true,
      });
    }

    // 14) Cache and return
    await cacheSet(cacheKey, parsedResponse, CACHE_TTL_SECONDS);

    log("success", {
      ms: Date.now() - started,
      rhymeSuggestions: parsedResponse.rhymeWorkshop.length,
      soundSuggestions: parsedResponse.soundWorkshop.length,
      rhythmSuggestions: parsedResponse.rhythmWorkshop.length,
    });

    return ok({
      ok: true as const,
      ...parsedResponse,
      cached: false,
      lineIndex: body.lineIndex,
    });
  } catch (e: unknown) {
    console.error("[/api/workshop/rhyme-workshop] fatal", e);
    const errorMsg = e instanceof Error ? e.message : "Internal server error";
    return err(500, "INTERNAL", errorMsg);
  }
}
