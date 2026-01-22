// app/api/workshop/translate-line/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
import { buildTranslatorPersonality } from "@/lib/ai/translatorPersonality";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string().min(1),
  fullPoem: z.string(),
  stanzaIndex: z.number().int().optional(),
  prevLine: z.string().optional(),
  nextLine: z.string().optional(),
});

export async function POST(req: Request) {
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
      `workshop:translate-line:${threadId}`,
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
    const poemStanzas = state.poem_stanzas as
      | { stanzas: Array<{ startLineIndex: number }> }
      | undefined;

    const rawPoem = (thread.raw_poem ?? state.raw_poem ?? fullPoem ?? "") as string;

    if (!rawPoem) {
      console.warn(
        `[translate-line] Full poem not available for thread ${threadId}, line ${lineIndex}`
      );
    }

    let actualStanzaIndex = stanzaIndex;
    if (actualStanzaIndex === undefined && poemStanzas?.stanzas) {
      for (let i = 0; i < poemStanzas.stanzas.length; i++) {
        const stanza = poemStanzas.stanzas[i];
        const nextStanza = poemStanzas.stanzas[i + 1];
        const lineStart = stanza.startLineIndex;
        const lineEnd = nextStanza
          ? nextStanza.startLineIndex
          : Number.MAX_SAFE_INTEGER;
        if (lineIndex >= lineStart && lineIndex < lineEnd) {
          actualStanzaIndex = i;
          break;
        }
      }
    }

    if (!lineText.trim()) {
      const emptyResponse: LineTranslationResponse = {
        lineOriginal: lineText,
        translations: [
          {
            variant: 1,
            fullText: "",
            words: [],
            metadata: {
              literalness: 1.0,
              characterCount: 0,
            },
          },
          {
            variant: 2,
            fullText: "",
            words: [],
            metadata: {
              literalness: 1.0,
              characterCount: 0,
            },
          },
          {
            variant: 3,
            fullText: "",
            words: [],
            metadata: {
              literalness: 1.0,
              characterCount: 0,
            },
          },
        ],
        modelUsed: guideAnswers.translationModel ?? TRANSLATOR_MODEL,
      };
      return NextResponse.json(emptyResponse);
    }

    const targetLang = guideAnswers.targetLanguage?.lang?.trim();
    const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
    const targetLanguage = targetLang
      ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
      : "the target language";

    if (process.env.NODE_ENV !== "production") {
      const personality = buildTranslatorPersonality(guideAnswers);
      console.log("[translate-line] Translator Personality:", {
        domain: personality.domain,
        priority: personality.priority,
        literalness: personality.literalness,
        sacred_terms: personality.sacred_terms,
        forbidden_terms: personality.forbidden_terms,
      });
    }

    const model = guideAnswers.translationModel ?? TRANSLATOR_MODEL;

    const result = await translateLineInternal({
      threadId,
      lineIndex,
      lineText,
      fullPoem: rawPoem,
      stanzaIndex: actualStanzaIndex,
      prevLine,
      nextLine,
      guideAnswers,
      sourceLanguage: poemAnalysis.language || "the source language",
      targetLanguage,
      modelOverride: model,
      audit: {
        createdBy: user.id,
        projectId: thread.project_id ?? null,
        stage: "workshop-options",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[translate-line] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
