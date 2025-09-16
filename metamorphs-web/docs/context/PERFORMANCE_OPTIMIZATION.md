### [Last Updated: 2025-09-16]

## Performance Optimization

### LLM Quick Reference

- Cache identical LLM requests; limit bundle sizes; use lower-cost models for planning.

### Bottlenecks & Solutions

- Nodes polling (1.5s): consider backoff or user-triggered refresh
- Translator preview latency: cache and reduce prompt size

  - Use placeholder version update + cached overview to minimize repeated model calls.

  ```101:109:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
  const cached = await cacheGet<unknown>(key);
  if (cached) {
    // ...update node meta and return cached preview
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
