import crypto from "crypto";
import { randomUUID } from "crypto";

// =============================================================================
// In-Memory Fallback (DEV ONLY)
// =============================================================================
// This Map is ONLY used when Redis is not configured (local development).
// On Vercel/serverless, this is useless because each function instance has
// its own memory that's wiped after ~10-30 seconds of inactivity.
const mem = new Map<string, { expires: number; value: unknown }>();

// =============================================================================
// Utility Functions
// =============================================================================

export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort(),
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}

// =============================================================================
// Upstash Redis Client (Lazy-Initialized Singleton)
// =============================================================================

let redisClient: unknown = null;

/**
 * Get Upstash Redis client (lazy-initialized singleton)
 * Returns null if not configured in development, throws in production
 * ✅ CRITICAL: If USE_REDIS_LOCK=true is set, always throws if Redis is missing
 */
export async function getUpstashRedis(): Promise<unknown> {
  if (redisClient) return redisClient;

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    // ✅ FAIL FAST: If USE_REDIS_LOCK=true is set, Redis is REQUIRED (no graceful fallback)
    if (process.env.USE_REDIS_LOCK === "true") {
      throw new Error(
        `USE_REDIS_LOCK=true is set but Redis is not configured. ` +
          `Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables. ` +
          `In-memory locks are not safe for multi-process/serverless environments.`,
      );
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for atomic locking",
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

// =============================================================================
// Cache Functions (Now Redis-backed!)
// =============================================================================
// These functions now use Upstash Redis in production/serverless environments,
// with in-memory fallback for local development without Redis configured.
//
// KEY INSIGHT: The same Redis instance is used for:
// - LLM response caching (this section)
// - Distributed locks (lockHelper below)
// - Rate limiting (separate file)
// - Job queues (separate file)
//
// We prefix cache keys with "cache:" to avoid collisions with lock keys.

/**
 * Get a cached value by key.
 *
 * Production/Vercel: Reads from Upstash Redis (shared across all instances)
 * Development: Falls back to in-memory Map (not shared, but fine for local dev)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const prefixedKey = `cache:${key}`;

  // Production or serverless: use Redis
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_REDIS_LOCK === "true"
  ) {
    try {
      const redis = await getUpstashRedis();
      if (!redis) {
        // Shouldn't happen in production, but handle gracefully
        console.warn("[cacheGet] Redis not available, falling back to memory");
        return memoryGet<T>(key);
      }

      const value = await (
        redis as { get: (key: string) => Promise<string | null> }
      ).get(prefixedKey);

      if (value === null) {
        return null;
      }

      // Upstash Redis automatically deserializes JSON, but let's be safe
      try {
        // If it's already an object (auto-deserialized), return it
        if (typeof value === "object") {
          return value as T;
        }
        // If it's a string, try to parse it
        return JSON.parse(value) as T;
      } catch {
        // If parsing fails, return as-is (might be a simple string)
        return value as T;
      }
    } catch (error) {
      console.error("[cacheGet] Redis error, falling back to memory:", error);
      return memoryGet<T>(key);
    }
  }

  // Development: use in-memory fallback
  return memoryGet<T>(key);
}

/**
 * Set a cached value with TTL.
 *
 * Production/Vercel: Writes to Upstash Redis (persists across instances)
 * Development: Falls back to in-memory Map
 *
 * @param key - Cache key (will be prefixed with "cache:")
 * @param value - Value to cache (will be JSON serialized)
 * @param ttlSec - Time-to-live in seconds (default: 3600 = 1 hour)
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600,
): Promise<void> {
  const prefixedKey = `cache:${key}`;

  // Production or serverless: use Redis
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_REDIS_LOCK === "true"
  ) {
    try {
      const redis = await getUpstashRedis();
      if (!redis) {
        console.warn("[cacheSet] Redis not available, falling back to memory");
        memorySet(key, value, ttlSec);
        return;
      }

      // SET with EX (expiration in seconds)
      // Upstash Redis handles JSON serialization automatically
      await (
        redis as {
          set: (
            key: string,
            value: unknown,
            opts: { ex: number },
          ) => Promise<string | null>;
        }
      ).set(prefixedKey, value, { ex: ttlSec });
    } catch (error) {
      console.error("[cacheSet] Redis error, falling back to memory:", error);
      memorySet(key, value, ttlSec);
    }
    return;
  }

  // Development: use in-memory fallback
  memorySet(key, value, ttlSec);
}

/**
 * Delete a key from the cache.
 * CRITICAL: Use this for explicit cache invalidation.
 */
export async function cacheDelete(key: string): Promise<void> {
  const prefixedKey = `cache:${key}`;

  // Production or serverless: use Redis
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_REDIS_LOCK === "true"
  ) {
    try {
      const redis = await getUpstashRedis();
      if (!redis) {
        console.warn(
          "[cacheDelete] Redis not available, falling back to memory",
        );
        mem.delete(key);
        return;
      }

      await (redis as { del: (key: string) => Promise<number> }).del(
        prefixedKey,
      );
    } catch (error) {
      console.error("[cacheDelete] Redis error:", error);
      mem.delete(key);
    }
    return;
  }

  // Development: use in-memory fallback
  mem.delete(key);
}

// =============================================================================
// In-Memory Helpers (DEV ONLY)
// =============================================================================

function memoryGet<T>(key: string): T | null {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    mem.delete(key);
    return null;
  }
  return item.value as T;
}

