## Services & Integrations

### Overview

External services and platform integrations used by the application.

### Supabase

- Auth and PostgreSQL database
- Clients in `lib/supabaseClient.ts` and `lib/supabaseServer.ts`
- Auth helpers in `lib/authHelpers.ts`
- Environment:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- SSR session bootstrap: `middleware.ts` with `createMiddlewareClient`
- Route auth guard: `lib/apiGuard.ts` (cookies + Authorization: Bearer)

### OpenAI-Compatible LLMs

- Clients and config in `lib/ai/openai.ts`
- Moderation and policy enforcement in `lib/ai/moderation.ts` and `docs/moderation-policy.md`
- Caching in `lib/ai/cache.ts`
- Models in `lib/models.ts`; env overrides:
  - `OPENAI_API_KEY` (required)
  - `TRANSLATOR_MODEL` (default `gpt-4o`)
  - `ENHANCER_MODEL` (default `gpt-4o-mini`)
  - `EMBEDDINGS_MODEL` (default `text-embedding-3-large`)
- Feature flags (UI + API availability):
  - `NEXT_PUBLIC_FEATURE_TRANSLATOR`
  - `NEXT_PUBLIC_FEATURE_ENHANCER`
  - `NEXT_PUBLIC_FEATURE_ROUTER`

### RAG & Content

- Retrieval helpers in `lib/rag.ts`
- Constraints and policy in `lib/constraints.ts` and `lib/policy.ts`
- Current implementation is stubbed; replace with vector store when ready

### Rate Limiting

- Helpers in `lib/ai/ratelimit.ts`
- Apply in route handlers via `lib/apiGuard.ts` where appropriate
- Currently used on `/api/translator/preview` (key: `preview:${threadId}`, 30/min)

---

## SERVICES_INTEGRATIONS

### 1) Supabase client configuration

- Browser: `lib/supabaseClient.ts`

```ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);
```

- Server: `lib/supabaseServer.ts` with cookie adapter

### 2) Authentication flow

- `useSupabaseUser` loads user via `supabase.auth.getUser()` and subscribes via `onAuthStateChange`
- API routes use `requireUser` to enforce auth with Authorization header passthrough
- Debug: `GET /api/debug/whoami` shows cookie names, bearer presence, and uid

### 3) Storage bucket setup

- Bucket `avatars` for user profile images; paths `userId/timestamp_filename`
- Public URL retrieval via `supabase.storage.from("avatars").getPublicUrl(path)`

### 4) Real-time subscriptions

- Auth: handled via Supabase client auth subscription
- DB realtime not currently implemented

### 5) Third-party services

- OpenAI (moderation + chat completions) via `lib/ai/openai.ts`
- Rate limits and caching wrap LLM endpoints to control cost/latency

### 6) API client configurations

- Models in `lib/models.ts`; feature flags via `process.env.NEXT_PUBLIC_FEATURE_*`
- Translator system prompt in `lib/ai/prompts.ts`

### 7) Error handling and retry logic

- Translator preview: moderation gate, rate limit (429), cache, and structured 4xx/5xx errors
- UI retries via buttons (e.g., retry preview) and React Query refetches
- Common statuses: 400 (Zod validation), 401 (unauthorized), 403 (feature disabled/forbidden), 404 (not found), 409 (invalid state), 429 (rate limit), 502 (LLM parse)

### 8) Example calls

```ts
// Enhancer
await fetch("/api/enhancer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ threadId }),
});

// Translator Preview (flag + auth required)
await fetch("/api/translator/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ threadId }),
});

// Instruct translator
await fetch("/api/translator/instruct", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ threadId, instruction, citeVersionId }),
});
```

### 9) Troubleshooting

- 401 Unauthorized: ensure Supabase session exists or pass Bearer token from `supabase.auth.getSession()`.
- 403 Feature disabled: set the appropriate `NEXT_PUBLIC_FEATURE_*` flag to "1" and rebuild.
- 429 Rate limit: throttle requests; preview endpoint allows ~30/min per thread.
- 502 LLM parse error: capture `raw` field from response for prompt debugging.
