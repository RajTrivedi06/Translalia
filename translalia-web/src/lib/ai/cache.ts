import crypto from "crypto";

const mem = new Map<string, { expires: number; value: unknown }>();

export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    mem.delete(key);
    return null;
  }
  return item.value as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}

/**
 * Delete a key from the cache.
 * CRITICAL: Use this for lock release, NOT cacheSet(key, null, 0)
 */
export async function cacheDelete(key: string): Promise<void> {
  mem.delete(key);
}

// =============================================================================
// Upstash Redis Lock Helpers
// =============================================================================

// Lazy-initialized Redis client singleton
let redisClient: unknown = null;

/**
 * Get Upstash Redis client (lazy-initialized singleton)
 * Returns null if not configured in development, throws in production
 */
export async function getUpstashRedis(): Promise<unknown> {
  if (redisClient) return redisClient;

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for atomic locking"
      );
    }
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  } catch (error) {
    console.error("[cache] Failed to initialize Upstash Redis:", error);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    return null;
  }
}

/**
 * Lock helper with explicit acquire/release semantics.
 * CRITICAL: In-memory fallback is DEV-ONLY. Production MUST use Upstash Redis.
 */
export const lockHelper = {
  /**
   * Atomic acquire: Redis SET ... NX EX (returns true only if lock acquired)
   */
  async acquire(key: string, ttlSec: number): Promise<boolean> {
    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }
      // SET key "1" NX EX ttlSec - returns "OK" if acquired, null if already exists
      const result = await (
        redis as {
          set: (
            key: string,
            value: string,
            opts: { nx: boolean; ex: number }
          ) => Promise<string | null>;
        }
      ).set(key, "1", { nx: true, ex: ttlSec });
      return result === "OK";
    }

    // DEV ONLY: In-memory fallback (NOT safe for Vercel/serverless!)
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[lockHelper] Using in-memory lock (dev only, not safe for production)"
      );
    }
    const existing = await cacheGet<string>(key);
    if (existing) return false;
    await cacheSet(key, "locked", ttlSec);
    return true;
  },

  /**
   * Explicit release: Redis DEL (MUST be a real delete, not set-to-null)
   */
  async release(key: string): Promise<void> {
    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }
      await (redis as { del: (key: string) => Promise<number> }).del(key);
      return;
    }

    // DEV ONLY: In-memory delete
    await cacheDelete(key);
  },
};

/**
 * Sleep helper for backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
