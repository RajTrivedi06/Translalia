# Database Entity Map

## Purpose
Working map of confirmed tables, JSONB state fields, and RPCs referenced by code.

## Confirmed tables
- `chat_threads`
- `projects`
- `profiles`
- `journey_reflections`
- `journey_ai_summaries`
- `journey_items_archive`
- `prompt_audits`
- `translation_audits`
- `avatars`

## Confirmed RPCs
- `diary_completed_poems`
- `exec_sql`
- `patch_thread_state_field`
- `append_method2_audit`

## High-value `chat_threads.state` fields
- `guide_answers` (legacy fallback; columns are the preferred source now)
- `poem_analysis`
- `poem_stanzas`
- `translation_job`
- `workshop_lines`
- `notebook_notes`
- `variant_recipes_v3`
- `method2_audit`
- `raw_poem`

## Ownership and access patterns
- `projects.owner_id` is checked for project ownership.
- `chat_threads.created_by` is checked for thread ownership.
- `diary_completed_poems` uses `auth.uid()` in SQL and returns only authenticated user rows.
- Most API routes fetch via Supabase using the caller session and then do explicit ownership checks in code.

## Concurrency-sensitive areas
- Atomic JSONB patching is required for `chat_threads.state` writes.
- `patchThreadStateField()` depends on the `exec_sql` RPC and intentionally removed the unsafe read-modify-write fallback.
- Translation job state and audit writes are called out in code as clobber-sensitive.
