import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createTranslationJob,
  getTranslationJob,
} from "@/lib/workshop/jobState";
import { loadThreadContext } from "@/lib/workshop/runTranslationTick";
import { summarizeTranslationJob } from "@/lib/workshop/translationProgress";
import { enqueueTranslationJob } from "@/lib/workshop/translationQueue";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  runInitialTick: z.boolean().optional().default(false), // Changed: default false for fast response
});

export async function POST(req: Request) {
  console.log("[HIT] initialize-translations");
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
          error instanceof Error ? error.message : "Unable to parse request",
      },
      { status: 400 }
    );
  }

  const { threadId, runInitialTick } = body;

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

  const context = await loadThreadContext(threadId);

  const job = await createTranslationJob(
    {
      threadId,
      poem: context.rawPoem,
      chunks: context.stanzaResult.stanzas, // chunks are the new primary field
      stanzas: context.stanzaResult.stanzas, // legacy fallback
    },
    {
      maxConcurrent: undefined,
      maxStanzasPerTick: undefined,
      guidePreferences: context.guideAnswers as Record<string, unknown>,
    }
  );

  // Enqueue translation job for background processing
  await enqueueTranslationJob(threadId).catch((error) => {
    console.error("[initialize-translations] Failed to enqueue job:", error);
    // Continue anyway - worker will pick it up via polling if queue fails
  });

  // Optional: run a tiny "warm start" tick if explicitly requested (debug only)
  // Default is false - worker handles processing in background
  // This micro-tick is quality-safe (won't finalize partial lines) but still blocks the request
  let tickResult = null;
  if (runInitialTick && job.status !== "completed") {
    console.warn(
      "[initialize-translations] runInitialTick=true requested - this blocks the request. Use worker for production."
    );
    const { runTranslationTick } = await import(
      "@/lib/workshop/runTranslationTick"
    );
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 500, // Small budget, returns fast, quality-safe
    });
  }

  const latestJob = await getTranslationJob(threadId);
  const progress = summarizeTranslationJob(latestJob);

  return NextResponse.json(
    {
      ok: true,
      job: latestJob,
      tick: tickResult,
      progress,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
