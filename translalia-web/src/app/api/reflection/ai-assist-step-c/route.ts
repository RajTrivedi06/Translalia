import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import {
  buildAIAssistStepCPrompt,
  buildAIAssistStepCSystemPrompt,
  type AIAssistStepCContext,
} from "@/lib/ai/workshopPrompts";
import { GuideAnswers } from "@/store/guideSlice";
import { z } from "zod";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
});

const SuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  lineReferences: z.array(z.number()).optional(),
});

const ResponseSchema = z.object({
  aims: z.string(),
  suggestions: z.array(SuggestionSchema).min(1).max(3),
  confidence: z.number().min(0).max(1).optional(),
});

export type AIAssistStepCResponse = z.infer<typeof ResponseSchema>;

export async function POST(req: NextRequest) {
  // Auth check
  const { user, response } = await requireUser();
  if (!user) return response;

  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...args: any[]) =>
    console.log("[/api/reflection/ai-assist-step-c]", requestId, ...args);

  try {
    // Parse and validate request
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      log("validation_failed", validation.error.issues);
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { threadId } = validation.data;

    // Rate limiting: 20 requests per day per thread
    const rateCheck = await checkDailyLimit(
      user.id,
      `reflection:ai-assist-step-c:${threadId}`,
      20
    );

    if (!rateCheck.allowed) {
      log("rate_limit_exceeded", {
        current: rateCheck.current,
        max: rateCheck.max,
      });
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
    const cacheKey = `ai-assist-step-c:${threadId}`;
    const cached = await cacheGet<AIAssistStepCResponse>(cacheKey);
    if (cached) {
      log("cache_hit");
      return NextResponse.json(cached);
    }

    // Fetch thread with columns
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, project_id, created_by, translation_model, translation_method, translation_intent, translation_zone, source_language_variety, raw_poem")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      log("thread_not_found", threadError?.message);
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Extract data from columns (with JSONB fallback for legacy data)
    const state = (thread.state as any) || {};
    const guideAnswers: GuideAnswers = {
      translationModel: thread.translation_model ?? state.guide_answers?.translationModel ?? null,
      translationMethod: thread.translation_method ?? state.guide_answers?.translationMethod ?? "method-2",
      translationIntent: thread.translation_intent ?? state.guide_answers?.translationIntent ?? null,
      translationZone: thread.translation_zone ?? state.guide_answers?.translationZone ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? state.guide_answers?.sourceLanguageVariety ?? null,
      // Legacy fields from JSONB if needed
      ...(state.guide_answers || {}),
    };
    const poemLines: string[] = (thread.raw_poem ?? state.raw_poem ?? "").split("\n");
    const completedLines: Record<number, string> = state.workshop_lines || {};
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };

    log("context_extracted", {
      poemLinesCount: poemLines.length,
      completedLinesCount: Object.keys(completedLines).length,
      hasThreadNote: !!notebookNotes.thread_note,
      lineNotesCount: Object.keys(notebookNotes.line_notes || {}).length,
    });

    // Validate that there are some completed lines
    if (Object.keys(completedLines).length === 0) {
      log("no_completed_lines");
      return NextResponse.json(
        {
          error:
            "No completed translations yet. Complete at least one line to get contextual suggestions.",
        },
        { status: 400 }
      );
    }

    // Build context for prompt
    const context: AIAssistStepCContext = {
      poemLines,
      completedLines,
      guideAnswers,
      notes: notebookNotes,
    };

    // Build prompts
    const systemPrompt = buildAIAssistStepCSystemPrompt();
    const userPrompt = buildAIAssistStepCPrompt(context);

    // Use TRANSLATOR_MODEL with fallback
    let modelToUse = TRANSLATOR_MODEL;
    let completion;

    const isGpt5 = modelToUse.startsWith("gpt-5");

    try {
      log("openai_attempt", { model: modelToUse, isGpt5 });

      if (isGpt5) {
        // GPT-5: No temperature or other sampling parameters
        completion = await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        // GPT-4: Include temperature
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.8, // Higher for more creative suggestions
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      }
    } catch (modelError: any) {
      const shouldFallback =
        modelError?.error?.code === "model_not_found" ||
        modelError?.status === 404 ||
        modelError?.status === 400;

      if (shouldFallback) {
        log("fallback_to_gpt4", {
          from: modelToUse,
          to: "gpt-4o-mini",
          reason:
            modelError?.error?.code || modelError?.error?.message || "error",
        });
        modelToUse = "gpt-4o-mini";
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.8,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        log("openai_fail", modelError?.message);
        throw modelError;
      }
    }

    // Extract and parse response
    const text = completion.choices[0]?.message?.content ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      log("parse_error", parseError);
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 500 }
      );
    }

    // Validate response structure
    const validatedResult = ResponseSchema.safeParse(parsed);
    if (!validatedResult.success) {
      log("validation_error", validatedResult.error);
      return NextResponse.json(
        { error: "Invalid AI response structure" },
        { status: 500 }
      );
    }

    const result = validatedResult.data;

    // Log audit asynchronously
    const auditDuration = Date.now() - started;
    insertPromptAudit({
      createdBy: user.id,
      projectId: thread.project_id ?? null,
      threadId: threadId,
      stage: "ai-assist-step-c",
      provider: "openai",
      model: modelToUse,
      params: {
        duration_ms: auditDuration,
        temperature: isGpt5 ? null : 0.8,
        completedLinesCount: Object.keys(completedLines).length,
        hasNotes:
          !!notebookNotes.thread_note ||
          Object.keys(notebookNotes.line_notes || {}).length > 0,
      },
      promptSystemMasked: maskPrompts(systemPrompt, userPrompt)
        .promptSystemMasked,
      promptUserMasked: maskPrompts(systemPrompt, userPrompt).promptUserMasked,
      responseExcerpt: text.slice(0, 400),
    }).catch(() => {
      // Swallow audit errors
    });

    // Cache for 1 hour
    await cacheSet(cacheKey, result, 3600);

    log("success", { ms: auditDuration });
    return NextResponse.json(result);
  } catch (error) {
    log("error", error);
    console.error("[ai-assist-step-c] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
