### [Last Updated: 2025-09-03]

## Utilities & Helpers

### Overview

Common helpers used across the codebase, primarily in `src/lib` and `src/types`.

### Key Modules

- `lib/ai/cache.ts`: Simple AI response cache utilities
- One-liner: process-memory Map TTL cache used for preview/translate/enhancer
  - Callers:
    - `metamorphs-web/src/app/api/translator/preview/route.ts:L153–L156`
    - `metamorphs-web/src/app/api/translate/route.ts:L113–L118`
    - `metamorphs-web/src/app/api/enhancer/route.ts:L84–L86`
  - Anchors:
    ```13:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
    export async function cacheGet<T>(key: string): Promise<T | null> {
      const item = mem.get(key);
      if (!item) return null;
      if (Date.now() > item.expires) {
        mem.delete(key);
        return null;
      }
      return item.value as T;
    }
    ```
- `lib/ai/moderation.ts`: Moderation checks and policy mapping
- One-liner: wraps OpenAI moderation; returns `{ flagged, categories }`
  - Callers:
    - `metamorphs-web/src/app/api/enhancer/route.ts:L44–L49`
    - `metamorphs-web/src/app/api/translator/preview/route.ts:L112–L119`
    - `metamorphs-web/src/app/api/translate/route.ts:L81–L86`
    - `metamorphs-web/src/app/api/translator/accept-lines/route.ts:L48–L60`
- `lib/ai/prompts.ts`: Prompt templates and composition helpers
- `lib/ai/openai.ts`: Client factory and invocation helpers
- One-liner: central Responses API call; strips unsupported params and retries on temperature errors
  - Callers:
    - `metamorphs-web/src/app/api/translator/preview/route.ts:L259–L264`
    - `metamorphs-web/src/lib/ai/enhance.ts:L43–L50`
    - `metamorphs-web/src/server/flow/intentLLM.ts:L26–L34`
- `lib/ai/ratelimit.ts`: Rate limiting helpers
- One-liner: in-memory token bucket per-key
  - Callers:
    - `metamorphs-web/src/app/api/translator/preview/route.ts:L55–L58`
  - Anchors:
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
- `lib/ratelimit/redis.ts`: Upstash/Redis-backed daily limits
  - Anchors:
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
- `lib/apiGuard.ts`: Request guards (auth, rate limit, permissions)
- One-liner: SSR cookie or Bearer Supabase session guard for Next API routes
  - Callers:
    - `metamorphs-web/src/app/api/versions/nodes/route.ts:L17–L25`
    - `metamorphs-web/src/app/api/versions/route.ts:L16–L23`
- `lib/authHelpers.ts`: Supabase auth helpers
- `lib/constraints.ts`: Constraint validation and normalization
- `lib/generation.ts`: Shared generation utilities
- `lib/models.ts`: Model identifiers and mapping
- `lib/policy.ts`: Policy helpers
- `lib/rag.ts`: Retrieval helpers
- `lib/routers.tsx`: App routers/utilities
- `lib/schemas.ts`: Zod schemas and validators
- `lib/supabaseClient.ts` / `lib/supabaseServer.ts`: Supabase clients
- `server/threadState.ts`: Server-side session state helpers
- One-liner: load/merge/persist `chat_threads.state` JSONB; cadence-aware ledger append
  - Callers:
    - `metamorphs-web/src/app/api/translator/accept-lines/route.ts:L72–L76`
    - `metamorphs-web/src/app/api/enhancer/route.ts:L58–L65`
- `server/translator/bundle.ts`: Input bundling for translator
- `server/translator/parse.ts`: Output parsing for translator
- One-liner: parse `---VERSION A---` and `---NOTES---` into `{ lines, notes }`
  - Callers:
    - `metamorphs-web/src/app/api/translator/preview/route.ts:L274–L279`
    - `metamorphs-web/src/app/api/translator/instruct/route.ts:L186–L194`

### Types

- `types/llm.ts`: LLM request/response types
- `types/sessionState.ts`: Session state models
- `types/workspace.ts`: Workspace-related types

---

## UTILITIES_HELPERS

### 1) Utility functions and their purposes

- `lib/ai/cache.ts`: `stableHash`, `cacheGet`, `cacheSet` — in-memory cache with TTL
- `lib/ai/ratelimit.ts`: token bucket rate limiting
- `lib/ai/moderation.ts`: OpenAI moderation helper
- `lib/ai/openai.ts`: OpenAI client factory
- `lib/ai/prompts.ts`: translator system prompt
- `lib/featureFlags.ts`: helpers to read `NEXT_PUBLIC_FEATURE_*` and env (`inDev/inProd`)
- `lib/apiGuard.ts`: Supabase-based auth guard for Next route handlers
- `lib/policy.ts`: feature and policy constants
- `lib/constraints.ts`: constraint enforcement stub
- `lib/generation.ts`: variant generator stub
- `lib/rag.ts`: retrieval stub
- `lib/models.ts`: model name mapping via env vars
- `lib/routers.tsx`: typed route builders and `<AppLink>`
- `server/threadState.ts`: `getThreadState`, `patchThreadState`, `appendLedger`
- `server/translator/bundle.ts`: `buildTranslateBundle`
- `server/translator/parse.ts`: `parseTranslatorOutput`

