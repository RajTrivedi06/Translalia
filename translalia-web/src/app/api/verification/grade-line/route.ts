import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";
import { openai } from "@/lib/ai/openai";
import { VERIFICATION_MODEL } from "@/lib/models";
import {
  buildVerificationPrompt,
  type VerificationPromptParams,
} from "@/lib/ai/verificationPrompts";
import { TrackAGrade } from "@/types/verification";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";
import { maskPrompts } from "@/server/audit/mask";
import { checkRateLimit } from "@/lib/ratelimit/redis";
import {
  handleOpenAIError,
  logVerificationError,
  formatErrorResponse,
  VerificationError,
  VerificationErrorCode,
} from "@/lib/verification/errorHandler";
import { recordMetric, createTimer } from "@/lib/verification/monitoring";

const gradeRequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const timer = createTimer();
  console.log("[verification/grade-line]", requestId, "Starting verification");

  try {
    // 1. Authenticate user
    const { user, response } = await requireUser();
    if (!user) return response;

    // 2. Rate limiting: max 50 verifications per user per day
    const today = new Date().toISOString().split("T")[0];
    const rateLimitKey = `verify:grade:${user.id}:${today}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      parseInt(process.env.VERIFICATION_RATE_LIMIT || "50"),
      86400
    );

    if (!rateLimit.success) {
      console.warn(
        "[verification/grade-line]",
        requestId,
        "Rate limit exceeded",
        {
          userId: user.id,
          remaining: rateLimit.remaining,
        }
      );

      const duration = timer.stop();
      recordMetric({
        timestamp: Date.now(),
        operation: "grade",
        duration,
        success: false,
        errorCode: VerificationErrorCode.RATE_LIMIT,
        userId: user.id,
      });

      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Daily verification quota exceeded",
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.reset,
          },
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.reset.toString(),
          },
        }
      );
    }

    console.log("[verification/grade-line]", requestId, "Rate limit OK", {
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
    });

    // 3. Parse and validate request
    const body = await request.json();
    const { threadId, lineIndex } = gradeRequestSchema.parse(body);

    console.log("[verification/grade-line]", requestId, {
      threadId,
      lineIndex,
      userId: user.id,
    });

    // 3. Get Supabase client and fetch thread
    const supabase = await getServerClient();

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, created_by, project_id")
      .eq("id", threadId)
      .single();

    if (threadError) {
      console.error(
        "[verification/grade-line]",
        requestId,
        "Thread fetch error:",
        threadError
      );
      return NextResponse.json(
        { error: { code: "THREAD_NOT_FOUND", message: "Thread not found" } },
        { status: 404 }
      );
    }

    // 4. Verify ownership
    if (thread.created_by !== user.id) {
      console.warn(
        "[verification/grade-line]",
        requestId,
        "Unauthorized access attempt"
      );
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not your thread" } },
        { status: 403 }
      );
    }

    // 5. Extract state data
    const state = (thread.state as any) || {};
    const { guide_answers, poem_analysis, workshop_lines } = state;

    if (!workshop_lines || !workshop_lines[lineIndex]) {
      console.error(
        "[verification/grade-line]",
        requestId,
        "Line not found in state"
      );
      return NextResponse.json(
        {
          error: { code: "LINE_NOT_FOUND", message: "Line index out of range" },
        },
        { status: 400 }
      );
    }

    const targetLine = workshop_lines[lineIndex];

    // 6. Validate line has necessary data
    if (!targetLine.selections || targetLine.selections.length === 0) {
      console.warn(
        "[verification/grade-line]",
        requestId,
        "Line not completed yet"
      );
      return NextResponse.json(
        {
          error: {
            code: "LINE_INCOMPLETE",
            message: "Line has no selections yet",
          },
        },
        { status: 400 }
      );
    }

    if (!targetLine.word_options || targetLine.word_options.length === 0) {
      console.warn(
        "[verification/grade-line]",
        requestId,
        "No word options stored"
      );
      return NextResponse.json(
        {
          error: {
            code: "NO_OPTIONS",
            message: "Word options not stored for this line",
          },
        },
        { status: 400 }
      );
    }

    // 7. Check if already graded (optional - can re-grade if needed)
    if (targetLine.verification?.trackA?.graded) {
      console.log(
        "[verification/grade-line]",
        requestId,
        "Line already graded, re-grading"
      );
    }

    // 8. Build verification prompt
    const promptParams: VerificationPromptParams = {
      sourceLine:
        poem_analysis?.source_lines?.[lineIndex] || targetLine.original,
      sourceLanguage: poem_analysis?.detected_language || "unknown",
      targetLanguage: guide_answers?.target_language || "unknown",
      guideAnswers: guide_answers || {},
      generatedOptions: targetLine.word_options,
      userSelections: targetLine.selections,
      translatedLine: targetLine.translated,
    };

    const prompt = buildVerificationPrompt(promptParams);

    // 9. Call GPT-5 for grading
    console.log(
      "[verification/grade-line]",
      requestId,
      "Calling verification model"
    );

    const gradingResponse = await openai.chat.completions.create({
      model: VERIFICATION_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for consistent grading
    });

    const duration = timer.stop();
    console.log(
      "[verification/grade-line]",
      requestId,
      `Grading completed in ${duration}ms`
    );

    // 10. Parse response
    const gradeContent = gradingResponse.choices[0].message.content || "{}";
    let grade: TrackAGrade;
    try {
      grade = JSON.parse(gradeContent);
      grade.model_used = VERIFICATION_MODEL;
      grade.graded_at = new Date().toISOString();
    } catch (parseError) {
      console.error(
        "[verification/grade-line]",
        requestId,
        "Failed to parse grade response:",
        parseError
      );
      return NextResponse.json(
        {
          error: {
            code: "PARSE_ERROR",
            message: "Failed to parse verification response",
          },
        },
        { status: 500 }
      );
    }

    console.log(
      "[verification/grade-line]",
      requestId,
      "Overall score:",
      grade.overall_score
    );

    // Record successful metric (duration already calculated above)
    recordMetric({
      timestamp: Date.now(),
      operation: "grade",
      duration,
      success: true,
      userId: user.id,
      metadata: { threadId, lineIndex, score: grade.overall_score },
    });

    // 11. Store in prompt_audits for logging
    // Note: The stage 'line-verification-internal' may need to be added to the database constraint
    // If it fails, we'll continue anyway and just log the error
    const masked = maskPrompts(prompt.system, prompt.user);
    const auditId = await insertPromptAudit({
      createdBy: user.id,
      projectId: thread.project_id ?? null,
      threadId: threadId,
      stage: "line-verification-internal", // May need DB update to allow this stage
      provider: "openai",
      model: VERIFICATION_MODEL,
      params: {
        lineIndex,
        requestId,
        duration,
        timestamp: new Date().toISOString(),
        promptParams,
        // Store full grade data in params for analytics
        grade: grade,
      },
      promptSystemMasked: masked.promptSystemMasked,
      promptUserMasked: masked.promptUserMasked,
      responseExcerpt: JSON.stringify(grade).slice(0, 400),
      redactions: masked.redactions.map((r) => r.type),
    });

    if (!auditId) {
      console.warn(
        "[verification/grade-line]",
        requestId,
        "Failed to save audit (non-critical)"
      );
    }

    // 12. Update thread state with verification status
    const updatedLines = [...workshop_lines];
    updatedLines[lineIndex] = {
      ...targetLine,
      verification: {
        ...(targetLine.verification || {}),
        trackA: {
          graded: true,
          gradedAt: grade.graded_at,
          auditId: auditId || "",
          summary: {
            overall: grade.overall_score,
            dimensions: grade.scores,
          },
        },
      },
    };

    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...state,
          workshop_lines: updatedLines,
        },
      })
      .eq("id", threadId);

    if (updateError) {
      console.error(
        "[verification/grade-line]",
        requestId,
        "Failed to update state:",
        updateError
      );
      return NextResponse.json(
        {
          error: {
            code: "UPDATE_FAILED",
            message: "Failed to save verification",
          },
        },
        { status: 500 }
      );
    }

    console.log(
      "[verification/grade-line]",
      requestId,
      "Verification complete"
    );

    // 13. Return grade (internal use only - never shown to end users)
    return NextResponse.json({
      success: true,
      grade,
      auditId: auditId || null,
      requestId,
    });
  } catch (err) {
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
      (err as any).name === "OpenAIError" ||
      (err as any).code?.startsWith("openai")
    ) {
      verificationError = handleOpenAIError(err);
    } else if (err instanceof VerificationError) {
      verificationError = err;
    } else {
      verificationError = new VerificationError(
        VerificationErrorCode.UNKNOWN,
        "Verification failed unexpectedly",
        500
      );
    }

    recordMetric({
      timestamp: Date.now(),
      operation: "grade",
      duration,
      success: false,
      errorCode: verificationError.code,
      userId: "unknown",
    });

    logVerificationError("grade-line", requestId, verificationError, {
      threadId: (err as any).threadId,
      lineIndex: (err as any).lineIndex,
    });

    return NextResponse.json(formatErrorResponse(verificationError), {
      status: verificationError.statusCode,
    });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
