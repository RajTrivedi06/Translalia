const buckets = new Map<string, { count: number; until: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.until) {
    buckets.set(key, { count: 1, until: now + windowMs });
    return { ok: true, remaining: limit - 1 } as const;
  }
  if (b.count >= limit) return { ok: false, remaining: 0 } as const;
  b.count += 1;
  return { ok: true, remaining: limit - b.count } as const;
}
