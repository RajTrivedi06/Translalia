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

## API conventions

- Error shape: `{ error: string | zodFlattened }` with appropriate HTTP status.
- Auth: Accept Supabase cookies; prefer `Authorization: Bearer <access_token>` when available.
