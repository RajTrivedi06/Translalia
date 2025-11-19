/**
 * POST /api/workshop/retry-stanza
 * Feature 9 (E): User-triggered retry for failed stanzas
 *
 * Allows users to retry a failed stanza after an error.
 * Resets retry count and moves stanza back to queued status.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getTranslationJob,
  updateStanzaStatus,
} from "@/lib/workshop/jobState";
import { runTranslationTick } from "@/lib/workshop/runTranslationTick";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  stanzaIndex: z.number().int().min(0),
});

interface ErrorResponse {
  error: string;
  details?: unknown;
}

interface SuccessResponse {
  success: boolean;
  stanza: {
    index: number;
    status: string;
    retries: number;
    maxRetries: number;
    error?: string;
  };
  job: {
    status: string;
    processing_status: {
      completed: number;
      processing: number;
      queued: number;
      failed: number;
    };
  };
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.issues,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const { threadId, stanzaIndex } = validation.data;

    // Verify thread ownership and load job state
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get current job
    const job = await getTranslationJob(threadId);
    if (!job) {
      return NextResponse.json(
        { error: "Translation job not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Validate stanza index (use chunks or stanzas, whichever exists)
    const chunksOrStanzas = job.chunks || job.stanzas || {};
    if (stanzaIndex < 0 || stanzaIndex >= Object.keys(chunksOrStanzas).length) {
      return NextResponse.json(
        { error: "Invalid chunk index" } as ErrorResponse,
        { status: 400 }
      );
    }

    const chunk = chunksOrStanzas[stanzaIndex];
    if (!chunk) {
      return NextResponse.json(
        { error: "Chunk not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check if chunk is in a retryable state (should be failed)
    if (chunk.status !== "failed") {
      return NextResponse.json(
        {
          error: `Chunk is not in failed state (current: ${chunk.status})`,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Check retry limit (Feature 9: max 5 user-triggered retries)
    // Count how many times this chunk has been retried (via retries field)
    const currentRetries = (chunk.retries ?? 0) + 1;

    if (currentRetries > 5) {
      return NextResponse.json(
        { error: "Maximum retry attempts exceeded for this chunk" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Reset chunk for retry
    const updatedJob = await updateStanzaStatus(threadId, stanzaIndex, {
      status: "queued",
      retries: currentRetries, // Track retry count
      error: undefined,
      error_details: undefined,
      error_history: [
        ...(chunk.error_history ?? []),
        {
          timestamp: Date.now(),
          error: "User triggered retry",
          code: "unknown",
          retryable: true,
        },
      ],
    });

    if (!updatedJob) {
      return NextResponse.json(
        { error: "Failed to update chunk status" } as ErrorResponse,
        { status: 500 }
      );
    }

    // Optionally trigger a translation tick immediately
    try {
      await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 });
    } catch (tickError) {
      console.warn(
        "[retry-stanza] runTranslationTick failed, but chunk was queued:",
        tickError
      );
      // Don't fail the request, chunk was successfully queued
    }

    // Get updated job state
    const finalJob = await getTranslationJob(threadId);

    return NextResponse.json(
      {
        success: true,
        stanza: {
          index: stanzaIndex,
          status: "queued",
          retries: 0,
          maxRetries: chunk.maxRetries ?? 3,
        },
        job: {
          status: finalJob?.status ?? updatedJob.status,
          processing_status: finalJob?.processing_status ?? {
            completed: 0,
            processing: 0,
            queued: 0,
            failed: 0,
          },
        },
      } as SuccessResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[retry-stanza] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : undefined,
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
