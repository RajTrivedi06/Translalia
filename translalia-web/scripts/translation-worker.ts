#!/usr/bin/env tsx
/**
 * Translation Worker
 *
 * Background worker that processes translation jobs from the queue.
 *
 * Quality invariant: Uses the same runTranslationTick logic as before,
 * so quality checks (phase1, gate, regen) are unchanged.
 *
 * Usage:
 *   npm run worker:translations
 *
 * Environment:
 *   - UPSTASH_REDIS_REST_URL (required in production)
 *   - UPSTASH_REDIS_REST_TOKEN (required in production)
 */

import { runTranslationTick } from "../src/lib/workshop/runTranslationTick";
import {
  getTranslationJob,
  updateLineAlignment,
} from "../src/lib/workshop/jobState";
import {
  getQueueRedis,
  deactivateTranslationJob,
  getTranslationActiveSetInfo,
  removeFromTranslationActiveSet,
  parseQueueMessage,
  reenqueueWithRetry,
  type StructuredQueueMessage,
} from "../src/lib/workshop/translationQueue";
import {
  getAlignmentQueueRedis,
  deactivateAlignmentJob,
  getAlignmentQueueConfig,
  getAlignmentActiveSetInfo,
  removeFromAlignmentActiveSet,
  type AlignmentJob,
} from "../src/lib/workshop/alignmentQueue";
import { generateAlignmentsBatched } from "../src/lib/ai/alignmentGenerator";

const QUEUE_KEY = "translation:queue";
const TICK_BUDGET_MS = 15000; // 15 seconds per tick (quality-safe, won't finalize partial lines)
const POLL_INTERVAL_MS = 2000; // 2 seconds between polls when queue is empty
const GC_INTERVAL_TICKS = 50; // Run active-set GC every N main-loop iterations
const STALE_THRESHOLD_MS = parseInt(
  process.env.WORKER_STALE_THRESHOLD_MS || String(30 * 60 * 1000),
  10
); // 30 min default
const ENABLE_GC = process.env.ENABLE_WORKER_ACTIVE_SET_GC !== "0";

// Alignment processing state
let activeAlignments = 0;
const alignmentConfig = getAlignmentQueueConfig();

// Track in-flight jobs for periodic GC (member -> dequeue timestamp)
const inFlightTranslation = new Map<string, number>();
const inFlightAlignment = new Map<string, number>();

async function processJob(msg: StructuredQueueMessage): Promise<void> {
  const { threadId } = msg;
  console.log(
    `[translation-worker] Processing job: ${threadId} (attempt ${msg.attempt})`
  );

  try {
    const tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: TICK_BUDGET_MS,
    });

    if (!tickResult) {
      console.log(
        `[translation-worker] No tick result for ${threadId}, job may not exist`
      );
      await deactivateTranslationJob(threadId);
      inFlightTranslation.delete(threadId);
      return;
    }

    const job = await getTranslationJob(threadId);
    if (!job) {
      console.log(`[translation-worker] Job not found: ${threadId}`);
      await deactivateTranslationJob(threadId);
      inFlightTranslation.delete(threadId);
      return;
    }

    if (job.status === "completed" || job.status === "failed") {
      console.log(
        `[translation-worker] Job ${threadId} finished with status: ${job.status}`
      );
      await deactivateTranslationJob(threadId);
      inFlightTranslation.delete(threadId);
      return;
    }

    // Job made progress — reset attempt count for re-enqueue
    const delay = 1000;
    console.log(
      `[translation-worker] Job ${threadId} still processing, re-enqueuing after ${delay}ms`
    );

    setTimeout(async () => {
      await reenqueueWithRetry({
        ...msg,
        attempt: 0, // Reset: progress was made this tick
      }).catch((err) =>
        console.error(`[translation-worker] Re-enqueue failed:`, err)
      );
    }, delay);
  } catch (error) {
    console.error(`[translation-worker] Error processing ${threadId}:`, error);
    const failureClass =
      error instanceof Error ? error.constructor.name : "UnknownError";

    const errorDelay = 5000;
    setTimeout(async () => {
      await reenqueueWithRetry({
        ...msg,
        failureClass,
      }).catch((err) =>
        console.error(`[translation-worker] Re-enqueue after error failed:`, err)
      );
    }, errorDelay);
  }
}

