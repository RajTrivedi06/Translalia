Updated: 2025-09-16

### App Router (server-first)

- Use Next.js App Router API routes for server handlers and SSR helpers.

```4:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/auth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
```

### Supabase + RLS (SSR cookie + Bearer fallback)

- Prefer cookie-bound SSR via helper; fall back to Authorization Bearer when present.

```4:12:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
export function supabaseServer() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

```35:50:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
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

```23:29:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheSet<
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.until) {
```

### Server-owned conversational state

- Thread `state` JSONB merged and persisted server-side; ledger cadence support.

```60:71:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/threadState.ts
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

```33:36:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
```

```1:4:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/verify.ts
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

### Notes

- For major changes, add a dated ADR entry and link to relevant PRs

---

## ARCHITECTURE_DECISIONS

1. Next.js App Router + Route Handlers

- Decision: Use file-based routing and server handlers for APIs
- Consequences: Simple co-location, good DX; keep heavy logic in `server/*`
- Status: Accepted

2. Supabase for Auth + Data + Storage

- Decision: Use Supabase client/SSR helpers; RLS policies for multi-tenant safety
- Consequences: Simplified auth and data; must manage envs and RLS
- Status: Accepted

3. Client State via Zustand + React Query

- Decision: Lightweight global UI state with Zustand; React Query for server data
- Consequences: Clear separation of UI vs server state
- Status: Accepted

4. OpenAI for Translation/Moderation

- Decision: Leverage OpenAI SDK for translation and moderation endpoints
- Consequences: External dependency and cost; add rate limits and caching
- Status: Accepted

5. Feature Flags for Incremental Enablement

- Decision: `NEXT_PUBLIC_FEATURE_*` to guard optional features (router, enhancer, translator)
- Consequences: Safer rollout, slightly more branching in code
- Status: Accepted

6. In-memory Cache for Idempotent LLM Calls (MVP)

- Problem: Identical requests to LLMs are common during iterative UX; reduce latency and cost.
- Decision: Provide `lib/ai/cache.ts` with a process-memory Map keyed by `stableHash(payload)` and TTL.
- Rationale: Minimal complexity to start; enables instant repeat previews.
- Trade-offs: Not shared across instances; resets on deploy. Consider Redis later.
- Implementation Guidelines:
  - Compute a stable JSON hash with sorted keys using `stableHash`.
  - Cache safe, deterministic results only (e.g., translator preview, enhancer plan).
  - Respect TTLs (e.g., 3600s default).
- Example:

```ts
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
const key = "translator_preview:" + stableHash(bundle);
const cached = await cacheGet(key);
if (cached) return cached;
// call LLM ...
await cacheSet(key, result, 3600);
```

- Don't Do:
  - Cache user-secrets or personally identifiable data.
  - Cache partial/inconsistent outputs that can’t be schema-validated.

7. Lightweight Rate Limiting on Hot Endpoints

- Problem: Prevent abuse and accidental rapid replays of preview endpoints.
- Decision: `lib/ai/ratelimit.ts` with per-key token buckets in memory (keyed by thread).
- Rationale: Simple MVP; pairs well with in-memory cache.
- Trade-offs: Not distributed; imprecise under clock skew.
- Implementation Guidelines:
  - Apply to preview-style routes (e.g., `/api/translator/preview`).
  - Use meaningful keys (`preview:${threadId}`) and reasonable windows (30/min).
- Example:

