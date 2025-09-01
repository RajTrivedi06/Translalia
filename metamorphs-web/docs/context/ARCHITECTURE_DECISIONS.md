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
