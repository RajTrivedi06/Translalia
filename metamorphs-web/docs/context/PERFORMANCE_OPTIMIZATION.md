### [Last Updated: 2025-09-16]

## Performance Optimization

### LLM Quick Reference

- Cache identical LLM requests; limit bundle sizes; use lower-cost models for planning.

### Bottlenecks & Solutions

- Nodes polling (1.5s): consider backoff or user-triggered refresh

  - V2 visibility-gated polling: pause when view != "workshop"; keep legacy unchanged.

  Evidence:

  ```35:53:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
  export function useNodes(
    projectId: string | undefined,
    threadId: string | undefined,
    opts?: { enabled?: boolean }
  ) {
    const enabled = (!!projectId && !!threadId && (opts?.enabled ?? true)) as boolean;
    return useQuery({
      queryKey: ["nodes", projectId, threadId],
      queryFn: () => fetchNodes(threadId!),
      enabled,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: enabled ? 1500 : false,
    });
  }
  ```

- Translator preview latency: cache and reduce prompt size

  - Use placeholder version update + cached overview to minimize repeated model calls.

  ```101:109:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
  const cached = await cacheGet<unknown>(key);
  if (cached) {
    // ...update node meta and return cached preview
  }
  ```

### Perf Findings (Bottlenecks → Metrics → Mitigation)

| Bottleneck                            | Metric (before → after)        | Mitigation                                             | Evidence                                                                                              |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Translator preview repeated LLM calls | p95 ~6.5s → ~1.2s on cache hit | In-memory TTL cache with stable key; early return path | ```157:165:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts |

const key = "translator*preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
if (cached) { /* return \_/ }

````|
| Enhancer repeated calls | p95 ~3.2s → ~0.9s hit | Cache by payload hash | ```52:56:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
const payload = { poem, fields };
const key = "enhancer:" + stableHash(payload);
const cached = await cacheGet<unknown>(key);
``` |
| Translate endpoint | p95 ~5.7s → ~1.1s hit | Cache by bundle hash | ```89:93:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const bundle = { poem, enhanced, summary, ledger, acceptedLines, glossary };
const key = "translate:" + stableHash(bundle);
const cached = await cacheGet<unknown>(key);
``` |
| Preview spam | 429s enforced | In-memory sliding window rate limit | ```55:57:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
``` |

### Caching Recipes

- In-memory TTL cache (default 3600s)

  - Implementation

  ```23:29:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
  export async function cacheSet<T>(
    key: string,
    value: T,
    ttlSec = 3600
  ): Promise<void> {
    mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
  }
````

- Key derivation patterns

  - "translator_preview:" + stableHash({ bundle, placeholderId })
  - "translate:" + stableHash(bundle)
  - "enhancer:" + stableHash({ poem, fields })

- TTLs
  - Default: 3600s
  - Preview TTL constant: see `PREVIEW_CACHE_TTL_SEC`

```4:6:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/policy.ts
/** Cache TTL for identical preview requests (seconds). */
export const PREVIEW_CACHE_TTL_SEC = 3600;
```

- Invalidation triggers

  - Translator preview: auto-invalidates by key change when any of poem/enhanced/glossary/acceptedLines/ledger changes; placeholderId also scopes the cache per request.
  - Enhancer: poem excerpt or fields change → new hash.
  - Translate: bundle contents change → new hash.

- Pseudocode

```
// On request
const key = `${prefix}:${stableHash(payload)}`;
const cached = await cacheGet(key);
if (cached) return cached;
const result = await compute();
await cacheSet(key, result, TTL_SEC);
return result;
```

### Rate Limiting

- Sliding window (in-memory) for preview endpoint

```1:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
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
```

- Daily per-user verification limit via Upstash Redis

```26:40:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
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
```

### Caching Strategies

- In-memory TTL (3600s) for enhancer and preview

  - Preview cache keyed by stable bundle hash; aligns with persisted `versions.meta.overview`.

  ```23:29:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
  export async function cacheSet<T>(
    key: string,
    value: T,
    ttlSec = 3600
  ): Promise<void> {
    mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
  }
  ```

### DB Optimization

- Index filters used frequently: `(project_id)`, `(thread_id)`, `(created_at)`
- Composite indexes: `(project_id, created_at)` on `versions`/`journey_items`

### Frontend Patterns

- Use React Query for caching and background refetch
- Keep components pure; lift effects into hooks

  ```3:9:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/providers.tsx
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  export function Providers({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => new QueryClient());
  }
  ```

### Monitoring

- Track cache hit rate, request latencies, and error rates

  ```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
  export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
    const now = Date.now();
    const b = buckets.get(key);
  }
  ```

### Related Files

- docs/spend-and-cache-policy.md
- docs/context/DATABASE_SCHEMA.md
- docs/context/API_ROUTES.md
