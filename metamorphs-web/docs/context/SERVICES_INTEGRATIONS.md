## Services & Integrations

### Overview

External services and platform integrations used by the application.

### Supabase

- Auth and PostgreSQL database
- Clients in `lib/supabaseClient.ts` and `lib/supabaseServer.ts`
- Auth helpers in `lib/authHelpers.ts`

### OpenAI-Compatible LLMs

- Clients and config in `lib/ai/openai.ts`
- Moderation and policy enforcement in `lib/ai/moderation.ts` and `docs/moderation-policy.md`
- Caching in `lib/ai/cache.ts`

### RAG & Content

- Retrieval helpers in `lib/rag.ts`
- Constraints and policy in `lib/constraints.ts` and `lib/policy.ts`

### Rate Limiting

- Helpers in `lib/ai/ratelimit.ts`
- Apply in route handlers via `lib/apiGuard.ts` where appropriate

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

### 3) Storage bucket setup

- Bucket `avatars` for user profile images; paths `userId/timestamp_filename`
- Public URL retrieval via `supabase.storage.from("avatars").getPublicUrl(path)`

### 4) Real-time subscriptions

- Auth: handled via Supabase client auth subscription
- DB realtime not currently implemented

### 5) Third-party services

- OpenAI (moderation + chat completions) via `lib/ai/openai.ts`

### 6) API client configurations

- Models in `lib/models.ts`; feature flags via `process.env.NEXT_PUBLIC_FEATURE_*`

### 7) Error handling and retry logic

- Translator preview: moderation gate, rate limit (429), cache, and structured 4xx/5xx errors
- UI retries via buttons (e.g., retry preview) and React Query refetches
