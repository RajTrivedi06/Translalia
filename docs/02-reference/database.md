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
| `profiles` | User profile data (`locale`, `avatar_url`, etc.) | auth middleware, auth helpers, journey/reflection generation, profile UI |
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
| `express_your_view` | Student's post-AI "Express Your View" reflection (single string). Autosaved, distinct from `notebook_notes`. |
| `translation_insights` | Latest Translation Insights snapshot from reflection rail step-c (`aims`, `suggestions`, `confidence`, `generated_at`). |
| `refine_rhyme` | Refine & Rhyme artifacts: optional `formalFeatures`, `adjustments`, `personalize` sub-objects plus `updated_at`. Steps persist independently. |
| `variant_recipes_v3` | Current cached method-2 recipe bundle by mode. |
| `variant_recipes_v2` | Legacy recipe cache; read for backward compatibility and migrated to v3. |
| `variant_recipes_v1` | Legacy recipe cache; read-only fallback in `variantRecipes.ts`. |
| `raw_poem` | Legacy JSONB fallback; `updateGuideState.ts` prefers the `raw_poem` column and strips this from JSONB on write. |

## Confirmed RPCs

| RPC | Defined in | Purpose |
| --- | --- | --- |
| `exec_sql` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | Parameterized SQL execution for atomic JSONB patching. |
| `patch_thread_state_field` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | Dedicated atomic patch helper for `chat_threads.state`. |
| `append_method2_audit` | `supabase/migrations/20240117_add_exec_sql_rpc.sql` | **Deprecated.** Legacy RPC for `state.method2_audit`; production writes use the `translation_audits` table via `src/lib/ai/audit.ts`. |
| `diary_completed_poems` | `supabase/migrations/20260121_diary_completed_poems.sql`; extended by `20260621_diary_express_your_view.sql` and `20260622_diary_ai_artifacts.sql` | Return completed poems for the authenticated user (includes `express_your_view`, `translation_insights`, journey summary). The API omits `refine_rhyme` from diary responses. |

## Ownership and Access
- Project ownership is checked via `projects.owner_id`.
- Thread ownership is checked via `chat_threads.created_by`.
- The diary RPC uses `auth.uid()` in SQL and returns authenticated-user rows only.
- Many routes both rely on Supabase session context and then perform explicit ownership checks in application code.

## Concurrency Guarantees That Matter
- `patchThreadStateField()` is the intended path for atomic JSONB updates.
- The unsafe read-modify-write fallback for thread-state patching has been removed on purpose.
- `translation_job`, `workshop_lines`, `notebook_notes`, and recipe caches are the most concurrency-sensitive state paths.
- Method-2 audit rows are written to `translation_audits`, not appended into JSONB.

## Known Gaps
- The repo does not include a complete migration history for every table referenced by code.
- Some current schema knowledge is inferred from route usage rather than table DDL in this repo.

## Read Next
- `docs/reference/db-mapping.md`
- `docs/03-guides/add-migration.md`
- `specs/openapi.yaml`
