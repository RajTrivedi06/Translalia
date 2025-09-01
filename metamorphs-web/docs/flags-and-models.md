# Flags and Models

## Database schema note: chat_threads.state

The application expects a `jsonb` column `state` on `public.chat_threads` used to persist the per-thread session state. If you see errors like `column chat_threads.state does not exist` (SQLSTATE 42703), apply the following migration in Supabase SQL editor:

```sql
alter table public.chat_threads
  add column if not exists state jsonb not null default '{}'::jsonb;
```

This repo does not yet include a migrations directory; consider adopting the Supabase CLI to track migrations under `supabase/migrations/` to avoid environment drift.

# Flags & Models (Phase 0)

- NEXT_PUBLIC_FEATURE_ENHANCER: 0/1
- NEXT_PUBLIC_FEATURE_TRANSLATOR: 0/1
  Defaults (OpenAI-only): enhancer=gpt-4o-mini, translator=gpt-4o, embeddings=text-embedding-3-large.
  Keep flags OFF in prod until staging review passes.

## Phase flags (current)

- Translator: ON in dev (`NEXT_PUBLIC_FEATURE_TRANSLATOR=1`)
- Enhancer: optional (`NEXT_PUBLIC_FEATURE_ENHANCER=1`)
- Preview and Instruct endpoints both require auth; routes accept Supabase cookies and Bearer.

## API conventions

- Error shape: `{ error: string | zodFlattened }` with appropriate HTTP status.
- Auth: Accept Supabase cookies; prefer `Authorization: Bearer <access_token>` when available.
- RLS: `versions` insert/update requires `project_id`; thread scoping is enforced via `meta.thread_id`.

---

## Feature Flags – Details

Flags:

- `NEXT_PUBLIC_FEATURE_TRANSLATOR` (default: off)
- `NEXT_PUBLIC_FEATURE_ENHANCER` (default: off)
- `NEXT_PUBLIC_FEATURE_ROUTER` (default: off)

Usage:

- UI and routes check flags to enable flows; disabled returns 403 in routes.
- Treat flags as environment-scoped (dev/staging/prod); change via env vars and redeploy.

Guide (LLM):

- Gate new endpoints behind `NEXT_PUBLIC_FEATURE_*` and return 403 when off.
- Avoid branching deep in business logic: return early in routes.

---

## Models – Selection & Fallback

Env-based selection (see `lib/models.ts`):

- `ENHANCER_MODEL` → enhancer (default `gpt-4o-mini`)
- `TRANSLATOR_MODEL` → translator (default `gpt-4o`)
- `EMBEDDINGS_MODEL` → embeddings (default `text-embedding-3-large`)

Fallback strategy:

- No automatic runtime failover; set envs to switch models.
- Consider adding a secondary when `ANTHROPIC_API_KEY` is present.

---

## A/B and Env Config

- For A/B, prefer top-level flags like `NEXT_PUBLIC_FEATURE_TRANSLATOR_B` and route to alternate prompts or models.
- Keep per-env `.env.local` / project secrets in Vercel/Supabase config.
