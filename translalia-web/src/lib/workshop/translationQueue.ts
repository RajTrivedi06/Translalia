/**
 * Translation Job Queue
 *
 * Enqueues translation jobs for background processing by worker.
 * Uses Redis for queue management, falls back to in-memory for dev.
 */

import { getUpstashRedis } from "@/lib/ai/cache";

const QUEUE_KEY = "translation:queue";

/**
 * Enqueue a translation job for background processing
 *
 * Quality invariant: This only enqueues the job. The worker will call
 * runTranslationTick which respects the same quality checks as before.
 */
export async function enqueueTranslationJob(threadId: string): Promise<void> {
  const redis = await getUpstashRedis();

  if (!redis) {
    // Dev fallback: log and continue (worker can poll DB if needed)
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[translationQueue] Dev mode: would enqueue ${threadId} (Redis not configured)`
      );
      return;
    }
    throw new Error("Redis required for translation queue in production");
  }

  try {
    // Use Redis LPUSH to add to queue (left push = FIFO)
    // De-dupe: Use SADD to track active jobs, only push if not already processing
    const activeKey = `${QUEUE_KEY}:active`;
    const wasAdded = await (
      redis as { sadd: (key: string, member: string) => Promise<number> }
    ).sadd(activeKey, threadId);

    if (wasAdded > 0) {
      // Not already in active set, add to queue
      await (
        redis as {
          lpush: (key: string, ...values: string[]) => Promise<number>;
        }
      ).lpush(QUEUE_KEY, threadId);
      console.log(`[translationQueue] Enqueued job: ${threadId}`);
    } else {
      // Already in active set, skip (prevents duplicates)
      console.log(
        `[translationQueue] Job already active, skipping: ${threadId}`
      );
    }
  } catch (error) {
    console.error(`[translationQueue] Failed to enqueue ${threadId}:`, error);
    throw error;
  }
}

/**
 * Remove a job from the active set (called by worker when done)
 */
export async function deactivateTranslationJob(
  threadId: string
): Promise<void> {
  const redis = await getUpstashRedis();
  if (!redis) return;

  try {
    const activeKey = `${QUEUE_KEY}:active`;
    await (
      redis as { srem: (key: string, member: string) => Promise<number> }
    ).srem(activeKey, threadId);
  } catch (error) {
    console.error(
      `[translationQueue] Failed to deactivate ${threadId}:`,
      error
    );
    // Non-fatal, continue
  }
}

/**
 * Get Redis client for worker (used by worker script)
 */
export async function getQueueRedis() {
  return getUpstashRedis();
}
