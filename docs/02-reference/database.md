# Database Reference

## What this file is for
Confirmed database and persistence map for the current repo state.

## Scope Note
Only entities and RPCs directly referenced by code or migrations are documented here. This repo does not contain a full SQL schema dump.

## Confirmed Tables

| Table | Used for | Main readers/writers |
| --- | --- | --- |
| `chat_threads` | Primary thread record plus JSONB workflow state | workshop routes, notebook routes, journey routes, verification routes, server guide helpers, worker/job code |
| `projects` | Workspace/project container | project routes, thread list routes, workspace pages |
| `profiles` | User profile data | auth helpers, journey/reflection generation, profile UI |
| `journey_reflections` | Saved reflection text | journey save/generate routes |
| `journey_ai_summaries` | Generated journey summaries and diary enrichment | journey generation, diary RPC |
| `journey_items_archive` | Archived journey items | `/api/journey/list` |
| `prompt_audits` | Prompt/audit records | verification analytics, verification feedback, audit read routes |
| `translation_audits` | translation-related audit records | `src/lib/ai/audit.ts` |

## Storage Buckets

| Bucket | Purpose |
| --- | --- |
| `avatars` | Profile image uploads. Files are stored via `supabase.storage.from('avatars')` in `ProfileForm.tsx`. The resulting public URL is written to `profiles.avatar_url`. |

## High-Value `chat_threads` Columns
- `id`
- `project_id`
- `created_by`
- `title`
- `raw_poem`
- `translation_model`
- `translation_method`
- `translation_intent`
- `translation_zone`
- `source_language_variety`
- `state` (JSONB)

## High-Value `chat_threads.state` Paths

| JSONB path | Purpose |
| --- | --- |
| `guide_answers` | Legacy guide answer fallback; columns are preferred now. |
| `poem_analysis` | Source-language analysis and source-line context. |
| `poem_stanzas` | Stanza detection data used by workshop flows. |
| `translation_job` | Background translation queue/progress state. |
| `workshop_lines` | Saved line translations and verification payloads. |
| `notebook_notes` | Thread note plus line notes. |
| `variant_recipes_v3` | Cached method-2 recipe bundle by mode. |
| `method2_audit` | Translation audit trail. |
| `raw_poem` | JSONB fallback copy used by some routes. |

## Confirmed RPCs

| RPC | Defined in | Purpose |
| --- | --- | --- |
| `exec_sql` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | Parameterized SQL execution for atomic JSONB patching. |
| `patch_thread_state_field` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | Dedicated atomic patch helper for `chat_threads.state`. |
| `append_method2_audit` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | Atomic append to `state.method2_audit`. |
| `diary_completed_poems` | `supabase/migrations/20260121_diary_completed_poems.sql` | Return completed poems for the authenticated user. |

## Ownership and Access
- Project ownership is checked via `projects.owner_id`.
- Thread ownership is checked via `chat_threads.created_by`.
- The diary RPC uses `auth.uid()` in SQL and returns authenticated-user rows only.
- Many routes both rely on Supabase session context and then perform explicit ownership checks in application code.

## Concurrency Guarantees That Matter
- `patchThreadStateField()` is the intended path for atomic JSONB updates.
- The unsafe read-modify-write fallback for thread-state patching has been removed on purpose.
- `translation_job`, `workshop_lines`, `notebook_notes`, and method-2 audits are the most concurrency-sensitive state paths.

## Known Gaps
- The repo does not include a complete migration history for every table referenced by code.
- Some current schema knowledge is inferred from route usage rather than table DDL in this repo.

## Read Next
- `docs/reference/db-mapping.md`
- `docs/03-guides/add-migration.md`
- `specs/openapi.yaml`
