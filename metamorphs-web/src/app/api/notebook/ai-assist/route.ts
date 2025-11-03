import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import {
  buildAIAssistPrompt,
  buildAIAssistSystemPrompt,
} from "@/lib/ai/workshopPrompts";
import { GuideAnswers } from "@/store/guideSlice";
import { DragData } from "@/types/drag";
import { z } from "zod";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  cellId: z.string(),
  selectedWords: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      originalWord: z.string(),
      partOfSpeech: z.enum([
        "noun",
        "verb",
        "adjective",
        "adverb",
        "pronoun",
        "preposition",
        "conjunction",
        "article",
        "interjection",
        "neutral",
      ]),
      sourceLineNumber: z.number(),
      position: z.number(),
      dragType: z.enum(["option", "sourceWord"]).optional(),
    })
  ),
  sourceLineText: z.string(),
  instruction: z.enum(["refine", "rephrase", "expand", "simplify"]).optional(),
});

const ResponseSchema = z.object({
  cellId: z.string(),
  suggestion: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
});

export type AIAssistResponse = z.infer<typeof ResponseSchema>;

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

    const { threadId, cellId, selectedWords, sourceLineText, instruction } =
      validation.data;

    // Validate selectedWords not empty
    if (selectedWords.length === 0) {
      return NextResponse.json(
        { error: "No words selected" },
        { status: 400 }
      );
    }

    // Rate limiting: 10 requests per minute per thread
    const rateCheck = await checkDailyLimit(
      user.id,
      `notebook:ai-assist:${threadId}`,
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

    // Check cache first (cache key based on selected words and instruction)
    const wordsKey = selectedWords.map((w) => w.text).join("_");
    const cacheKey = `ai-assist:${threadId}:${cellId}:${wordsKey}:${instruction || "refine"}`;
    const cached = await cacheGet<AIAssistResponse>(cacheKey);
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

    // Build prompts
    const prompt = buildAIAssistPrompt({
      selectedWords: selectedWords as DragData[],
      sourceLineText,
      guideAnswers,
      instruction: instruction || "refine",
    });

    const systemPrompt = buildAIAssistSystemPrompt();

    // Use TRANSLATOR_MODEL (defaults to gpt-5) with fallback
    let modelToUse = TRANSLATOR_MODEL;
    let completion;

    // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
    const isGpt5 = modelToUse.startsWith("gpt-5");

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
    } catch (modelError: any) {
      // If model not found or unsupported, fallback to gpt-4o
      const shouldFallback =
        modelError?.error?.code === "model_not_found" ||
        modelError?.status === 404 ||
        modelError?.status === 400;

      if (shouldFallback) {
        console.warn(
          `[ai-assist] Model ${modelToUse} fallback to gpt-4o:`,
          modelError?.error?.code ||
            modelError?.error?.message ||
            "error"
        );
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
      } else {
        throw modelError;
      }
    }

    // Extract response text
    const text = completion.choices[0]?.message?.content ?? "{}";

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("[ai-assist] Parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 500 }
      );
    }

    // Validate response has required fields
    if (!parsed.suggestion) {
      console.error("[ai-assist] Missing suggestion field:", parsed);
      return NextResponse.json(
        { error: "Invalid AI response: missing suggestion" },
        { status: 500 }
      );
    }

    // Build response with defaults for optional fields
    const result: AIAssistResponse = {
      cellId,
      suggestion: parsed.suggestion,
      confidence: parsed.confidence || 80, // Default confidence if not provided
      reasoning: parsed.reasoning,
      alternatives: parsed.alternatives || [],
    };

    // Validate with schema
    const validatedResult = ResponseSchema.safeParse(result);
    if (!validatedResult.success) {
      console.error("[ai-assist] Validation error:", validatedResult.error);
      return NextResponse.json(
        { error: "Invalid AI response structure" },
        { status: 500 }
      );
    }

    // Cache for 1 hour
    await cacheSet(cacheKey, result, 3600);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai-assist] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
