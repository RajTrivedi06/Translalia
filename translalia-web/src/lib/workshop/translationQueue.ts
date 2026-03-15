/**
 * Translation Job Queue
 *
 * Enqueues translation jobs for background processing by worker.
 * Uses Redis for queue management, falls back to in-memory for dev.
 *
 * Queue messages support two formats:
 * - Legacy: raw threadId string
 * - Structured: JSON with threadId, attempt, enqueuedAt, failureClass, traceId
 * The worker handles both formats for safe deploy-order rollout.
 */

import { getUpstashRedis } from "@/lib/ai/cache";

const QUEUE_KEY = "translation:queue";
const MAX_QUEUE_DEPTH = parseInt(
  process.env.TRANSLATION_MAX_QUEUE_DEPTH || "100",
  10
);
const MAX_RETRY_ATTEMPTS = 5;
const DLQ_KEY = "translation:dlq";

export interface StructuredQueueMessage {
  threadId: string;
  attempt: number;
  enqueuedAt: number;
  failureClass?: string;
  traceId?: string;
  userId?: string;
}

/**
 * Parse a queue message — handles:
 * 1. Already-parsed objects (Upstash auto-deserializes JSON from rpop)
 * 2. JSON strings (structured format)
 * 3. Raw threadId strings (legacy format)
 */
export function parseQueueMessage(raw: string | object): StructuredQueueMessage {
  // Upstash rpop auto-deserializes JSON, so raw may already be an object
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.threadId === "string") {
      return {
        threadId: obj.threadId,
        attempt: (obj.attempt as number) ?? 1,
        enqueuedAt: (obj.enqueuedAt as number) ?? Date.now(),
        failureClass: obj.failureClass as string | undefined,
        traceId: obj.traceId as string | undefined,
        userId: obj.userId as string | undefined,
      };
    }
  }

  const str = String(raw);
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object" && parsed.threadId) {
      return {
        threadId: parsed.threadId,
        attempt: parsed.attempt ?? 1,
        enqueuedAt: parsed.enqueuedAt ?? Date.now(),
        failureClass: parsed.failureClass,
        traceId: parsed.traceId,
        userId: parsed.userId,
      };
    }
  } catch {
    // Not JSON — treat as raw threadId (legacy format)
  }
  return {
    threadId: str,
    attempt: 1,
    enqueuedAt: Date.now(),
  };
}

function serializeQueueMessage(msg: StructuredQueueMessage): string {
  return JSON.stringify(msg);
}

/**
 * Enqueue a translation job for background processing.
 *
 * Admission control:
 * - Rejects if queue depth exceeds MAX_QUEUE_DEPTH.
 * - Deduplicates via active set (SADD).
 */