async function processAlignmentJob(job: AlignmentJob): Promise<void> {
  console.log(
    `[translation-worker] Processing alignment: line ${
      job.lineIndex
    } (thread ${job.threadId.slice(0, 8)})`
  );

  activeAlignments++;
  const startTime = Date.now();

  try {
    // Generate alignments for all 3 variants in a single batched call (1 API call instead of 3)
    const alignments = await generateAlignmentsBatched(
      job.lineText,
      job.variantTexts,
      job.sourceLanguage,
      job.targetLanguage
    );

    // Update line in DB with alignments
    await updateLineAlignment(
      job.threadId,
      job.stanzaIndex,
      job.lineIndex,
      alignments,
      "ready"
    );

    const duration = Date.now() - startTime;
    console.log(
      `[translation-worker] Alignment complete: line ${job.lineIndex} (${duration}ms)`
    );
  } catch (error) {
    console.error(
      `[translation-worker] Alignment error for line ${job.lineIndex}:`,
      error
    );

    // Create fallback alignments (simple word-to-word mapping)
    const sourceWords = job.lineText.trim().split(/\s+/);
    const fallbackAlignments = job.variantTexts.map((translatedText) => {
      const translationWords = translatedText.trim().split(/\s+/);
      return sourceWords.map((word, idx) => ({
        original: word,
        translation: translationWords[idx] ?? word,
        partOfSpeech: "neutral",
        position: idx,
      }));
    });

    // Update with fallback alignments
    await updateLineAlignment(
      job.threadId,
      job.stanzaIndex,
      job.lineIndex,
      fallbackAlignments,
      "ready" // Still mark as ready even with fallback
    ).catch((updateError) => {
      console.error(
        `[translation-worker] Failed to update alignment for line ${job.lineIndex}:`,
        updateError
      );
    });
  } finally {
    activeAlignments--;
    await deactivateAlignmentJob(job.threadId, job.lineIndex);
    inFlightAlignment.delete(`${job.threadId}:${job.lineIndex}`);
  }
}

/**
 * Startup self-heal: clear ALL entries from active sets.
 *
 * ASSUMPTION: This worker is the sole consumer. On restart, nothing from
 * a previous run is genuinely in-progress. Items still in the queue list
 * will be re-processed naturally.
 *
 * WARNING: If you ever run multiple worker instances, this function must
 * be changed to use age-based filtering (like periodicActiveSetGC does)
 * instead of blanket removal. Otherwise it will evict entries that another
 * instance is actively processing.
 */
async function startupActiveSetCleanup(): Promise<void> {
  if (!ENABLE_GC) {
    console.log(
      "[translation-worker] Active-set GC disabled (ENABLE_WORKER_ACTIVE_SET_GC=0)"
    );
    return;
  }

  console.log(
    "[translation-worker] Running startup active-set cleanup..."
  );

  const translationInfo = await getTranslationActiveSetInfo();
  const alignmentInfo = await getAlignmentActiveSetInfo();

  console.log(
    `[translation-worker] Active sets before cleanup: ` +
      `translation=${translationInfo.size}, alignment=${alignmentInfo.size}`
  );

  if (translationInfo.members.length > 0) {
    const removed = await removeFromTranslationActiveSet(
      translationInfo.members
    );
    console.log(
      `[translation-worker] Cleared ${removed} stale translation active-set entries`
    );
  }

  if (alignmentInfo.members.length > 0) {
    const removed = await removeFromAlignmentActiveSet(
      alignmentInfo.members
    );
    console.log(
      `[translation-worker] Cleared ${removed} stale alignment active-set entries`
    );
  }

  console.log("[translation-worker] Startup cleanup complete");
}

/**
 * Periodic GC: remove active-set entries that this worker instance
 * hasn't touched within STALE_THRESHOLD_MS. Protects against
 * re-enqueue failures leaving phantom entries.
 */