```ts
import { rateLimit } from "@/lib/ai/ratelimit";
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

- Don't Do:
  - Gate critical persist endpoints solely with rate limits.

8. Server-Owned Conversation State in DB

- Problem: The guided flow requires durable state across requests and sessions.
- Decision: Store a validated `SessionState` JSON in `chat_threads.state` and update via server functions.
- Rationale: Centralized, auditable, RLS-protected state; avoids client drift.
- Trade-offs: Requires schema migrations and careful merges.
- Implementation Guidelines:
  - Use `getThreadState`, `patchThreadState`, and `appendLedger` from `server/threadState.ts`.
  - Validate with `SessionStateSchema` on read/write; deep-merge patches.
  - Log important steps to `journey_items` for activity timelines.
- Example:

```ts
const state = await getThreadState(threadId);
await patchThreadState(threadId, { phase: "translating" });
```

- Don't Do:
  - Mutate thread state from the client directly.
  - Store large text blobs other than the poem excerpt and compact metadata.

9. LLM IO Contracts via Schemas

- 10. Auth Cookie Synchronization via App Router

- Decision: Use `src/app/api/auth/route.ts` to set/clear Supabase auth cookies on client auth events; `middleware.ts` ensures session presence for protected paths.
- Consequences: Reliable server session alignment with client; minimal coupling to UI via a small `Providers` effect.
- Status: Accepted

- Problem: Unstructured LLM output is brittle to parse.
- Decision: Wrap inputs/outputs with schemas (`types/llm.ts`) and validate.
- Rationale: Early failure surfaces bad prompts or model regressions.
- Trade-offs: Adds light overhead; forces prompt discipline.
- Implementation Guidelines:
  - For JSON outputs, set `response_format: { type: "json_object" }`.
  - Validate with Zod (e.g., `EnhancerPayloadSchema`, `TranslatorOutputSchema`).
  - On parse failure, return 502 with `raw` payload for diagnostics.
- Example:

```ts
const parsed = TranslatorOutputSchema.safeParse(rawOut);
if (!parsed.success)
  return NextResponse.json(
    { error: "Translator output invalid", raw: out },
    { status: 502 }
  );
```

- Don't Do:
  - Proceed with unvalidated outputs.
  - Swallow parse errors silently.

---

### ADR-Canvas-001: Single source of truth for nodes

- Context: Canvas nodes were previously read from a Zustand `versions` slice, creating drift with API results and causing delayed renders after Accept actions.
- Decision: Canvas uses React Query `useNodes(projectId, threadId)` as the single source of truth.
- Consequences: Invalidation of `["nodes", projectId, threadId]` updates canvas instantly; no store refresh needed.
- Status: Accepted

### ADR-PlanBuilder-CTA-002: Post-create labeling & action

- Context: CTA label remained in pre-create state, confusing users after a version existed.
- Decision: Switch label to "Accept" after a version exists (optimistic or confirmed via query). Clicking closes the drawer and does not re-generate.
- Consequences: Clear user intent; prevents duplicate creation calls.
- Status: Accepted

### ADR-Drawer-003: Close on success

- Context: Drawer remained open after successful Accept, requiring manual dismissal.
- Decision: Drawer closes after node detection via nodes query; handoff to canvas.
- Consequences: Smoother flow and immediate focus on new version node.
- Status: Accepted

### ADR-Flags-004: Force Translate gating

- Context: The "Force translate (avoid echo)" control should be limited to specific environments.
- Decision: Checkbox is hidden unless `NEXT_PUBLIC_SHOW_FORCE_TRANSLATE=true`.
- Consequences: Reduces cognitive load; allows controlled exposure for testing.
- Status: Accepted

### ADR-Readability-005: Node card width & clamp

- Context: Version nodes were too narrow and clamped, harming poem readability.
- Decision: Widen node card and relax text clamp, or provide expand affordance.
- Consequences: Improved readability; monitor long poems for layout impact.
- Status: Accepted

---

#### Changelog

- 2025-09-09: Added ADRs for canvas source-of-truth, CTA label behavior, drawer close, Force Translate gating, and node readability. (CursorDoc-Editor)
- 2025-09-11: Added ADR-009 for single-call prismatic and on-demand verification. (CursorDoc-Editor)

## ADR-009: Single-Call Prismatic & On-Demand Verification

- Context: We need multiple candidate variants without multiplying cost, and verification/back-translation tooling should not silently increase spend.
- Decision: Generate A/B/C multi-variant within one LLM call; expose verification and back-translation as user-initiated tools only.
- Consequences: Predictable budget, clearer UX; puts the human in the loop for quality evaluation.
- Status: Accepted
