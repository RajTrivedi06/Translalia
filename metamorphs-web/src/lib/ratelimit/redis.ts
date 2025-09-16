import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let limiter: Ratelimit | null = null;

export function getLimiter() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  )
    return null;
  if (!client)
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  if (!limiter)
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(1000, "1 d"),
    });
  return limiter;
}

export async function checkDailyLimit(
  userId: string,
  key: string,
  max: number
) {
  const l = getLimiter();
  if (!l) return { allowed: true } as const;
  const id = `llm:${key}:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const res = await l.redis.incr(id);
  if (res === 1) {
    const ttl = 24 * 60 * 60;
    await l.redis.expire(id, ttl);
  }
  return { allowed: res <= max, current: res, max } as const;
}
