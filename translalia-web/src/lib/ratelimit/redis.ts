/**
 * Rate limiting for verification endpoints
 * Uses Upstash Redis if available, falls back to in-memory for dev
 */

// In-memory fallback for development
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request is within rate limits
 * @param key - Unique identifier for rate limit (e.g., "verify:userId:date")
 * @param limit - Maximum requests allowed in the window
 * @param windowSeconds - Time window in seconds (default: 86400 = 24 hours)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number = 86400
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetTime = now + windowSeconds * 1000;

  // Use Upstash Redis if configured
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const { Redis } = await import("@upstash/redis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (Redis as any)({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      // Increment counter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (client as any).incr(key);

      // Set expiry on first request
      if (count === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).expire(key, windowSeconds);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ttl = await (client as any).ttl(key);
      const resetAt = now + ttl * 1000;

      return {
        success: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        reset: resetAt,
      };
    } catch (error) {
      console.error("[rate-limit] Redis error, falling back to memory:", error);
      // Fall through to memory store
    }
  }

  // In-memory fallback
  const stored = memoryStore.get(key);

  if (!stored || stored.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  // Increment existing window
  stored.count++;
  const success = stored.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - stored.count),
    reset: stored.resetAt,
  };
}

/**
 * Daily rate limit check (legacy compatibility)
 */
export async function checkDailyLimit(
  _userId: string,
  key: string,
  max: number
): Promise<{ allowed: boolean; current: number; max: number }> {
  const result = await checkRateLimit(key, max, 86400);
  return {
    allowed: result.success,
    current: max - result.remaining,
    max,
  };
}

/**
 * Clean up expired entries from memory store (runs periodically)
 */
export function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// Auto-cleanup every hour
if (typeof setInterval !== "undefined") {
  setInterval(cleanupMemoryStore, 3600000);
}
