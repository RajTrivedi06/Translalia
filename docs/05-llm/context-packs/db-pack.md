# Database Context Pack

## Load This For
- Supabase schema changes
- JSONB state-path work
- debugging persistence or concurrent-write bugs

## Open These Files First
- `translalia-web/supabase/migrations/20240117_add_exec_sql_rpc.sql`
- `translalia-web/supabase/migrations/20260121_diary_completed_poems.sql`
- `translalia-web/src/server/guide/updateGuideState.ts`
- `translalia-web/src/lib/workshop/jobState.ts`
- `translalia-web/src/app/api/notebook/notes/route.ts`
- `translalia-web/src/app/api/diary/completed-poems/route.ts`

## Entities To Keep In Mind
- Tables: `chat_threads`, `projects`, `profiles`, `journey_reflections`, `journey_ai_summaries`, `journey_items_archive`, `prompt_audits`, `translation_audits`
- Storage buckets: `avatars` (profile image uploads; URL stored in `profiles.avatar_url`)
- RPCs: `exec_sql`, `patch_thread_state_field`, `diary_completed_poems` (`append_method2_audit` exists in migrations but is deprecated; audits go to `translation_audits`)
- Important JSONB paths: `translation_job`, `workshop_lines`, `notebook_notes`, `variant_recipes_v3` (legacy reads: `variant_recipes_v2`, `variant_recipes_v1`)

## DB Invariants
- Thread ownership is the dominant access pattern.
- Atomic state patching is a requirement, not a convenience.
- Diary data is derived from saved workshop lines plus latest journey summary rows.
- Guide answers are transitioning from JSONB storage to dedicated columns; docs should mention both until the legacy path is removed.

## Read Next
- `docs/02-reference/database.md`
- `docs/reference/db-mapping.md`
- `docs/03-guides/add-migration.md`
