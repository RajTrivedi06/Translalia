# Data Flow

## What this file is for
Operational view of the request and state flows that matter most for feature work and debugging.

## 1. Auth and Session Sync
1. Client auth events are posted to `/api/auth`.
2. `/api/auth` calls Supabase SSR helpers and updates response cookies.
3. Protected routes typically use one of two guards:
   - `src/lib/auth/requireUser.ts` for App Router routes using `supabaseServer()`
   - `src/lib/apiGuard.ts` for routes that accept `NextRequest` directly
4. Both guards try cookie auth first, then bearer-token fallback.

## 2. Project and Thread Lifecycle
1. `/api/projects` creates or deletes a workspace-level project.
2. `/api/threads` creates or deletes threads under a project.
3. `/api/threads/list` reads the threads for one project after verifying ownership.
4. Most later product state hangs off `chat_threads`, either as columns or JSONB fields in `state`.

## 3. Guide Rail to Persistent Translation Context
1. Guide UI stores transient client state in `useGuideStore`.
2. Server-side guide updates use `src/server/guide/updateGuideState.ts`.
3. Translation-critical guide fields now prefer dedicated columns on `chat_threads`:
   - `translation_model`
   - `translation_method`
   - `translation_intent`
   - `translation_zone`
   - `source_language_variety`
4. Legacy JSONB `state.guide_answers` is still read as fallback.

## 4. Interactive Workshop Translation
1. `useTranslateLine()` chooses `/api/workshop/translate-line` for `method-1` or `/api/workshop/translate-line-with-recipes` for `method-2`.
2. The route validates input, authenticates the caller, checks ownership, and rate-limits the request.
3. It loads thread context from `chat_threads`, merges guide data, and infers source/target language context.
4. `method-2` delegates to `translateLineWithRecipesInternal()` in `src/lib/translation/method2`.
5. The response returns a `LineTranslationResponse` with three variants and alignment arrays; for method-2, alignments may initially be empty and filled later by the background worker.

## 5. Background Translation Jobs
1. `/api/workshop/initialize-translations` creates a `translation_job` in thread state and enqueues work.
2. `useTranslationJob()` polls `/api/workshop/translation-status?advance=true`.
3. `runTranslationTick()` acquires a per-thread lock, reconciles queue state, processes one or more chunks/stanzas, and writes progress back to `state.translation_job`.
4. `scripts/translation-worker.ts` is the longer-running worker path; it pulls queued jobs from Redis and re-enqueues unfinished work.
5. Alignment jobs use a separate Redis queue and can complete after the text variants are already visible.

## 6. Saving Workshop Output
1. `/api/workshop/save-line` writes the chosen variant into `state.workshop_lines`.
2. `/api/workshop/save-manual-line` writes a manual translation into the same structure.
3. If Track A verification is enabled, saving a line can trigger `/api/verification/grade-line` asynchronously.
4. Some workshop writers still update full `state.workshop_lines` arrays directly, so concurrent-write safety remains important elsewhere in the system.

## 7. Notebook and Reflection
1. `/api/notebook/notes` and `/api/notebook/notes/line` persist notebook notes into `state.notebook_notes` using atomic JSONB patching.
2. `/api/notebook/suggestions` runs a three-step flow:
   - identify formal features
   - suggest adjustments
   - personalize guidance
3. `/api/notebook/ai-assist`, `/api/notebook/poem-suggestions`, and `/api/notebook/prismatic` are adjacent notebook-side AI helpers.
4. Reflection/journey routes read from thread state, notebook notes, and profile data to create journey summaries and feedback artifacts.

## 8. Verification
1. Track A route: `/api/verification/grade-line`
2. Track B route: `/api/verification/context-notes`
3. Verification writes prompt audits, reads `workshop_lines`, and uses separate feature flags for the two tracks.
4. `/api/verification/health` exposes in-memory verification metrics and current flag state.

## 9. Diary Archive
1. `/api/diary/completed-poems` calls the `diary_completed_poems` RPC.
2. The RPC derives completed poems from `chat_threads`, `workshop_lines`, `notebook_notes`, and the latest `journey_ai_summaries` row.
3. The diary page consumes the RPC response rather than the full thread-state blob.

## Failure Modes Worth Preserving
- Missing `exec_sql` or `patch_thread_state_field` breaks atomic state patching.
- Missing Redis is tolerated in some dev paths but becomes a production problem for locks/queues.
- Background translation status can appear stale if polling stops early or lock contention hides an active tick.
- Many routes still merge legacy JSONB state with newer column-based fields; documentation should reflect both until the old path is removed.

## Read Next
- `docs/02-reference/api.md`
- `docs/02-reference/database.md`
- `translalia-web/docs/TRANSLATION_PIPELINE.md`
