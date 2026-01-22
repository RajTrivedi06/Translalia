// app/api/workshop/translate-line-with-recipes/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import type { GuideAnswers } from "@/store/guideSlice";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string().min(1),
  fullPoem: z.string(),
  stanzaIndex: z.number().int().optional(),
  prevLine: z.string().optional(),
  nextLine: z.string().optional(),
});

/**
 * POST /api/workshop/translate-line-with-recipes
 *
 * Thin wrapper around translateLineWithRecipesInternal for interactive line translation.
 * Handles authentication, rate limiting, and request validation, then delegates
 * to the shared Method 2 function.
 */
export async function POST(req: Request) {
  console.log("[HIT] translate-line-with-recipes");
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      threadId,
      lineIndex,
      lineText,
      fullPoem,
      stanzaIndex,
      prevLine,
      nextLine,
    } = validation.data;

    const rateCheck = await checkDailyLimit(
      user.id,
      `workshop:translate-line-recipes:${threadId}`,
      10 * 60
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          current: rateCheck.current,
          max: rateCheck.max,
        },
        { status: 429 }
      );
    }

    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, project_id, translation_model, translation_method, translation_intent, translation_zone, source_language_variety, raw_poem")
      .eq("id", threadId)
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
      (state as { guide_answers?: GuideAnswers }).guide_answers ?? {};
    const guideAnswers: GuideAnswers = {
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
      ...(guideAnswersState || {}),
    };
    const poemAnalysis = (state.poem_analysis as { language?: string }) || {};
    const rawPoem = (thread.raw_poem ?? state.raw_poem ?? fullPoem ?? "") as string;

    // Determine source and target languages
    const sourceLanguage = poemAnalysis.language || "the source language";
    const targetLang = guideAnswers.targetLanguage?.lang?.trim();
    const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
    const targetLanguage = targetLang
      ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
      : "the target language";

    // Call shared Method 2 function
    try {
      const result = await translateLineWithRecipesInternal({
        threadId,
        lineIndex,
        lineText,
        fullPoem: rawPoem,
        stanzaIndex,
        prevLine,
        nextLine,
        guideAnswers,
        sourceLanguage,
        targetLanguage,
        auditUserId: user.id,
        auditProjectId: thread.project_id ?? null,
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      // Handle retryable errors
      if (message.includes("RECIPE_GENERATION_CONTENTION")) {
        return NextResponse.json(
          {
            error: "Recipe generation in progress. Please retry.",
            retryable: true,
          },
          { status: 503 }
        );
      }

      // Handle other errors
      console.error("[translate-line-with-recipes] Translation error:", error);
      return NextResponse.json(
        { error: message || "Translation failed" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[translate-line-with-recipes] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
