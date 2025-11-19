import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getTranslationJob,
  updateTranslationJob,
} from "@/lib/workshop/jobState";
import { runTranslationTick } from "@/lib/workshop/runTranslationTick";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  stanzaIndex: z.number().int().min(0),
  clearLines: z.boolean().optional().default(true),
  runImmediately: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details:
          error instanceof Error
            ? error.message
            : "Unable to parse request body",
      },
      { status: 400 }
    );
  }

  const { threadId, stanzaIndex, clearLines, runImmediately } = body;

  const supabase = await supabaseServer();
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id, created_by")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return NextResponse.json(
      { error: "Thread not found or unauthorized" },
      { status: 404 }
    );
  }

  if (thread.created_by !== user.id) {
    return NextResponse.json(
      { error: "You do not have access to this thread" },
      { status: 403 }
    );
  }

  const job = await getTranslationJob(threadId);
  if (!job) {
    return NextResponse.json(
      { error: "Translation job not found for thread" },
      { status: 404 }
    );
  }

  // Use chunks (new) or stanzas (legacy) for checking
  const chunksOrStanzas = job.chunks || job.stanzas;
  if (!chunksOrStanzas || !chunksOrStanzas[stanzaIndex]) {
    return NextResponse.json(
      { error: `Chunk ${stanzaIndex} not found in translation job` },
      { status: 400 }
    );
  }

  await updateTranslationJob(threadId, (draft) => {
    const chunksOrStanzas = draft.chunks || draft.stanzas;
    if (!chunksOrStanzas) return draft;

    const chunk = chunksOrStanzas[stanzaIndex];
    if (!chunk) {
      return draft;
    }

    chunk.status = "queued";
    chunk.error = undefined;
    chunk.error_details = undefined;
    chunk.retries = 0;
    chunk.nextRetryAt = undefined;
    chunk.fallback_mode = false;
    chunk.lastLineTranslated = undefined;

    if (clearLines) {
      chunk.lines = [];
      chunk.linesProcessed = 0;
    }

    // Remove from active queue if present
    draft.active = draft.active.filter((index) => index !== stanzaIndex);

    // Ensure stanza is at front of queue without duplicates
    draft.queue = [
      stanzaIndex,
      ...draft.queue.filter((idx) => idx !== stanzaIndex),
    ];

    // Reset aggregates
    draft.processing_status = undefined;

    return draft;
  });

  let tickResult = null;
  if (runImmediately) {
    try {
      tickResult = await runTranslationTick(threadId, {
        maxProcessingTimeMs: 4000,
      });
    } catch (error) {
      console.error(
        `[requeue-stanza] Failed to process stanza ${stanzaIndex} immediately`,
        error
      );
    }
  }

  const updatedJob = await getTranslationJob(threadId);

  return NextResponse.json({
    ok: true,
    job: updatedJob,
    tick: tickResult,
  });
}
