### [Last Updated: 2025-11-04]

## Performance Optimization

### Caching strategies

- In-memory TTL cache (default 3600s) for idempotent LLM results; stable SHA-256 key

```1:11:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
const mem = new Map<string, { expires: number; value: unknown }>();
export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}
```

```13:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> { /* TTL check */ }
export async function cacheSet<T>(key: string, value: T, ttlSec = 3600) { /* set */ }
```

- Example usages

```101:109:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const cacheKey = `ai-assist:${threadId}:${cellId}:${wordsKey}:${instruction || "refine"}`;
const cached = await cacheGet<AIAssistResponse>(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
```

```241:244:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
await cacheSet(cacheKey, result, 3600);
return NextResponse.json(result);
```

### Rate limiting (API protection)

- In-memory sliding window for hot endpoints; returns remaining and `retryAfterSec` when exceeded

```1:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) { /* ... */ }
```

- Daily quotas stub via Upstash Redis helper (optional)

```176:191:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
export async function checkDailyLimit(userId: string, key: string, max: number) { /* ... */ }
```

### Database query optimization

- Narrow projections (select only needed columns), explicit `order` and `limit`

```40:46:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
const { data, error } = await supabase
  .from("journey_items")
  .select("id, kind, summary, meta, created_at")
  .eq("project_id", projectId)
  .order("created_at", { ascending: false })
  .limit(limit);
```

- Typed validation for query params to avoid unnecessary round trips

```7:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
const Q = z.object({ projectId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(50).default(20), });
```

- Ownership checks before heavy reads to short-circuit early

```21:31:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
const { data: proj } = await sb.from("projects").select("id, owner_id").eq("id", projectId).single();
if (!proj) return NextResponse.json({ ok: false, code: "PROJECT_NOT_FOUND" }, { status: 404 });
if (proj.owner_id !== user.id) return NextResponse.json({ ok: false, code: "FORBIDDEN_PROJECT" }, { status: 403 });
```

### Frontend performance

- TanStack Query caches server data and controls refetch behavior

```19:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/page.tsx
const { data, refetch, isFetching } = useQuery({
  enabled: !!projectId,
  queryKey: ["chat_threads", projectId],
  queryFn: async () => {
    const res = await fetch(`/api/threads/list?projectId=${projectId}`, { cache: "no-store", credentials: "include", headers });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || payload?.code || "THREADS_LIST_FAILED");
    return (payload.items ?? []) as Thread[];
  },
});
```

- Avoid unnecessary re-renders via narrow selectors and memoization (examples in V2 sidebar and views)

```28:36:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const stanzas = React.useMemo(() => { /* split stanzas once */ }, [hasSource, sourceLines]);
```

```54:56:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const { visible, canLoadMore, loadMore, count, total } = useWindowedList(flatLines, 400);
```

### API response optimization

- Early validation and early returns on auth/ownership failures

```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
const parsed = createProjectSchema.safeParse(await req.json());
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```

- Projected columns only; limit and sort to bound payload sizes (see journey list above)
- Non-blocking persistence: do not delay user response on secondary save failures

```160:170:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const { error: saveErr } = await supabase.from("chat_threads").update({ state: newState }).eq("id", body.threadId);
if (saveErr) { log("save_fail", saveErr.message); return ok({ analysis, saved: false }); }
```

### Resource pooling and connection management

- OpenAI client: singleton reused across requests

```1:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, });
export function getOpenAI() { if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing"); return openai; }
```

- Supabase: per-request server client using SSR helpers; leverages platform HTTP connection reuse

```51:61:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { get: (n)=>cookieStore.get(n)?.value, set(){}, remove(){} } }
);
```

- Bearer-auth fallback creates a scoped client only when needed

```35:44:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
const supabase = token ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } }) : await supabaseServer();
```

### Known bottlenecks

- LLM latency on cold prompts; mitigated with caching and strict JSON prompts
- Chat/Nodes polling when backgrounded; mitigate with `enabled` gating (future)
- No shared cache/ratelimit store in multi-instance deployments (in-memory only) → consider Redis for consistency

### Monitoring and profiling

- Logging: structured console logs with request IDs and timing in LLM routes

```30:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const requestId = crypto.randomUUID();
const started = Date.now();
const log = (...a: any[]) => console.log("[/api/notebook/prismatic]", requestId, ...a);
```

- No external APM/metrics wired; consider adding request timing, cache hit ratios, and LLM usage metrics to an external sink

### Performance budgets and targets (proposed)

- API: p95 < 1.5s on cache hit; p95 < 6s on LLM miss
- UI: route transition TTI < 1.5s; list interactions < 100ms
- DB: list endpoints return ≤ 100 items by default; payloads ≤ 200KB

### Related docs

- `docs/policies/spend-and-cache-policy.md`
- `docs/context/LLM_INTEGRATION_GUIDE.md`
- `docs/context/ERROR_HANDLING.md`
