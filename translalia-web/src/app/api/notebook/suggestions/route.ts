/**
 * API endpoint for Conversational Notebook AI Suggestions
 *
 * Supports three steps:
 * 1. "identify" - Identify formal features of the source poem
 * 2. "adjust" - Suggest adjustments to imitate those features
 * 3. "personalize" - Personalized suggestions based on student's choices
 *
 * POST /api/notebook/suggestions
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
  NotebookSuggestionRequestSchema,
  FormalFeaturesAnalysisSchema,
  AdjustmentSuggestionsResponseSchema,
  PersonalizedSuggestionsResponseSchema,
  type NotebookSuggestionResponse,
  type SuggestionStep,
  type FormalFeaturesAnalysis,
  type AdjustmentSuggestionsResponse,
  type PersonalizedSuggestionsResponse,
} from "@/types/notebookSuggestions";
import {
  IDENTIFY_FEATURES_SYSTEM_PROMPT,
  buildIdentifyFeaturesUserPrompt,
  ADJUST_TRANSLATION_SYSTEM_PROMPT,
  buildAdjustTranslationUserPrompt,
  PERSONALIZED_SUGGESTIONS_SYSTEM_PROMPT,
  buildPersonalizedSuggestionsUserPrompt,
  generateFallbackFormalFeatures,
  generateFallbackAdjustments,
  generateFallbackPersonalized,
} from "@/lib/ai/notebookSuggestionsPrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 1800; // 30 minutes
const RATE_LIMIT_PER_DAY = 50;

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
  return NextResponse.json(
    { ok: false, error: { code, message, ...extra } },
    { status }
  );
}

function ok<T extends { ok: true }>(data: T, status = 200) {
  return NextResponse.json<T>(data, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: unknown[]) =>
    console.log("[/api/notebook/suggestions]", requestId, ...a);

  try {
    // 1) Auth check
    const { user, response } = await requireUser();
    if (!user) return response;

    // 2) Parse & validate body
    let body: ReturnType<typeof NotebookSuggestionRequestSchema.parse>;
    try {
      body = NotebookSuggestionRequestSchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        step: body.step,
        sourcePoemLen: body.sourcePoem?.length,
        translationLen: body.translationPoem?.length,
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
    const rateLimitKey = `notebook-suggestions:${user.id}:${today}`;
    const rateLimit = await checkRateLimit(rateLimitKey, RATE_LIMIT_PER_DAY, 86400);

    if (!rateLimit.success) {
      log("rate_limited", {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
      });
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
    const cacheKey = `notebook-suggestions:${body.threadId}:${body.step}:${hashPayload({
      sourcePoem: body.sourcePoem,
      translationPoem: body.translationPoem,
      translationDiary: body.translationDiary,
      selectedLines: body.selectedLines,
    })}`;

    const cached = await cacheGet<NotebookSuggestionResponse>(cacheKey);
    if (cached && cached.ok) {
      log("cache_hit");
      return ok({ ...cached, cached: true } as NotebookSuggestionResponse & { ok: true; cached: true });
    }

    // 6) Process based on step
    let result: NotebookSuggestionResponse;

    switch (body.step) {
      case "identify":
        result = await processIdentifyStep(body, user.id, log);
        break;
      case "adjust":
        result = await processAdjustStep(body, user.id, log);
        break;
      case "personalize":
        result = await processPersonalizeStep(body, user.id, log);
        break;
      default:
        return err(400, "INVALID_STEP", `Unknown step: ${body.step}`);
    }

    // 7) Cache and return
    if (result.ok) {
      await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    }

    log("success", {
      ms: Date.now() - started,
      step: body.step,
    });

    return ok(result as NotebookSuggestionResponse & { ok: true });
  } catch (e: unknown) {
    console.error("[/api/notebook/suggestions] fatal", e);
    const errorMsg = e instanceof Error ? e.message : "Internal server error";
    return err(500, "INTERNAL", errorMsg);
  }
}

// ============================================================================
// Helper: Extract text from OpenAI Response
// ============================================================================

function extractResponseText(llmResponse: unknown): string {
  if (typeof llmResponse === "string") {
    return llmResponse;
  }
  
  if (llmResponse && typeof llmResponse === "object") {
    const resp = llmResponse as Record<string, unknown>;
    
    // New Responses API format: output_text is the text content
    if (typeof resp.output_text === "string") {
      return resp.output_text;
    }
    
    // Older format: output array with content blocks
    if (Array.isArray(resp.output)) {
      for (const item of resp.output) {
        if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>;
          // Check for text content directly
          if (typeof itemObj.text === "string") {
            return itemObj.text;
          }
          // Check for content array
          if (Array.isArray(itemObj.content)) {
            for (const content of itemObj.content) {
              if (content && typeof content === "object") {
                const contentObj = content as Record<string, unknown>;
                if (contentObj.type === "output_text" && typeof contentObj.text === "string") {
                  return contentObj.text;
                }
                if (typeof contentObj.text === "string") {
                  return contentObj.text;
                }
              }
            }
          }
        }
      }
    }
    
    // Fallback: stringify and hope for the best
    return JSON.stringify(llmResponse);
  }
  
  return String(llmResponse);
}

// ============================================================================
// Step Processors
// ============================================================================

async function processIdentifyStep(
  body: ReturnType<typeof NotebookSuggestionRequestSchema.parse>,
  userId: string,
  log: (...a: unknown[]) => void
): Promise<NotebookSuggestionResponse> {
  log("processing identify step");

  const userPrompt = buildIdentifyFeaturesUserPrompt(
    body.sourcePoem,
    body.sourceLanguage
  );

  try {
    const llmResponse = await responsesCall({
      model: TRANSLATOR_MODEL,
      system: IDENTIFY_FEATURES_SYSTEM_PROMPT,
      user: userPrompt,
      auditContext: {
        createdBy: userId,
        threadId: body.threadId,
        stage: "notebook:suggestions:identify",
        provider: "openai",
      },
    });

    const responseText = extractResponseText(llmResponse);
    log("llm_response_text_length", responseText.length);

    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = FormalFeaturesAnalysisSchema.safeParse(parsed);

      if (validated.success) {
        return {
          ok: true,
          step: "identify",
          formalFeatures: validated.data,
        };
      }
      log("validation_error", validated.error.issues);
    } else {
      log("no_json_found_in_response", responseText.slice(0, 200));
    }
  } catch (e) {
    log("llm_error", e);
  }

  // Fallback
  return {
    ok: true,
    step: "identify",
    formalFeatures: generateFallbackFormalFeatures(),
  };
}

async function processAdjustStep(
  body: ReturnType<typeof NotebookSuggestionRequestSchema.parse>,
  userId: string,
  log: (...a: unknown[]) => void
): Promise<NotebookSuggestionResponse> {
  log("processing adjust step", {
    selectedLines: body.selectedLines,
    selectedCount: body.selectedLines?.length ?? 0,
  });

  // Require formal features from previous step
  if (!body.formalFeatures) {
    return {
      ok: false,
      step: "adjust",
      error: {
        code: "MISSING_FEATURES",
        message: "Formal features analysis is required for this step",
      },
    };
  }

  // Require at least one selected line
  if (!body.selectedLines || body.selectedLines.length === 0) {
    return {
      ok: false,
      step: "adjust",
      error: {
        code: "NO_LINES_SELECTED",
        message: "Please select at least one line to get rhyme suggestions",
      },
    };
  }

  const userPrompt = buildAdjustTranslationUserPrompt(
    body.sourcePoem,
    body.translationPoem,
    body.formalFeatures,
    body.sourceLanguage,
    body.targetLanguage,
    body.selectedLines
  );

  try {
    const llmResponse = await responsesCall({
      model: TRANSLATOR_MODEL,
      system: ADJUST_TRANSLATION_SYSTEM_PROMPT,
      user: userPrompt,
      auditContext: {
        createdBy: userId,
        threadId: body.threadId,
        stage: "notebook:suggestions:adjust",
        provider: "openai",
      },
    });

    const responseText = extractResponseText(llmResponse);
    log("llm_response_text_length", responseText.length);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = AdjustmentSuggestionsResponseSchema.safeParse(parsed);

      if (validated.success) {
        return {
          ok: true,
          step: "adjust",
          adjustments: validated.data,
        };
      }
      log("validation_error", validated.error.issues);
    } else {
      log("no_json_found_in_response", responseText.slice(0, 200));
    }
  } catch (e) {
    log("llm_error", e);
  }

  // Fallback
  return {
    ok: true,
    step: "adjust",
    adjustments: generateFallbackAdjustments(),
  };
}

async function processPersonalizeStep(
  body: ReturnType<typeof NotebookSuggestionRequestSchema.parse>,
  userId: string,
  log: (...a: unknown[]) => void
): Promise<NotebookSuggestionResponse> {
  log("processing personalize step");

  // Convert lineNotes from string keys to number keys if needed
  const lineNotes = body.lineNotes
    ? Object.fromEntries(
        Object.entries(body.lineNotes).map(([k, v]) => [parseInt(k, 10), v])
      )
    : undefined;

  const userPrompt = buildPersonalizedSuggestionsUserPrompt(
    body.sourcePoem,
    body.translationPoem,
    body.formalFeatures,
    body.translationDiary,
    lineNotes as Record<number, string> | undefined,
    body.sourceLanguage,
    body.targetLanguage
  );

  try {
    const llmResponse = await responsesCall({
      model: TRANSLATOR_MODEL,
      system: PERSONALIZED_SUGGESTIONS_SYSTEM_PROMPT,
      user: userPrompt,
      auditContext: {
        createdBy: userId,
        threadId: body.threadId,
        stage: "notebook:suggestions:personalize",
        provider: "openai",
      },
    });

    const responseText = extractResponseText(llmResponse);
    log("llm_response_text_length", responseText.length);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = PersonalizedSuggestionsResponseSchema.safeParse(parsed);

      if (validated.success) {
        return {
          ok: true,
          step: "personalize",
          personalized: validated.data,
        };
      }
      log("validation_error", validated.error.issues);
    } else {
      log("no_json_found_in_response", responseText.slice(0, 200));
    }
  } catch (e) {
    log("llm_error", e);
  }

  // Fallback
  return {
    ok: true,
    step: "personalize",
    personalized: generateFallbackPersonalized(),
  };
}
