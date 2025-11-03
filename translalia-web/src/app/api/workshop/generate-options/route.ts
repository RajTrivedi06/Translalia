import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import {
  buildWordTranslationPrompt,
  buildWorkshopSystemPrompt,
} from "@/lib/ai/workshopPrompts";
import { GuideAnswers } from "@/store/guideSlice";
import { z } from "zod";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string(), // Allow empty strings for blank lines
});

const WordOptionSchema = z.object({
  original: z.string(),
  position: z.number(),
  options: z.array(z.string()).min(3).max(3),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "interjection", "neutral"]).optional(),
});

const ResponseSchema = z.object({
  lineIndex: z.number(),
  words: z.array(WordOptionSchema),
  modelUsed: z.string().optional(),
});

export type GenerateOptionsResponse = z.infer<typeof ResponseSchema>;

export async function POST(req: Request) {
  // Auth check
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    // Parse and validate request
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { threadId, lineIndex, lineText } = validation.data;

    // Rate limiting: 10 requests per minute per thread
    const rateCheck = await checkDailyLimit(
      user.id,
      `workshop:generate:${threadId}`,
      10 * 60 // 10 per minute = 600 per day
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

    // Check cache first
    const cacheKey = `workshop:${threadId}:line:${lineIndex}`;
    const cached = await cacheGet<GenerateOptionsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Verify thread ownership and fetch guide answers
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Extract guide answers from state
    const state = (thread.state as any) || {};
    const guideAnswers: GuideAnswers = state.guide_answers || {};
    const poemAnalysis = state.poem_analysis || {};

    // Extract translation zone and intent for flexible prompt building
    // Fallback logic: zone > intent > fallback message
    const translationZone = (guideAnswers as any)?.translationZone?.trim() || "";
    const translationIntent = guideAnswers.translationIntent?.trim() || "";
    const targetZoneContext =
      translationZone ||
      translationIntent ||
      "not specified by the translator";
    const translationStrategy =
      translationIntent ||
      "Balance literal and creative interpretations";

    console.log("[generate-options] Translation context:", {
      hasTranslationZone: !!translationZone,
      hasTranslationIntent: !!translationIntent,
      targetZoneContext: targetZoneContext.substring(0, 100), // First 100 chars
      translationStrategy: translationStrategy.substring(0, 100),
    });

    // Tokenize line into words (simple split by spaces)
    const words = lineText.split(/\s+/).filter(Boolean);

    // If blank line, return empty word options
    if (words.length === 0) {
      return NextResponse.json({
        lineIndex,
        words: [], // Empty array for blank lines
        modelUsed: TRANSLATOR_MODEL,
      });
    }

    // Track which model was used (will be set by first word generation)
    let actualModelUsed = TRANSLATOR_MODEL;

    // Generate options for each word
    const wordOptions = await Promise.all(
      words.map(async (word, position) => {
        try {
          const prompt = buildWordTranslationPrompt({
            word,
            lineContext: lineText,
            guideAnswers,
            sourceLanguage: poemAnalysis.language || "the source language",
          });

          const systemPrompt = buildWorkshopSystemPrompt();

          // Use TRANSLATOR_MODEL (defaults to gpt-5) with fallback
          let modelToUse = TRANSLATOR_MODEL;
          let completion;

          // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
          const isGpt5 = modelToUse.startsWith('gpt-5');

          try {
            if (isGpt5) {
              // GPT-5: No temperature or other sampling parameters
              completion = await openai.chat.completions.create({
                model: modelToUse,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: prompt },
                ],
              });
            } else {
              // GPT-4: Include temperature
              completion = await openai.chat.completions.create({
                model: modelToUse,
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: prompt },
                ],
              });
            }
            // Update the tracked model if this is the first successful call
            if (position === 0) {
              actualModelUsed = modelToUse;
            }
          } catch (modelError: any) {
            // If model not found or unsupported, fallback to gpt-4o
            const shouldFallback =
              modelError?.error?.code === 'model_not_found' ||
              modelError?.status === 404 ||
              modelError?.status === 400;

            if (shouldFallback) {
              console.warn(`[generate-options] Model ${modelToUse} fallback to gpt-4o:`, modelError?.error?.code || modelError?.error?.message || 'error');
              modelToUse = "gpt-4o";
              completion = await openai.chat.completions.create({
                model: modelToUse,
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: prompt },
                ],
              });
              // Update the tracked model
              if (position === 0) {
                actualModelUsed = modelToUse;
              }
            } else {
              throw modelError;
            }
          }

          // Extract response text
          const text = completion.choices[0]?.message?.content ?? "{}";

          // Parse options and part of speech
          let options: string[];
          let partOfSpeech: string | undefined;
          try {
            const parsed = JSON.parse(text);

            // Handle new format with partOfSpeech
            if (parsed.options && Array.isArray(parsed.options)) {
              options = parsed.options;
              partOfSpeech = parsed.partOfSpeech || "neutral";
            }
            // Fallback: handle old array format
            else if (Array.isArray(parsed)) {
              options = parsed;
              partOfSpeech = "neutral";
            } else {
              throw new Error("Invalid format");
            }

            // Validate we have exactly 3 options
            if (options.length < 3) {
              options = [...options, word, `${word} (lit.)`, `${word} (alt)`].slice(0, 3);
            } else if (options.length > 3) {
              options = options.slice(0, 3);
            }
          } catch (parseError) {
            console.error(
              `[generate-options] Parse error for word "${word}":`,
              parseError
            );
            // Fallback: provide basic options
            options = [word, `${word} (literal)`, `${word} (alt)`];
            partOfSpeech = "neutral";
          }

          return {
            original: word,
            position,
            options,
            partOfSpeech: partOfSpeech as any,
          };
        } catch (wordError) {
          console.error(
            `[generate-options] Error generating for word "${word}":`,
            wordError
          );
          // Fallback for individual word failure
          return {
            original: word,
            position,
            options: [word, `${word} (literal)`, `${word} (alt)`],
            partOfSpeech: "neutral" as any,
          };
        }
      })
    );

    // Build response
    const result: GenerateOptionsResponse = {
      lineIndex,
      words: wordOptions,
      modelUsed: actualModelUsed, // Track which model was used
    };

    // Cache for 1 hour
    await cacheSet(cacheKey, result, 3600);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[generate-options] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