async function periodicActiveSetGC(): Promise<void> {
  if (!ENABLE_GC) return;

  const now = Date.now();

  const translationInfo = await getTranslationActiveSetInfo();
  const staleTranslation = translationInfo.members.filter((id) => {
    const seen = inFlightTranslation.get(id);
    return !seen || now - seen > STALE_THRESHOLD_MS;
  });

  if (staleTranslation.length > 0) {
    const removed = await removeFromTranslationActiveSet(staleTranslation);
    for (const id of staleTranslation) inFlightTranslation.delete(id);
    console.log(
      `[translation-worker] GC removed ${removed} stale translation entries`
    );
  }

  const alignmentInfo = await getAlignmentActiveSetInfo();
  const staleAlignment = alignmentInfo.members.filter((id) => {
    const seen = inFlightAlignment.get(id);
    return !seen || now - seen > STALE_THRESHOLD_MS;
  });

  if (staleAlignment.length > 0) {
    const removed = await removeFromAlignmentActiveSet(staleAlignment);
    for (const id of staleAlignment) inFlightAlignment.delete(id);
    console.log(
      `[translation-worker] GC removed ${removed} stale alignment entries`
    );
  }
}

async function main() {
  console.log("[translation-worker] Starting translation worker...");
  console.log(`[translation-worker] Tick budget: ${TICK_BUDGET_MS}ms`);
  console.log(`[translation-worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(
    `[translation-worker] Max concurrent alignments: ${alignmentConfig.maxConcurrent}`
  );
  console.log(
    `[translation-worker] GC: enabled=${ENABLE_GC}, interval=${GC_INTERVAL_TICKS} ticks, stale=${STALE_THRESHOLD_MS}ms`
  );

  const redis = await getQueueRedis();
  const alignmentRedis = await getAlignmentQueueRedis();

  if (!redis || !alignmentRedis) {
    if (process.env.NODE_ENV === "production") {
      console.error("[translation-worker] ERROR: Redis required in production");
      process.exit(1);
    }
    console.warn(
      "[translation-worker] WARNING: Redis not configured, worker will not process jobs"
    );
    console.warn(
      "[translation-worker] Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
    );
    return;
  }

  // Startup self-heal: flush stale active-set entries
  await startupActiveSetCleanup();

  console.log("[translation-worker] Connected to Redis, polling for jobs...");

  let tickCount = 0;

  // Process both translation and alignment queues
  while (true) {
    tickCount++;

    // Periodic GC runs regardless of queue state
    if (tickCount % GC_INTERVAL_TICKS === 0) {
      await periodicActiveSetGC().catch((err) =>
        console.error("[translation-worker] GC error:", err)
      );
    }

    try {
      // Priority 1: Process alignment jobs (if under concurrency cap)
      if (activeAlignments < alignmentConfig.maxConcurrent) {
        const alignmentJobData = await (
          alignmentRedis as {
            rpop: (key: string) => Promise<string | null>;
          }
        ).rpop(alignmentConfig.queueKey);

        if (alignmentJobData) {
          try {
            const alignmentJob: AlignmentJob = JSON.parse(alignmentJobData);
            const alignKey = `${alignmentJob.threadId}:${alignmentJob.lineIndex}`;
            inFlightAlignment.set(alignKey, Date.now());
            // Process alignment asynchronously (don't await - allows processing multiple)
            processAlignmentJob(alignmentJob).catch((error) => {
              console.error(
                `[translation-worker] Alignment job failed:`,
                error
              );
            });
          } catch (parseError) {
            console.error(
              `[translation-worker] Failed to parse alignment job:`,
              parseError
            );
          }
          continue; // Check alignment queue again before translation queue
        }
      }

      // Priority 2: Process translation jobs
      const rawMsg = await (
        redis as {
          rpop: (key: string) => Promise<string | null>;
        }
      ).rpop(QUEUE_KEY);

      if (rawMsg) {
        const msg = parseQueueMessage(rawMsg);
        inFlightTranslation.set(msg.threadId, Date.now());
        await processJob(msg);
        continue; // Process next job immediately
      }

      // No jobs in either queue, wait before polling again
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      console.error("[translation-worker] Error in main loop:", error);
      // Wait before retrying to avoid tight error loop
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(
    "[translation-worker] Received SIGINT, shutting down gracefully..."
  );
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(
    "[translation-worker] Received SIGTERM, shutting down gracefully..."
  );
  process.exit(0);
});

main().catch((error) => {
  console.error("[translation-worker] Fatal error:", error);
  process.exit(1);
});
