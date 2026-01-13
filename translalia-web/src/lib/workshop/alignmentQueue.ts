/**
 * Alignment Job Queue
 *
 * Enqueues alignment jobs for background processing.
 * Separate from translation queue to allow independent concurrency control.
 */

import { getUpstashRedis } from "@/lib/ai/cache";

const ALIGNMENT_QUEUE_KEY = "alignment:queue";
const ALIGNMENT_ACTIVE_KEY = "alignment:queue:active";
const MAX_CONCURRENT_ALIGNMENTS = 2; // Low priority: cap at 1-2 to prevent starving main-gen

export interface AlignmentJob {
  threadId: string;
  lineIndex: number;
  stanzaIndex: number;
  lineText: string;
  variantTexts: string[]; // [variantA, variantB, variantC]
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Enqueue an alignment job for background processing
 *
 * Quality invariant: Alignment is UX metadata only. Translation quality
 * does not depend on alignment. This allows lines to be "ready" immediately
 * after text is finalized, with alignment added asynchronously.
 */
export async function enqueueAlignmentJob(job: AlignmentJob): Promise<void> {
  const redis = await getUpstashRedis();

  if (!redis) {
    // Dev fallback: log and continue
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[alignmentQueue] Dev mode: would enqueue alignment for line ${job.lineIndex} (Redis not configured)`
      );
      return;
    }
    throw new Error("Redis required for alignment queue in production");
  }

  try {
    // De-dupe: Use SADD to track active alignment jobs
    const wasAdded = await (
      redis as { sadd: (key: string, member: string) => Promise<number> }
    ).sadd(ALIGNMENT_ACTIVE_KEY, `${job.threadId}:${job.lineIndex}`);

    if (wasAdded > 0) {
      // Not already in active set, add to queue
      const jobData = JSON.stringify(job);
      await (
        redis as {
          lpush: (key: string, ...values: string[]) => Promise<number>;
        }
      ).lpush(ALIGNMENT_QUEUE_KEY, jobData);
      console.log(
        `[alignmentQueue] Enqueued alignment job: line ${
          job.lineIndex
        } (thread ${job.threadId.slice(0, 8)})`
      );
    } else {
      // Already in active set, skip (prevents duplicates)
      console.log(
        `[alignmentQueue] Alignment job already active, skipping: line ${job.lineIndex}`
      );
    }
  } catch (error) {
    console.error(
      `[alignmentQueue] Failed to enqueue alignment job for line ${job.lineIndex}:`,
      error
    );
    throw error;
  }
}

/**
 * Remove an alignment job from the active set (called by worker when done)
 */
export async function deactivateAlignmentJob(
  threadId: string,
  lineIndex: number
): Promise<void> {
  const redis = await getUpstashRedis();
  if (!redis) return;

  try {
    await (
      redis as { srem: (key: string, member: string) => Promise<number> }
    ).srem(ALIGNMENT_ACTIVE_KEY, `${threadId}:${lineIndex}`);
  } catch (error) {
    console.error(
      `[alignmentQueue] Failed to deactivate alignment job for line ${lineIndex}:`,
      error
    );
    // Non-fatal, continue
  }
}

/**
 * Get Redis client for alignment worker
 */
export async function getAlignmentQueueRedis() {
  return getUpstashRedis();
}

/**
 * Get alignment queue constants
 */
export function getAlignmentQueueConfig() {
  return {
    queueKey: ALIGNMENT_QUEUE_KEY,
    activeKey: ALIGNMENT_ACTIVE_KEY,
    maxConcurrent: MAX_CONCURRENT_ALIGNMENTS,
  };
}
