import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";
import { openai } from "@/lib/ai/openai";
import { CONTEXT_MODEL } from "@/lib/models";
import {
  buildContextNotesPrompt,
  type ContextNotesParams,
} from "@/lib/ai/verificationPrompts";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkRateLimit } from "@/lib/ratelimit/redis";
import {
  handleOpenAIError,
  logVerificationError,
  formatErrorResponse,
  VerificationError,
  VerificationErrorCode,
} from "@/lib/verification/errorHandler";
import { recordMetric, createTimer } from "@/lib/verification/monitoring";

type GuideAnswersState = {
  translationModel?: string | null;
  translationMethod?: string | null;
  translationIntent?: string | null;
  translationZone?: string | null;
  sourceLanguageVariety?: string | null;
};

const contextRequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  tokenIndex: z.number().int().min(0),
  // Optional: allow client to provide word options when line not saved yet
  wordOptions: z
    .array(
      z.object({
        source: z.string(),
        order: z.number(),
        options: z.array(z.string()),
        pos: z.string().optional(),
      })
    )
    .optional(),
});

interface ContextNotesResponse {
  considerations: string[];
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const timer = createTimer();
  console.log(
    "[verification/context-notes]",
    requestId,
    "Starting context generation"
  );

  try {
    // 1. Authenticate user
    const authResult = await requireUser();
    if (!authResult.user) return authResult.response;
    const user = authResult.user;

    // 2. Rate limiting: max 200 context requests per user per day
    const today = new Date().toISOString().split("T")[0];
    const rateLimitKey = `verify:context:${user.id}:${today}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      parseInt(process.env.CONTEXT_RATE_LIMIT || "200"),
      86400
    );

    if (!rateLimit.success) {
      console.warn(
        "[verification/context-notes]",
        requestId,
        "Rate limit exceeded"
      );

      const duration = timer.stop();
      recordMetric({
        timestamp: Date.now(),
        operation: "context",
        duration,
        success: false,
        errorCode: VerificationErrorCode.RATE_LIMIT,
        userId: user.id,
      });

      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Daily context notes quota exceeded",
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.reset,
          },
        },
        { status: 429 }
      );
    }

    // 3. Parse and validate request
    const body = await request.json();
    const { threadId, lineIndex, tokenIndex, wordOptions } =
      contextRequestSchema.parse(body);

    console.log("[verification/context-notes]", requestId, {
      threadId,
      lineIndex,
      tokenIndex,
    });

    // 3. Check cache first (avoid regenerating same notes)
    const cacheKey = `context:${threadId}:${lineIndex}:${tokenIndex}`;
    const cached = await cacheGet<ContextNotesResponse>(cacheKey);

    if (cached) {
      console.log(
        "[verification/context-notes]",
        requestId,
        "Returning cached notes"
      );

      // Record cached metric
      const duration = timer.stop();
      recordMetric({
        timestamp: Date.now(),
        operation: "context",
        duration,
        success: true,
        userId: user.id,
        metadata: { threadId, lineIndex, tokenIndex, cached: true },
      });

      return NextResponse.json({
        success: true,
        notes: cached.considerations,
        cached: true,
      });
    }

    // 4. Get Supabase client and fetch thread
    const supabase = await getServerClient();

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, created_by, project_id, translation_model, translation_method, translation_intent, translation_zone, source_language_variety")
      .eq("id", threadId)
      .single();

    if (threadError) {
      console.error(
        "[verification/context-notes]",
        requestId,
        "Thread fetch error:",
        threadError
      );
      return NextResponse.json(
        { error: { code: "THREAD_NOT_FOUND", message: "Thread not found" } },
        { status: 404 }
      );
    }

    // 5. Verify ownership
    if (thread.created_by !== user.id) {
      console.warn(
        "[verification/context-notes]",
        requestId,
        "Unauthorized access attempt"
      );
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not your thread" } },
        { status: 403 }
      );
    }

    // 6. Extract state data from columns (with JSONB fallback for legacy)
    const state = (thread.state as Record<string, unknown>) || {};
    const guideAnswersState =
      (state as { guide_answers?: GuideAnswersState }).guide_answers ?? {};
    const guide_answers: Record<string, unknown> = {
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
    const poem_analysis = (
      state as {
        poem_analysis?: { source_lines?: string[]; detected_language?: string };
      }
    ).poem_analysis;
    const workshop_lines = (
      state as {
        workshop_lines?: Array<{
          original?: string;
          word_options?: Array<{
            source: string;
            order: number;
            options: string[];
            pos?: string;
          }>;
        }>;
      }
    ).workshop_lines;

    const targetLine = workshop_lines?.[lineIndex];

    // 7. Resolve word option: prefer saved, fallback to provided
    let wordOption:
      | {
          source: string;
          order: number;
          options: string[];
          pos?: string;
        }
      | undefined;

    if (targetLine?.word_options?.[tokenIndex]) {
      wordOption = targetLine.word_options[tokenIndex];
      console.log(
        "[verification/context-notes]",
        requestId,
        "Using saved word options"
      );
    } else if (wordOptions && wordOptions[tokenIndex]) {
      wordOption = wordOptions[tokenIndex];
      console.log(
        "[verification/context-notes]",
        requestId,
        "Using provided word options"
      );
    } else {
      console.error(
        "[verification/context-notes]",
        requestId,
        "Token not available"
      );
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_NOT_FOUND",
            message: "Token not available",
          },
        },
        { status: 400 }
      );
    }

    // 8. Build context notes prompt
    const sourceLineCandidate = poem_analysis?.source_lines?.[lineIndex];
    const promptParams: ContextNotesParams = {
      sourceLine:
        (typeof sourceLineCandidate === "string" && sourceLineCandidate) ||
        (targetLine?.original as string) ||
        "",
      sourceToken: wordOption!.source,
      options: wordOption!.options,
      pos: wordOption!.pos,
      guideAnswers: guide_answers || {},
    };

    const prompt = buildContextNotesPrompt(promptParams);

    // 9. Call GPT-5-mini for context generation (cheaper model)
    console.log(
      "[verification/context-notes]",
      requestId,
      "Calling context model"
    );

    const completion = await openai.chat.completions.create({
      model: CONTEXT_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5, // Slightly higher for more natural explanations
      max_tokens: 500, // Keep notes concise
    });

    const duration = timer.stop();
    console.log(
      "[verification/context-notes]",
      requestId,
      `Context generated in ${duration}ms`
    );

    // 10. Parse response
    const contextContent = completion.choices[0].message.content || "{}";
    let context: ContextNotesResponse;
    try {
      context = JSON.parse(contextContent);
    } catch (parseError) {
      console.error(
        "[verification/context-notes]",
        requestId,
        "Failed to parse context response:",
        parseError
      );
      return NextResponse.json(
        {
          error: {
            code: "PARSE_ERROR",
            message: "Failed to parse context response",
          },
        },
        { status: 500 }
      );
    }

    // 11. Cache for 1 hour (notes don't change unless options change)
    await cacheSet(cacheKey, context, 3600);

    // 12. Optionally log to prompt_audits (lighter logging than Track A)
    if (process.env.LOG_CONTEXT_GENERATION === "true") {
      const { insertPromptAudit } = await import(
        "@/server/audit/insertPromptAudit"
      );
      const { maskPrompts } = await import("@/server/audit/mask");
      const masked = maskPrompts(prompt.system, prompt.user);

      await insertPromptAudit({
        createdBy: user.id,
        projectId: thread.project_id ?? null,
        threadId: threadId,
        stage: "line-verification-context", // May need DB update
        provider: "openai",
        model: CONTEXT_MODEL,
        params: {
          lineIndex,
          tokenIndex,
          requestId,
          duration,
        },
        promptSystemMasked: masked.promptSystemMasked,
        promptUserMasked: masked.promptUserMasked,
        responseExcerpt: JSON.stringify(context).slice(0, 400),
        redactions: masked.redactions.map((r) => r.type),
      });
    }

    // Record successful metric (duration already calculated above)
    recordMetric({
      timestamp: Date.now(),
      operation: "context",
      duration,
      success: true,
      userId: user.id,
      metadata: { threadId, lineIndex, tokenIndex, cached: false },
    });

    console.log(
      "[verification/context-notes]",
      requestId,
      "Context generation complete"
    );

    // 13. Return notes to user
    return NextResponse.json({
      success: true,
      notes: context.considerations,
      cached: false,
    });
  } catch (err: unknown) {
    // Record failed metric
    const duration = timer.stop();
    let verificationError: VerificationError;

    if (err instanceof z.ZodError) {
      verificationError = new VerificationError(
        VerificationErrorCode.PARSE_ERROR,
        "Invalid request parameters",
        400,
        { zodError: err.format() }
      );
    } else if (
      (err as { name?: string; code?: string } | null)?.name ===
        "OpenAIError" ||
      ((err as { code?: string } | null)?.code || "").startsWith("openai")
    ) {
      verificationError = handleOpenAIError(err);
    } else if (err instanceof VerificationError) {
      verificationError = err;
    } else {
      verificationError = new VerificationError(
        VerificationErrorCode.UNKNOWN,
        "Context generation failed unexpectedly",
        500
      );
    }

    recordMetric({
      timestamp: Date.now(),
      operation: "context",
      duration,
      success: false,
      errorCode: verificationError.code,
      userId: "unknown",
    });

    logVerificationError("context-notes", requestId, verificationError, {
      threadId: (err as { threadId?: string } | null)?.threadId,
      lineIndex: (err as { lineIndex?: number } | null)?.lineIndex,
    });

    return NextResponse.json(
      formatErrorResponse(verificationError as VerificationError),
      {
        status: verificationError.statusCode,
      }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