function memorySet<T>(key: string, value: T, ttlSec: number): void {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}

// =============================================================================
// Upstash Redis Lock Helpers
// =============================================================================

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
    // ✅ PRIORITY 1 FIX: Set USE_REDIS_LOCK=true in dev for multi-process safety
    // In-memory locks don't work across instances/processes (Vercel/serverless)
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      // ✅ getUpstashRedis() will throw if USE_REDIS_LOCK=true but Redis is missing
      const redis = await getUpstashRedis();
      if (!redis) {
        // This should never happen if USE_REDIS_LOCK=true (getUpstashRedis throws)
        // But handle it defensively for production mode
        throw new Error(
          "Redis required for locking but getUpstashRedis() returned null. " +
            "Check Redis configuration.",
        );
      }
      // SET key <uuid> NX EX ttlSec - returns "OK" if acquired, null if already exists
      const result = await (
        redis as {
          set: (
            key: string,
            value: string,
            opts: { nx: boolean; ex: number },
          ) => Promise<string | null>;
        }
      ).set(key, token, { nx: true, ex: ttlSec });

      return result === "OK" ? token : null;
    }

    // DEV ONLY: In-memory fallback (NOT safe for Vercel/serverless!)
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[lockHelper] Using in-memory lock (dev only, not safe for production)",
      );
    }
    const existing = memoryGet<string>(key);
    if (existing) return null;
    memorySet(key, token, ttlSec);
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
              args: string[],
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
    const existing = memoryGet<string>(key);
    if (existing === token) {
      mem.delete(key);
    }
  },
};

/**
 * Sleep helper for backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Lock Heartbeat System
// =============================================================================

/**
 * Active heartbeat timers, keyed by lock key.
 * Used to stop heartbeats when locks are released.
 */
const activeHeartbeats = new Map<string, NodeJS.Timeout>();

/**
 * Start a heartbeat that periodically extends the lock TTL.
 * This prevents the lock from expiring during long-running operations.
 *
 * The heartbeat uses a Lua script to atomically check the token before extending,
 * ensuring we don't extend a lock we no longer own.
 *
 * @param key - The lock key
 * @param token - The token returned by acquire()
 * @param ttlSec - The TTL to reset to on each heartbeat
 * @param intervalMs - How often to refresh (default: TTL/3)
 * @returns A function to stop the heartbeat
 */
