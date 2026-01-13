import crypto from "crypto";
import { randomUUID } from "crypto";

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
 *
 * HARDENING: Uses UUID tokens and Lua compare-and-delete to prevent:
 * - Releasing someone else's lock after TTL expiry
 * - Race conditions when multiple processes compete for the same lock
 */
export const lockHelper = {
  /**
   * Atomic acquire: Redis SET ... NX EX with UUID token.
   * Returns the token if acquired, null if lock already held.
   * IMPORTANT: Caller must store and pass this token to release().
   */
  async acquire(key: string, ttlSec: number): Promise<string | null> {
    const token = randomUUID();

    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }
      // SET key <uuid> NX EX ttlSec - returns "OK" if acquired, null if already exists
      const result = await (
        redis as {
          set: (
            key: string,
            value: string,
            opts: { nx: boolean; ex: number }
          ) => Promise<string | null>;
        }
      ).set(key, token, { nx: true, ex: ttlSec });

      return result === "OK" ? token : null;
    }

    // DEV ONLY: In-memory fallback (NOT safe for Vercel/serverless!)
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[lockHelper] Using in-memory lock (dev only, not safe for production)"
      );
    }
    const existing = await cacheGet<string>(key);
    if (existing) return null;
    await cacheSet(key, token, ttlSec);
    return token;
  },

  /**
   * Safe release: Only deletes the lock if we still own it (token matches).
   * Uses Lua compare-and-delete script for atomicity in Redis.
   * Prevents releasing someone else's lock after TTL expiry.
   *
   * @param key - The lock key
   * @param token - The token returned by acquire() (required)
   */
  async release(key: string, token: string): Promise<void> {
    if (!token) {
      console.warn("[lockHelper.release] No token provided, skipping release");
      return;
    }

    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }

      // Lua script for atomic compare-and-delete:
      // Only deletes if the current value equals our token
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      try {
        await (
          redis as {
            eval: (
              script: string,
              keys: string[],
              args: string[]
            ) => Promise<number>;
          }
        ).eval(luaScript, [key], [token]);
      } catch (err) {
        // Fallback for Redis clients that don't support eval directly
        // Check-then-delete (not atomic, but better than unconditional delete)
        const currentValue = await (
          redis as { get: (key: string) => Promise<string | null> }
        ).get(key);
        if (currentValue === token) {
          await (redis as { del: (key: string) => Promise<number> }).del(key);
        }
      }
      return;
    }

    // DEV ONLY: In-memory compare-and-delete
    const existing = await cacheGet<string>(key);
    if (existing === token) {
      await cacheDelete(key);
    }
  },
};

/**
 * Sleep helper for backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
