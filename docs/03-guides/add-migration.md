# Add Migration Guide

## What this file is for
Pattern for adding a Supabase migration or RPC in `translalia-web/supabase/migrations`.

## Current Repo Reality
- This repo already contains SQL migrations for atomic JSONB RPCs and the diary archive RPC.
- Migration filenames use a timestamp-style prefix.

## Workflow
1. Add a new SQL file under `translalia-web/supabase/migrations/`.
2. Prefer additive changes.
3. If you add a new RPC, include:
   - function definition
   - grants
   - a short SQL comment explaining why the RPC exists
4. If the migration changes `chat_threads.state` update strategy, verify it does not reintroduce clobber-prone writes.

## RPC Guidance
- Use dedicated RPCs when application code needs atomic JSONB updates or carefully scoped database-side logic.
- Existing patterns to study:
  - `exec_sql`
  - `patch_thread_state_field`
  - `append_method2_audit`
  - `diary_completed_poems`

## Rollout Rules
- Keep migrations reversible in spirit, even if exact rollback SQL is not committed alongside them.
- Never assume production Redis, queues, or jobs can compensate for a broken schema change.
- If an API route depends on the migration, update the docs in the same change.

## Documentation Update Checklist
- Update `docs/02-reference/database.md`.
- Update `docs/reference/db-mapping.md` if the change affects entity relationships or JSONB paths.
- Update `docs/reference/integrations.md` if the migration changes service boundaries.
- Update `specs/openapi.yaml` if API behavior depends on the new schema/RPC.

## Validation Checklist
- Migration is syntactically valid SQL.
- Grants are present where authenticated callers need the function.
- New RPC names are reflected in permanent docs.
- Any JSONB update helper still preserves concurrent writes safely.

## Read Next
- `docs/02-reference/database.md`
- `docs/reference/db-mapping.md`