export function startLockHeartbeat(
  key: string,
  token: string,
  ttlSec: number,
  intervalMs?: number,
): () => void {
  // Default interval: refresh at 1/3 of TTL (e.g., 200s for 600s TTL)
  const interval = intervalMs ?? Math.floor((ttlSec * 1000) / 3);

  // Clear any existing heartbeat for this key
  const existingTimer = activeHeartbeats.get(key);
  if (existingTimer) {
    clearInterval(existingTimer);
    activeHeartbeats.delete(key);
  }

  let heartbeatCount = 0;
  const startTime = Date.now();

  const timer = setInterval(async () => {
    heartbeatCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      // Production or explicit Redis flag: use Upstash Redis
      if (
        process.env.NODE_ENV === "production" ||
        process.env.USE_REDIS_LOCK === "true"
      ) {
        const redis = await getUpstashRedis();
        if (!redis) {
          console.warn(
            `[lockHeartbeat] Redis not available, stopping heartbeat for ${key}`,
          );
          clearInterval(timer);
          activeHeartbeats.delete(key);
          return;
        }

        // Lua script: Only extend TTL if we still own the lock (token matches)
        // EXPIRE returns 1 if timeout was set, 0 if key doesn't exist
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
          else
            return -1
          end
        `;

        try {
          const result = await (
            redis as {
              eval: (
                script: string,
                keys: string[],
                args: string[],
              ) => Promise<number>;
            }
          ).eval(luaScript, [key], [token, ttlSec.toString()]);

          if (result === -1) {
            // We no longer own the lock - stop heartbeat
            console.warn(
              `[lockHeartbeat] Lock ${key} no longer owned (token mismatch), stopping heartbeat ` +
                `(beat #${heartbeatCount}, elapsed=${elapsed}s)`,
            );
            clearInterval(timer);
            activeHeartbeats.delete(key);
            return;
          }

          if (result === 0) {
            // Key doesn't exist - stop heartbeat
            console.warn(
              `[lockHeartbeat] Lock ${key} expired/deleted, stopping heartbeat ` +
                `(beat #${heartbeatCount}, elapsed=${elapsed}s)`,
            );
            clearInterval(timer);
            activeHeartbeats.delete(key);
            return;
          }

          console.log(
            `[lockHeartbeat] ❤️ Extended ${key} TTL to ${ttlSec}s ` +
              `(beat #${heartbeatCount}, elapsed=${elapsed}s)`,
          );
        } catch (evalError) {
          // Fallback for Redis clients that don't support eval
          console.warn(
            `[lockHeartbeat] Lua eval failed, using fallback:`,
            evalError,
          );

          const currentValue = await (
            redis as { get: (key: string) => Promise<string | null> }
          ).get(key);

          if (currentValue === token) {
            await (
              redis as {
                expire: (key: string, seconds: number) => Promise<number>;
              }
            ).expire(key, ttlSec);
            console.log(
              `[lockHeartbeat] ❤️ Extended ${key} TTL to ${ttlSec}s (fallback) ` +
                `(beat #${heartbeatCount}, elapsed=${elapsed}s)`,
            );
          } else {
            console.warn(
              `[lockHeartbeat] Lock ${key} no longer owned, stopping heartbeat (fallback)`,
            );
            clearInterval(timer);
            activeHeartbeats.delete(key);
          }
        }
        return;
      }

      // DEV ONLY: In-memory lock extension
      const existing = memoryGet<string>(key);
      if (existing === token) {
        memorySet(key, token, ttlSec);
        console.log(
          `[lockHeartbeat] ❤️ Extended ${key} TTL to ${ttlSec}s (in-memory) ` +
            `(beat #${heartbeatCount}, elapsed=${elapsed}s)`,
        );
      } else {
        console.warn(
          `[lockHeartbeat] Lock ${key} no longer owned (in-memory), stopping heartbeat`,
        );
        clearInterval(timer);
        activeHeartbeats.delete(key);
      }
    } catch (error) {
      console.error(`[lockHeartbeat] Error extending ${key}:`, error);
      // Don't stop on transient errors - the lock might still be valid
    }
  }, interval);

  activeHeartbeats.set(key, timer);

  console.log(
    `[lockHeartbeat] Started heartbeat for ${key} (interval=${interval}ms, TTL=${ttlSec}s)`,
  );

  // Return a function to stop the heartbeat
  return () => {
    clearInterval(timer);
    activeHeartbeats.delete(key);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(
      `[lockHeartbeat] Stopped heartbeat for ${key} (${heartbeatCount} beats, elapsed=${elapsed}s)`,
    );
  };
}

/**
 * Stop all active heartbeats. Useful for cleanup in tests.
 */
export function stopAllHeartbeats(): void {
  for (const [key, timer] of activeHeartbeats.entries()) {
    clearInterval(timer);
    console.log(`[lockHeartbeat] Stopped heartbeat for ${key} (cleanup)`);
  }
  activeHeartbeats.clear();
}
