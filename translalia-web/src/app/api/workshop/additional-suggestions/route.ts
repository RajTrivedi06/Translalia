import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai } from "@/lib/ai/openai";
import { buildAdditionalWordSuggestionsPrompt } from "@/lib/ai/workshopPrompts";

const SUGGESTION_MODEL = "gpt-4o-mini";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  currentLine: z.string().min(1),
  previousLine: z.string().optional().nullable(),
  nextLine: z.string().optional().nullable(),
  fullPoem: z.string().min(1),
  poemTheme: z.string().optional(),
  userGuidance: z.string().optional().nullable(),
});

const SuggestionSchema = z.object({
  word: z.string().min(1),
  reasoning: z.string().min(1).optional().default(""),
  register: z.string().min(1).optional().default("neutral"),
  literalness: z.number().min(0).max(1).optional().default(0.5),
});

const ResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(1),
});

function sanitizeSuggestedWord(raw: string): string {
  let w = raw.trim();
  // Remove wrapping quotes if the model included them inside the string
  w = w.replace(/^"+/, "").replace(/"+$/, "");
  // Remove common trailing punctuation artifacts (e.g. 'word,' or 'word",')
  w = w.replace(/["'’”]+$/, "");
  w = w.replace(/[,，]+$/, "");
  return w.trim();
}

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

    const parsed = validation.data;

    // Verify thread ownership and fetch guide answers
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state")
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
    const guideAnswers = (state.guide_answers as Record<string, unknown>) || {};
    const poemAnalysis = (state.poem_analysis as Record<string, unknown>) || {};

    const targetLangObj = guideAnswers.targetLanguage as
      | { lang?: unknown; name?: unknown }
      | undefined;
    const targetLanguageRaw = targetLangObj?.lang ?? targetLangObj?.name;
    const targetLanguage =
      typeof targetLanguageRaw === "string" &&
      targetLanguageRaw.trim().length > 0
        ? targetLanguageRaw.trim()
        : "the target language";
    const sourceLanguage =
      (poemAnalysis.language as string) || "the source language";

    const { system, user: userPrompt } = buildAdditionalWordSuggestionsPrompt({
      currentLine: parsed.currentLine,
      lineIndex: parsed.lineIndex,
      previousLine: parsed.previousLine,
      nextLine: parsed.nextLine,
      fullPoem: parsed.fullPoem,
      poemTheme: parsed.poemTheme,
      guideAnswers,
      userGuidance: parsed.userGuidance,
      targetLanguage,
      sourceLanguage,
    });

    const completion = await openai.chat.completions.create({
      model: SUGGESTION_MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error("[additional-suggestions] Parse error:", e);
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 500 }
      );
    }

    const validated = ResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error(
        "[additional-suggestions] Invalid response:",
        validated.error
      );
      return NextResponse.json(
        { error: "Invalid AI response structure" },
        { status: 500 }
      );
    }

    // Clamp to 7-9 suggestions (prefer 9 max)
    const normalized = validated.data.suggestions
      .map((s) => ({
        word: sanitizeSuggestedWord(s.word),
        reasoning: (s.reasoning || "").trim(),
        register: (s.register || "neutral").trim(),
        literalness:
          typeof s.literalness === "number" && Number.isFinite(s.literalness)
            ? Math.max(0, Math.min(1, s.literalness))
            : 0.5,
      }))
      .filter((s) => s.word.length > 0)
      .slice(0, 9);

    return NextResponse.json({
      ok: true,
      suggestions: normalized,
      lineIndex: parsed.lineIndex,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[additional-suggestions] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions", details: e?.message || "" },
      { status: 500 }
    );
  }
}
