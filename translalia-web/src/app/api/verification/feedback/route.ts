import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";

const feedbackSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number(),
  tokenIndex: z.number(),
  feedbackType: z.enum(["helpful", "unhelpful"]),
  notes: z.array(z.string()),
});

/**
 * Collect user feedback on context notes quality
 * Helps improve prompt engineering for Track B
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const body = await request.json();
    const feedback = feedbackSchema.parse(body);

    const supabase = await getServerClient();

    // Store feedback in prompt_audits for analysis
    // Note: May need to add 'context-feedback' to stage constraint
    const { error } = await supabase.from("prompt_audits").insert({
      project_id: null, // Feedback is cross-project
      thread_id: feedback.threadId,
      stage: "context-feedback", // May need DB update
      prompt_data: {
        lineIndex: feedback.lineIndex,
        tokenIndex: feedback.tokenIndex,
        notes: feedback.notes,
      },
      response_data: {
        feedbackType: feedback.feedbackType,
      },
      model: "user-feedback",
      created_by: user.id,
      meta: {
        timestamp: new Date().toISOString(),
      },
    } as any);

    if (error) {
      console.error("[verification/feedback] Failed to save:", error);
      // Don't fail the request - feedback is non-critical
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[verification/feedback] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid feedback data",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save feedback",
        },
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
