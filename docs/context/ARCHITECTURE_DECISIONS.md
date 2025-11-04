Updated: 2025-11-04

### App Router (server-first)

- Use Next.js App Router API routes for server handlers and SSR helpers.

```4:10:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/auth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
```

### Supabase + RLS (SSR cookie + Bearer fallback)

- Prefer cookie-bound SSR via helper; fall back to Authorization Bearer when present.

```4:12:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/supabaseServer.ts
export function supabaseServer() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

```35:50:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/apiGuard.ts
  if (authH.toLowerCase().startsWith("bearer ")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sbBearer = createSupabaseClient(url, anon, {
      global: { headers: { Authorization: authH } },
    }) as unknown as SupabaseClient;
    const { data: u2, error: e2 } = await sbBearer.auth.getUser();
```

### Cache and rate limits

- In-memory per-process cache for LLM previews; simple token-bucket rate limiting.

```23:29:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/cache.ts
export async function cacheSet<
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

```3:10:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.until) {
```

### Server-owned conversational state

- Thread `state` JSONB merged and persisted server-side; ledger cadence support.

```60:71:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/threadState.ts
export async function patchThreadState(
  threadId: string,
  patch: Partial<SessionState>
): Promise<SessionState> {
  const supabase = await supabaseServer();
  const current = await getThreadState(threadId);
  const merged = deepMerge(
    current as Record<string, unknown>,
    patch as Partial<Record<string, unknown>>
  );
```

### Feature flags

- Public flags `NEXT_PUBLIC_FEATURE_*` gate routes; off defaults to 403/404.

```33:36:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
```

```1:4:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/verify.ts
export const isVerifyEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_VERIFY === "1";
export const isBacktranslateEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_BACKTRANSLATE === "1";
```

Last updated: 2025-09-11 by CursorDoc-Editor

## Architecture Decisions (ADRs)

Keep a concise record of significant technical decisions and their context.

### ADR Template

- Context: What problem are we solving? Why now?
- Decision: What did we choose and alternatives considered?
- Consequences: Positive/negative outcomes, trade-offs
- Status: Proposed | Accepted | Deprecated | Superseded by X

### ADR Index

1. Use Next.js App Router for API and pages — Status: Accepted
2. Supabase for Auth + Data — Status: Accepted
3. OpenAI-compatible client abstraction in `lib/ai/openai.ts` — Status: Accepted
4. Cache and rate-limit LLM interactions in-memory (MVP) — Status: Accepted
5. Server-owned conversational state in `chat_threads.state` (jsonb) — Status: Accepted
6. Auth cookie synchronization via route handler — Status: Accepted
7. ADR-Canvas-001: Single source of truth for nodes — Status: Accepted
8. ADR-PlanBuilder-CTA-002: Post-create labeling & action — Status: Accepted
9. ADR-Drawer-003: Close on success — Status: Accepted
10. ADR-Flags-004: Force Translate gating — Status: Accepted
11. ADR-Readability-005: Node card width & clamp — Status: Accepted
12. ADR-009: Single-Call Prismatic & On-Demand Verification — Status: Accepted
13. ADR-010: Monolith (Next.js App) over Microservices — Status: Accepted
14. ADR-011: JSON-first LLM Outputs, No Streaming (MVP) — Status: Accepted
15. ADR-012: Thread-Scoped Client State via `threadStorage` — Status: Accepted
16. ADR-013: Redis Quotas Deferred (stub helper) — Status: Accepted
17. ADR-014: Deprecate legacy translator routes; consolidate flows — Status: Accepted

---

### ADR-010: Monolith (Next.js App) over Microservices

- Context: Early product iteration benefits from co-located UI and API.
- Decision: Single Next.js app with Route Handlers; no separate API service.
- Consequences: Simple deploy/build; limited horizontal scaling for API without externalizing cache/quotas.
- Status: Accepted

### ADR-011: JSON-first LLM Outputs, No Streaming (MVP)

- Context: Planner/assist/reflection surfaces require structured outputs and easy parsing.
- Decision: Prefer `response_format: { type: "json_object" }` and synchronous JSON responses over streaming.
- Consequences: Simpler clients and error handling; no token-by-token UX; can add streaming later.
- Anchor:
  ```162:170:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
  if (isGpt5) { completion = await openai.chat.completions.create({ model: modelToUse, response_format: { type: "json_object" }, messages: [...] }); }
  ```
- Status: Accepted

### ADR-012: Thread-Scoped Client State via `threadStorage`

- Context: Prevent cross-thread leakage in persisted Zustand stores.
- Decision: Namespace persisted keys by active threadId and guard merges with `meta.threadId`.
- Consequences: Thread isolation; need reliable threadId at hydration.
- Anchors:
  ```28:46:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/threadStorage.ts
  const tid = getActiveThreadId();
  const key = tid ? `${name}:${tid}` : `${name}:__global__`;
  ```
  ```432:449:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
  if (p.meta?.threadId && p.meta.threadId !== tid) { return { ...current, hydrated: true, meta: { threadId: tid } }; }
  ```
- Status: Accepted

### ADR-013: Redis Quotas Deferred (stub helper)

- Context: We plan daily quotas but have not enabled Redis dependencies yet.
- Decision: Provide `lib/ratelimit/redis.ts` that currently always allows; wire quotas later.
- Consequences: No daily caps yet; rely on UI and in-memory limits.
- Anchor:
  ```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
  return { allowed: true, current: 0, max } as const;
  ```
- Status: Accepted

### ADR-014: Deprecate legacy translator routes; consolidate flows

- Context: Earlier docs referenced translator/verify/backtranslate endpoints not present in this snapshot.
- Decision: Consolidate around notebook/workshop/journey/guide routes; keep translator legacy docs deprecated.
- Consequences: Reduced surface area; clearer flows; migrate any remaining UI references.
- Status: Accepted

### Future Considerations

- External cache/quotas: Move cache to Redis/Upstash; enable real daily limits.
- Streaming: Add SSE/streaming for long-running or progressive UIs.
- Background jobs: Offload heavy tasks (parsing, long LLM calls) to queues if needed.
- Multi-instance: Share cache and rate limits; review sticky sessions.