export async function enqueueTranslationJob(
  threadId: string,
  options?: { userId?: string; traceId?: string }
): Promise<{ enqueued: boolean; reason?: string }> {
  const redis = await getUpstashRedis();

  if (!redis) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[translationQueue] Dev mode: would enqueue ${threadId} (Redis not configured)`
      );
      return { enqueued: true };
    }
    throw new Error("Redis required for translation queue in production");
  }

  try {
    // Admission control: check queue depth
    const queueDepth = await (
      redis as { llen: (key: string) => Promise<number> }
    ).llen(QUEUE_KEY);

    if (queueDepth >= MAX_QUEUE_DEPTH) {
      console.warn(
        `[translationQueue] Queue full (${queueDepth}/${MAX_QUEUE_DEPTH}), rejecting ${threadId}`
      );
      return { enqueued: false, reason: "queue_full" };
    }

    // De-dupe: Use SADD to track active jobs
    const activeKey = `${QUEUE_KEY}:active`;
    const wasAdded = await (
      redis as { sadd: (key: string, member: string) => Promise<number> }
    ).sadd(activeKey, threadId);

    if (wasAdded > 0) {
      const msg: StructuredQueueMessage = {
        threadId,
        attempt: 1,
        enqueuedAt: Date.now(),
        traceId: options?.traceId,
        userId: options?.userId,
      };
      await (
        redis as {
          lpush: (key: string, ...values: string[]) => Promise<number>;
        }
      ).lpush(QUEUE_KEY, serializeQueueMessage(msg));
      console.log(`[translationQueue] Enqueued job: ${threadId}`);
      return { enqueued: true };
    } else {
      console.log(
        `[translationQueue] Job already active, skipping: ${threadId}`
      );
      return { enqueued: false, reason: "already_active" };
    }
  } catch (error) {
    console.error(`[translationQueue] Failed to enqueue ${threadId}:`, error);
    throw error;
  }
}

/**
 * Re-enqueue a job with incremented attempt count.
 * If max retries exceeded, move to DLQ instead.
 */
export async function reenqueueWithRetry(
  msg: StructuredQueueMessage
): Promise<{ reenqueued: boolean; dlq: boolean }> {
  const redis = await getUpstashRedis();
  if (!redis) return { reenqueued: false, dlq: false };

  const nextAttempt = msg.attempt + 1;

  if (nextAttempt > MAX_RETRY_ATTEMPTS) {
    console.warn(
      `[translationQueue] Job ${msg.threadId} exceeded max retries (${MAX_RETRY_ATTEMPTS}), moving to DLQ`
    );
    try {
      await (
        redis as {
          lpush: (key: string, ...values: string[]) => Promise<number>;
        }
      ).lpush(
        DLQ_KEY,
        serializeQueueMessage({ ...msg, attempt: nextAttempt })
      );
    } catch (err) {
      console.error(
        `[translationQueue] Failed to move ${msg.threadId} to DLQ:`,
        err
      );
    }
    await deactivateTranslationJob(msg.threadId);
    return { reenqueued: false, dlq: true };
  }

  const updated: StructuredQueueMessage = {
    ...msg,
    attempt: nextAttempt,
    enqueuedAt: Date.now(),
  };

  try {
    await (
      redis as {
        lpush: (key: string, ...values: string[]) => Promise<number>;
      }
    ).lpush(QUEUE_KEY, serializeQueueMessage(updated));
    console.log(
      `[translationQueue] Re-enqueued ${msg.threadId} (attempt ${nextAttempt}/${MAX_RETRY_ATTEMPTS})`
    );
    return { reenqueued: true, dlq: false };
  } catch (err) {
    console.error(
      `[translationQueue] Failed to re-enqueue ${msg.threadId}:`,
      err
    );
    return { reenqueued: false, dlq: false };
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
 * Get the current size and members of the translation active set.
 * Used by the worker for startup cleanup and periodic GC.
 */
export async function getTranslationActiveSetInfo(): Promise<{
  size: number;
  members: string[];
}> {
  const redis = await getUpstashRedis();
  if (!redis) return { size: 0, members: [] };

  const activeKey = `${QUEUE_KEY}:active`;
  const members = await (
    redis as { smembers: (key: string) => Promise<string[]> }
  ).smembers(activeKey);

  return { size: members?.length ?? 0, members: members ?? [] };
}

/**
 * Remove specific members from the translation active set.
 * Used by worker GC to clear stale entries.
 */
export async function removeFromTranslationActiveSet(
  threadIds: string[]
): Promise<number> {
  if (threadIds.length === 0) return 0;
  const redis = await getUpstashRedis();
  if (!redis) return 0;

  const activeKey = `${QUEUE_KEY}:active`;
  let removed = 0;
  for (const id of threadIds) {
    removed += await (
      redis as { srem: (key: string, member: string) => Promise<number> }
    ).srem(activeKey, id);
  }
  return removed;
}

/**
 * Get Redis client for worker (used by worker script)
 */
export async function getQueueRedis() {
  return getUpstashRedis();
}
