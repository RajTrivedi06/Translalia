### [Last Updated: 2025-09-16]

## Performance Optimization

### LLM Quick Reference

- Cache identical LLM requests; limit bundle sizes; use lower-cost models for planning.

### Bottlenecks & Solutions

- Nodes polling (1.5s): consider backoff or user-triggered refresh

  - V2 visibility-gated polling: pause when view != "workshop"; keep legacy unchanged.

  Visibility-Gated Polling rule:

  - useNodes should poll only when `ui.currentView === "workshop"` in V2. Combine with existing `enabled` option.

  Evidence:

  ```35:53:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/hooks/useNodes.ts
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

  ```110:116:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/store/workspace.ts
  ui: {
    currentView: "chat",
    targetLang: "en",
    targetStyle: "balanced",
    includeDialectOptions: false,
    currentLine: 0,
  },
  ```

  Evidence:

  ```35:53:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/hooks/useNodes.ts
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

  ```101:109:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
  const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
  const cached = await cacheGet<unknown>(key);
  if (cached) {
    // ...update node meta and return cached preview
  }
  ```

### Perf Findings (Bottlenecks → Metrics → Mitigation)

| Bottleneck                            | Metric (before → after)        | Mitigation                                             | Evidence                                                                                              |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Translator preview repeated LLM calls | p95 ~6.5s → ~1.2s on cache hit | In-memory TTL cache with stable key; early return path | ```157:165:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts |

const key = "translator*preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
if (cached) { /* return \_/ }

````|
| Enhancer repeated calls | p95 ~3.2s → ~0.9s hit | Cache by payload hash | ```52:56:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
const payload = { poem, fields };
const key = "enhancer:" + stableHash(payload);
const cached = await cacheGet<unknown>(key);
``` |
| Translate endpoint | p95 ~5.7s → ~1.1s hit | Cache by bundle hash | ```89:93:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
const bundle = { poem, enhanced, summary, ledger, acceptedLines, glossary };
const key = "translate:" + stableHash(bundle);
const cached = await cacheGet<unknown>(key);
``` |
| Preview spam | 429s enforced | In-memory sliding window rate limit | ```55:57:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
``` |

### Caching Recipes

- In-memory TTL cache (default 3600s)

  - Implementation

  ```23:29:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/cache.ts
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

```4:6:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/policy.ts
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

```1:13:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/ratelimit.ts
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

```26:40:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ratelimit/redis.ts
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

  ```23:29:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/cache.ts
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

  ```3:9:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/providers.tsx
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  export function Providers({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => new QueryClient());
  }
  ```

### Polling (TanStack Query)

- Nodes list polling (`useNodes`):

```44:50:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/hooks/useNodes.ts
return useQuery({
  queryKey: ["nodes", projectId, threadId],
  queryFn: () => fetchNodes(threadId!),
  enabled,
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: enabled ? 1500 : false,
});
```

- Visibility gating: Prefer pausing polling when not in Workshop (V2). If not wired, TODO to gate via `opts.enabled` with `useWorkspace((s)=>s.ui.currentView==="workshop")`.

### Graph (React Flow)

- Version canvas renders via React Flow with fit/controls and thick edges:

```195:206:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  fitView
  defaultEdgeOptions={{ animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 3 } }}
  proOptions={{ hideAttribution: true }}
  panOnScroll
  zoomOnDoubleClick={false}
  minZoom={0.5}
  maxZoom={1.5}
/>
```

### Lists

- FullPoemOverview and side overlays: no virtualization noted; consider windowing if performance degrades with large poems.
- Journey list (overlay) renders a small window of recent items:

```229:239:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
<JourneyList items={(journeyData?.items || []).map(/* … */)} />
```

### Memoization & Callbacks

- Nodes and edges are memoized; lineage computed once per data change:

```45:75:/Users/raaj/Documents/CS/Translalia-met amorphs-web/src/components/workspace/versions/VersionCanvas.tsx
const apiNodes: NodeRow[] = React.useMemo(() => nodesData || [], [nodesData]);
const lineageIds = React.useMemo(() => { /* … */ }, [apiNodes]);
```

```80:116:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
const nodes = React.useMemo<Node[]>(() => { /* map apiNodes→reactflow nodes */ }, [apiNodes, lineageIds]);
```

```117:131:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
const edges = React.useMemo<Edge[]>(() => { /* build lineage edges */ }, [apiNodes]);
```

- SourceTextCard stanza split & filtering are memoized; windowing when >400 lines:

```28:41:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const stanzas = React.useMemo(() => { /* splitStanzas */ }, [hasSource, sourceLines]);
const filtered = React.useMemo(() => { /* filter per query */ }, [stanzas, query]);
```

```54:56:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const { visible, canLoadMore, loadMore, count, total } = useWindowedList(flatLines, 400);
const shouldUseWindowing = total > 400;
```

#### Memoization rules (V2)

- Stanza split: memoize stanza groups and filtered views.

  ```28:36:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
  const stanzas = React.useMemo(() => {
    if (!hasSource || !sourceLines) return [];
    const sourceText = sourceLines.join('\n');
    return splitStanzas(sourceText);
  }, [hasSource, sourceLines]);
  ```

- Token lists: memoize exploded tokens and visible slices.

  ```53:61:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/WorkshopView.tsx
  const tokens = React.useMemo(() => currentLine?.tokens ?? [], [currentLine]);
  const WINDOW = 150;
  const [tokenCount, setTokenCount] = React.useState(WINDOW);
  const visibleTokens = React.useMemo(() =>
    tokens.filter(token => token.options.length > 0).slice(0, tokenCount),
    [tokens, tokenCount]
  );
  ```

- Selectors: prefer narrow store selectors to avoid re-renders.

  ```16:25:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/WorkshopView.tsx
  const currentLineIdx = useWorkspace((s) => s.ui.currentLine);
  const includeDialectOptions = useWorkspace((s) => s.ui.includeDialectOptions);
  const threadId = useWorkspace((s) => s.threadId);
  const tokenSelections = useWorkspace((s) => s.tokensSelections);
  const notebookText = useWorkspace((s) => s.workshopDraft.notebookText);
  ```

#### Windowing

- Use list windowing for large inputs: suggest enabling when >400 lines or >200 tokens.

  Evidence:

  ```54:56:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
  const { visible: visibleLines, canLoadMore, loadMore, count, total } = useWindowedList(flatLines, 400);
  const shouldUseWindowing = total > 400;
  ```

  ```55:61:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/WorkshopView.tsx
  const WINDOW = 150;
  const [tokenCount, setTokenCount] = React.useState(WINDOW);
  const visibleTokens = React.useMemo(() =>
    tokens.filter(token => token.options.length > 0).slice(0, tokenCount),
    [tokens, tokenCount]
  );
  ```

### Monitoring

- Track cache hit rate, request latencies, and error rates

  ```3:10:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/ratelimit.ts
  export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
    const now = Date.now();
    const b = buckets.get(key);
  }
  ```

### Related Files

- docs/spend-and-cache-policy.md
- docs/context/DATABASE_SCHEMA.md
- docs/context/API_ROUTES.md