### 2) Custom hooks

- `hooks/useThreadMessages.ts`: loads chat messages for a project/thread
- `hooks/useInterviewFlow.ts`: orchestrates flow mutations (start/answer/confirm/preview)
- `hooks/useProfile.ts`: profile load/save
- `hooks/useSupabaseUser.ts`: auth state
- `hooks/useNodes.ts`: list nodes for current thread (polling)
- `hooks/useJourney.ts`: activity/journey list

### Phase-1 UI fallback utils (V2)

- `getSourceLines({ flowPeek, nodes }): string[] | null`
  - Purpose: Extract source lines from `flowPeek.state.source_text|poem_text`; fallback to latest node `overviewLines`. Returns `null` if unavailable.

```42:74:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/v2/_utils/data.ts
export function getSourceLines({ flowPeek, nodes }: GetSourceArgs): string[] | null {
  // peek → state.source_text/poem_text; fallback to nodes.overviewLines
}
```

- `getAnalysisSnapshot({ flowPeek, nodeMeta }): { language?: string; form?: string; themes?: string[]; audienceOrTone?: string }`
  - Purpose: Build lightweight analysis snapshot from `flowPeek.state.analysis` with fallback to latest node meta fields.

```76:129:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/v2/_utils/data.ts
export function getAnalysisSnapshot({ flowPeek, nodeMeta }: { flowPeek?: unknown; nodeMeta?: unknown }): AnalysisSnapshot {
  // merges from flowPeek.state.analysis; falls back to node meta
}
```

### 3) Constants and configurations

- Feature flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR`, `NEXT_PUBLIC_FEATURE_ROUTER`, `NEXT_PUBLIC_FEATURE_ENHANCER`
- Policy constants in `lib/policy.ts` (rates, budgets, TTLs)
- Models map in `lib/models.ts`
  - `MODELS.translator|enhancer|embeddings` sourced from env with defaults

### 4) Type definitions/interfaces

- `types/workspace.ts`: `Version`, `CompareNode`, `JourneyItem`
- `types/sessionState.ts`: `SessionState`, `DecisionsItem`
- `types/llm.ts` (if present) for LLM types

### 5) Validation schemas

- Zod schemas in `lib/schemas.ts` for projects, threads, messages, versions, compares

### 6) Formatters and parsers

- `server/translator/parse.ts`: parses translator output into `{ lines, notes }`
- `server/translator/bundle.ts`: bundles state and inputs for translator

### 7) Signatures and usage examples

```ts
// cache.ts
function stableHash(obj: unknown): string;
function cacheGet<T>(key: string): Promise<T | null>;
function cacheSet<T>(key: string, value: T, ttlSec?: number): Promise<void>;

// moderation.ts
async function moderateText(
  text: string
): Promise<{ flagged: boolean; categories: Record<string, unknown> }>;

// apiGuard.ts
async function requireUser(
  req: NextRequest
): Promise<{ user: any | null; sb: SupabaseClient; res: NextResponse | null }>;

// threadState.ts
async function getThreadState(threadId: string): Promise<SessionState>;
async function patchThreadState(
  threadId: string,
  patch: Partial<SessionState>
): Promise<SessionState>;
async function appendLedger(
  threadId: string,
  item: DecisionsItem
): Promise<{ state: SessionState; didHitCadence: boolean }>;

// translator/bundle.ts
async function buildTranslateBundle(threadId: string): Promise<TranslateBundle>;
```

Usage in Code Generation:

- Prefer `requireUser` in any route that mutates DB rows.
- Wrap repeatable LLM calls with `stableHash` + `cacheGet/cacheSet` for idempotency.
- Validate all external outputs with Zod schemas before persisting or returning.
- Keep DB writes behind server-side helpers (`threadState.ts`) to retain invariants.

Common Patterns:

- Rate-limit preview-like endpoints then cache results by a stable key.
- Enrich UI graph nodes using server-computed `meta`

### Canonical Cache Key Templates (for LLM consumption)

```json
{
  "translator_preview": {
    "template": "translator_preview:${stableHash({ poem, enhanced, summary, ledgerNotes, acceptedLines, glossary, placeholderId })}",
    "params": [
      "poem",
      "enhanced",
      "summary",
      "ledgerNotes",
      "acceptedLines",
      "glossary",
      "placeholderId"
    ],
    "ttl_sec": 3600
  },
  "translate": {
    "template": "translate:${stableHash({ poem, enhanced, summary, ledger, acceptedLines, glossary })}",
    "params": [
      "poem",
      "enhanced",
      "summary",
      "ledger",
      "acceptedLines",
      "glossary"
    ],
    "ttl_sec": 3600
  },
  "enhancer": {
    "template": "enhancer:${stableHash({ poem, fields })}",
    "params": ["poem", "fields"],
    "ttl_sec": 3600
  }
}
```

Notes:

- `stableHash` sorts object keys before hashing to ensure deterministic keys.
  ```5:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
  export function stableHash(obj: unknown): string {
    const json = JSON.stringify(
      obj,
      Object.keys(obj as Record<string, unknown>).sort()
    );
    return crypto.createHash("sha256").update(json).digest("hex");
  }
  ```
