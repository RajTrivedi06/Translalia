import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { tokenize } from "@/lib/ai/textNormalize";
import {
  LineSuggestionsRequestSchema,
  type LineSuggestionsRequest,
} from "@/lib/ai/suggestions/suggestionsSchemas";
import { generateLineSuggestions } from "@/lib/ai/suggestions/suggestionsService";

type GuideAnswersState = {
  translationModel?: string | null;
  translationMethod?: string | null;
  translationIntent?: string | null;
  translationZone?: string | null;
  sourceLanguageVariety?: string | null;
};

function hasAnchorTokens(payload: LineSuggestionsRequest): boolean {
  const anchors = [
    payload.targetLineDraft ?? "",
    payload.variantFullTexts?.A ?? "",
    payload.variantFullTexts?.B ?? "",
    payload.variantFullTexts?.C ?? "",
  ].filter((t) => t.trim().length > 0);
  return anchors.some((text) => tokenize(text).length > 0);
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const validation = LineSuggestionsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, reason: "invalid_request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const parsed = validation.data;
    if (!parsed.targetLanguage?.trim()) {
      return NextResponse.json(
        { ok: false, reason: "target_language_missing" },
        { status: 400 }
      );
    }

    if (!hasAnchorTokens(parsed)) {
      return NextResponse.json({
        ok: false,
        reason: "anchors_missing",
      });
    }

    // Verify thread ownership and fetch guide answers
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, translation_model, translation_method, translation_intent, translation_zone, source_language_variety")
      .eq("id", parsed.threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
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
      // Legacy fields from JSONB if needed
      ...(guideAnswersState as Record<string, unknown>),
    };
    const poemAnalysis = (state.poem_analysis as Record<string, unknown>) || {};

    const sourceLanguage =
      (poemAnalysis.language as string) || "the source language";

    const result = await generateLineSuggestions({
      request: parsed,
      guideAnswers,
      targetLanguage: parsed.targetLanguage,
      sourceLanguage,
    });

    if (!result.ok || !result.suggestions) {
      return NextResponse.json({
        ok: false,
        reason: result.reason || "generation_failed",
      });
    }

    return NextResponse.json({
      ok: true,
      suggestions: result.suggestions,
      repaired: result.repaired ?? false,
      lineIndex: parsed.lineIndex,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[additional-suggestions] Error:", error);
    return NextResponse.json(
      { ok: false, reason: "internal_error", details: e?.message || "" },
      { status: 500 }
    );
  }
}
