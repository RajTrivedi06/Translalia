import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { getUpstashRedis } from "@/lib/ai/cache";
import {
  createTranslationJob,
  getTranslationJob,
} from "@/lib/workshop/jobState";
import { loadThreadContext } from "@/lib/workshop/runTranslationTick";
import { summarizeTranslationJob } from "@/lib/workshop/translationProgress";
import {
  deactivateTranslationJob,
  enqueueTranslationJob,
} from "@/lib/workshop/translationQueue";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  runInitialTick: z.boolean().optional().default(false), // Changed: default false for fast response
});

export async function POST(req: Request) {
  console.log("[HIT] initialize-translations");
  const { user, response, sb } = await requireUser();
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

  const { data: thread, error: threadError } = await sb
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

  const context = await loadThreadContext(threadId, {
    authorizedEmail: user.email,
  });

  // Safety limit: reject poems that are too large for translation
  const MAX_POEM_LINES = parseInt(
    process.env.MAX_POEM_LINES_FOR_TRANSLATION || "200",
    10
  );
  const totalLines = context.stanzaResult.stanzas.reduce(
    (sum: number, s: { lines: unknown[] }) => sum + (s.lines?.length ?? 0),
    0
  );
  if (totalLines > MAX_POEM_LINES) {
    return NextResponse.json(
      {
        error: `Poem too large for translation (${totalLines} lines, max ${MAX_POEM_LINES})`,
      },
      { status: 400 }
    );
  }

  // Detect model change so we can force-clear the old tick's resources after
  // the new job is created. workshop_lines cleanup is handled atomically
  // inside createTranslationJob (same writeThreadState call) to avoid
  // interleaving with the old tick's writes.
  const existingJob = await getTranslationJob(threadId);
  const requestedModel = (context.guideAnswers as Record<string, unknown>)?.translationModel;
  const existingModel = (existingJob?.guide_preferences as Record<string, unknown> | undefined)?.translationModel;
  const modelChanged = !!(existingJob && requestedModel && requestedModel !== existingModel);

  if (modelChanged) {
    console.log(
      `[initialize-translations] Model changed (${existingModel} → ${requestedModel}). Job will be replaced.`
    );
  }

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

  // When replacing an in-progress job (model switch), the old tick may still
  // hold the per-thread Redis lock and occupy the queue active set. Force-clear
  // both so the new job can be enqueued and processed immediately.
  // Safety: the OCC version check in writeThreadState catches any stale writes
  // from the old tick — it will fail with "Translation job modified concurrently"
  // and stop gracefully.
  let alreadyEnqueued = false;

  if (modelChanged) {
    try {
      const redis = await getUpstashRedis();
      if (redis) {
        // 1. Release the tick lock so the old tick can't block the new job
        const tickKey = `tick:${threadId}`;
        await (redis as { del: (key: string) => Promise<number> }).del(tickKey);
        console.log(`[initialize-translations] Force-released tick lock: ${tickKey}`);
      }
    } catch (error) {
      // Non-fatal: lock will expire via its 10-minute TTL naturally
      console.warn("[initialize-translations] Failed to force-release tick lock:", error);
    }

    try {
      // 2. Remove from queue active set so re-enqueue is accepted
      await deactivateTranslationJob(threadId);
      // 3. Enqueue the new job for processing
      const result = await enqueueTranslationJob(threadId, { userId: user.id });
      alreadyEnqueued = true;
      if (!result.enqueued) {
        console.warn(`[initialize-translations] Re-enqueue after model change rejected: ${result.reason}`);
      }
    } catch (error) {
      console.error("[initialize-translations] Failed to re-enqueue after model change:", error);
    }
  }

  // Enqueue translation job for background processing (skip if already
  // enqueued above during model-change handling to avoid double-enqueue)
  if (!alreadyEnqueued) {
    const enqueueResult = await enqueueTranslationJob(threadId, {
      userId: user.id,
    }).catch((error) => {
      console.error("[initialize-translations] Failed to enqueue job:", error);
      return { enqueued: false, reason: "error" } as const;
    });

    if (!enqueueResult.enqueued) {
      console.warn(
        `[initialize-translations] Enqueue rejected: ${enqueueResult.reason}`
      );
    }
  }

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
      authorizedEmail: user.email,
    });
  }

  let latestJob: Awaited<ReturnType<typeof getTranslationJob>> = null;
  try {
    latestJob = await getTranslationJob(threadId);
  } catch (err) {
    console.error("[initialize-translations] Failed to fetch job after creation:", err);
  }
  const progress = latestJob ? summarizeTranslationJob(latestJob) : null;

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
