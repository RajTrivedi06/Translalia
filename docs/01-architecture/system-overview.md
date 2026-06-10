# System Overview

## What this file is for
High-level map of the runtime boundaries, core directories, and integration points that an agent should preserve.

## Runtime Shape
- One runnable app: `translalia-web/`
- Framework: Next.js App Router with React 19 and TypeScript
- UI state: Zustand stores with thread-scoped persistence
- Server state: TanStack Query on the client, Supabase-backed route handlers on the server
- Primary external services: Supabase, OpenAI, Upstash Redis, Datamuse

## Major Subsystems

| Subsystem | Primary paths | Responsibility |
| --- | --- | --- |
| App routes | `translalia-web/src/app/[locale]` | Locale-aware pages for workspaces, diary, account, auth, verification dashboard, and translation tuning. Legacy `/workspace` routes redirect to `/workspaces`. |
| API routes | `translalia-web/src/app/api` | Auth, project/thread CRUD, workshop flows, notebook flows, journey flows, verification, diary, debug, health. |
| Client state | `translalia-web/src/store` | Guide, workshop, notebook, and workspace state persisted per thread. |
| Hooks | `translalia-web/src/lib/hooks`, `translalia-web/src/hooks` | Query/mutation helpers and auth/thread utilities. |
| Translation + AI | `translalia-web/src/lib/ai`, `translalia-web/src/lib/translation/method2`, `translalia-web/src/lib/workshop` | Prompt builders, model calls, gating, queueing, recipe handling, translation job orchestration. |
| Server-side state mutation | `translalia-web/src/server` | Audit writes and atomic JSONB patching helpers. |
| Database changes | `translalia-web/supabase/migrations` | SQL migrations and RPC definitions. |

## Core Product Flows
- Guide rail captures poem text, translation intent, translation mode, and model/method choices.
- Workshop generates line-level variants, lets users save selections or manual edits, and manages background translation jobs.
- Notebook supports notes, poem-level suggestions, and full-poem assembly/refinement.
- Journey/reflection generates reflective outputs and archive material.
- Diary displays completed poems using a dedicated RPC.
- Verification provides grading and context-note tracks behind feature flags.

## State Boundaries That Matter
- Long-lived collaborative state lives in Supabase, mainly `chat_threads` and related tables.
- Per-thread local UI state is kept in Zustand via `threadStorage`.
- `chat_threads.state` is a mixed JSONB document containing high-value fields such as `translation_job`, `workshop_lines`, `notebook_notes`, `variant_recipes_v3` (with legacy `variant_recipes_v2`/`v1` reads), and legacy `guide_answers`.
- Atomic JSONB updates matter; `patchThreadStateField()` exists specifically to avoid state clobber on concurrent writers.

## Current Translation Architecture
- `method-2` is the default translation method.
- ADR 0002 documents the accepted shift to simplified prompts with `USE_SIMPLIFIED_PROMPTS=1` as the default path.
- The older archetype-based recipe path still exists for rollback and legacy maintenance.

## External Dependencies

| Dependency | Used for | Main paths |
| --- | --- | --- |
| Supabase | auth, Postgres access, SSR cookies | `src/lib/supabase*`, `src/lib/auth/*`, API routes |
| OpenAI | translation, notebook suggestions, journey, verification | `src/lib/ai/*`, `src/lib/translation/method2/*` |
| Upstash Redis | rate limiting, locks, translation/alignment queues, cache | `src/lib/ratelimit/redis.ts`, `src/lib/ai/cache.ts`, `src/lib/workshop/*Queue.ts` |
| Datamuse | rhyme lookup | `src/lib/rhyme/rhymeService.ts` |

## Directory Reading Order
1. `translalia-web/src/app/api` for server behavior
2. `translalia-web/src/lib/translation/method2` and `translalia-web/src/lib/ai` for translation logic
3. `translalia-web/src/store` and `translalia-web/src/lib/hooks` for UI state/data flow
4. `translalia-web/src/server` and `translalia-web/supabase/migrations` for persistence guarantees

## Read Next
- `docs/01-architecture/data-flow.md`
- `docs/02-reference/api.md`
- `docs/02-reference/database.md`
- `docs/05-llm/DOC_MAP.md`
