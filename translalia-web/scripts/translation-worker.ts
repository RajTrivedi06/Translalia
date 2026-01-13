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
} from "../src/lib/workshop/translationQueue";
import {
  getAlignmentQueueRedis,
  deactivateAlignmentJob,
  getAlignmentQueueConfig,
  type AlignmentJob,
} from "../src/lib/workshop/alignmentQueue";
import { generateAlignmentsBatched } from "../src/lib/ai/alignmentGenerator";

const QUEUE_KEY = "translation:queue";
const TICK_BUDGET_MS = 15000; // 15 seconds per tick (quality-safe, won't finalize partial lines)
const POLL_INTERVAL_MS = 2000; // 2 seconds between polls when queue is empty

// Alignment processing state
let activeAlignments = 0;
const alignmentConfig = getAlignmentQueueConfig();

async function processJob(threadId: string): Promise<void> {
  console.log(`[translation-worker] Processing job: ${threadId}`);

  try {
    // Run one tick with budget
    const tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: TICK_BUDGET_MS,
    });

    if (!tickResult) {
      console.log(
        `[translation-worker] No tick result for ${threadId}, job may not exist`
      );
      await deactivateTranslationJob(threadId);
      return;
    }

    // Check if job is complete
    const job = await getTranslationJob(threadId);
    if (!job) {
      console.log(`[translation-worker] Job not found: ${threadId}`);
      await deactivateTranslationJob(threadId);
      return;
    }

    if (job.status === "completed" || job.status === "failed") {
      console.log(
        `[translation-worker] Job ${threadId} finished with status: ${job.status}`
      );
      await deactivateTranslationJob(threadId);
      return;
    }

    // Job still has work, re-enqueue for next tick
    // Small delay to prevent tight loop if job is stuck
    const delay = 1000; // 1 second
    console.log(
      `[translation-worker] Job ${threadId} still processing, re-enqueuing after ${delay}ms`
    );

    setTimeout(async () => {
      const redis = await getQueueRedis();
      if (redis) {
        try {
          await (
            redis as {
              lpush: (key: string, ...values: string[]) => Promise<number>;
            }
          ).lpush(QUEUE_KEY, threadId);
        } catch (error) {
          console.error(
            `[translation-worker] Failed to re-enqueue ${threadId}:`,
            error
          );
        }
      }
    }, delay);
  } catch (error) {
    console.error(`[translation-worker] Error processing ${threadId}:`, error);
    // Don't deactivate on error - let it retry via re-enqueue logic above
    // But add a longer delay for errors
    const errorDelay = 5000; // 5 seconds
    setTimeout(async () => {
      const redis = await getQueueRedis();
      if (redis) {
        try {
          await (
            redis as {
              lpush: (key: string, ...values: string[]) => Promise<number>;
            }
          ).lpush(QUEUE_KEY, threadId);
        } catch (error) {
          console.error(
            `[translation-worker] Failed to re-enqueue after error:`,
            error
          );
        }
      }
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
  }
}

async function main() {
  console.log("[translation-worker] Starting translation worker...");
  console.log(`[translation-worker] Tick budget: ${TICK_BUDGET_MS}ms`);
  console.log(`[translation-worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(
    `[translation-worker] Max concurrent alignments: ${alignmentConfig.maxConcurrent}`
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

  console.log("[translation-worker] Connected to Redis, polling for jobs...");

  // Process both translation and alignment queues
  while (true) {
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
      const threadId = await (
        redis as {
          rpop: (key: string) => Promise<string | null>;
        }
      ).rpop(QUEUE_KEY);

      if (threadId) {
        await processJob(threadId);
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
