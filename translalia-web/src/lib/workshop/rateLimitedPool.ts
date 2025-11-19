/**
 * Rate-limited pool for stanza processing
 * Respects global per-user rate limits while managing backoff delays
 */

import { checkRateLimit } from "@/lib/ratelimit/redis";

export interface RateLimitedPoolOptions {
  userId: string;
  limit?: number; // requests per minute
  windowSeconds?: number;
}

export interface DequeueResult {
  stanzas: number[];
  rateLimited: boolean;
  resetAt: number;
  remaining: number;
}

/**
 * Stanza with pending backoff
 */
interface QueuedStanza {
  index: number;
  retryCount: number;
  backoffUntil?: number;
}

/**
 * Rate-limited pool for managing stanza translation
 */
export class RateLimitedPool {
  private userId: string;
  private limit: number;
  private windowSeconds: number;

  constructor(options: RateLimitedPoolOptions) {
    this.userId = options.userId;
    this.limit = options.limit ?? 10; // 10 stanzas per minute
    this.windowSeconds = options.windowSeconds ?? 60; // 1 minute window
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 30000; // 30 seconds
    const delay = baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * Get next stanzas to process, respecting rate limits and backoff
   * @param candidates - Array of candidate stanza indices to process
   * @param stanzaRetries - Map of stanza index to retry count
   * @param stanzaBackoffUntil - Map of stanza index to nextRetryAt timestamp (Feature 7)
   * @returns Stanzas to process now and rate limit status
   */
  async checkAndDequeue(
    candidates: number[],
    stanzaRetries: Record<number, number> = {},
    stanzaBackoffUntil: Record<number, number> = {}
  ): Promise<DequeueResult> {
    const now = Date.now();

    // Filter out stanzas still in backoff period (Feature 7)
    const availableStanzas = candidates.filter((index) => {
      const retryCount = stanzaRetries[index] ?? 0;
      if (retryCount === 0) return true;

      // Check if stanza's backoff has expired
      const nextRetryAt = stanzaBackoffUntil[index];
      if (nextRetryAt === undefined) return true; // No backoff set, allow immediately

      // Skip if backoff hasn't expired yet
      if (now < nextRetryAt) {
        console.debug(
          `[RateLimitedPool] Stanza ${index} backoff expires in ${((nextRetryAt - now) / 1000).toFixed(1)}s`
        );
        return false;
      }

      return true;
    });

    if (availableStanzas.length === 0) {
      return {
        stanzas: [],
        rateLimited: false,
        resetAt: now + this.windowSeconds * 1000,
        remaining: this.limit,
      };
    }

    // Check rate limit for this user
    const rateLimitKey = `workshop:stanza-processing:${this.userId}`;
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      this.limit,
      this.windowSeconds
    );

    if (!rateLimitResult.success) {
      // Rate limit exceeded
      return {
        stanzas: [],
        rateLimited: true,
        resetAt: rateLimitResult.reset,
        remaining: 0,
      };
    }

    // Dequeue stanzas up to remaining limit
    const dequeueCount = Math.min(
      availableStanzas.length,
      rateLimitResult.remaining
    );

    return {
      stanzas: availableStanzas.slice(0, dequeueCount),
      rateLimited: false,
      resetAt: rateLimitResult.reset,
      remaining: rateLimitResult.remaining - dequeueCount,
    };
  }

  /**
   * Get rate limit info without dequeuing
   */
  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    reset: number;
  }> {
    const rateLimitKey = `workshop:stanza-processing:${this.userId}`;
    const result = await checkRateLimit(
      rateLimitKey,
      this.limit,
      this.windowSeconds
    );

    return {
      remaining: result.remaining,
      limit: this.limit,
      reset: result.reset,
    };
  }
}

/**
 * Factory function to create a rate limited pool
 */
export function createRateLimitedPool(
  userId: string,
  options?: { limit?: number; windowSeconds?: number }
): RateLimitedPool {
  return new RateLimitedPool({
    userId,
    ...options,
  });
}
