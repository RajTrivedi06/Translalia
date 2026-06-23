# API Reference

## What this file is for
Route catalog for the current Next.js API surface. Use this before opening route files directly.

## Auth Model
- Most non-debug routes require a Supabase-authenticated user.
- Two guard implementations are active:
  - `src/lib/auth/requireUser.ts`
  - `src/lib/apiGuard.ts`
- Both try cookie auth first and bearer-token auth second.
- Debug routes are gated behind auth and return `404` in production-like environments (`NODE_ENV=production` or `VERCEL_ENV=production`) unless `DEBUG_API_ENABLED=1`.

## Route Classification
- `public` means callable by a logged-in end user and part of a product flow.
- `internal` means still in the app surface but mainly intended for internal workflows or supporting UI behavior.
- `debug` means development/diagnostic only.
- `experimental` means not part of the core product contract yet.

## Endpoint Catalog

| Domain | Method | Path | Classification | Purpose |
| --- | --- | --- | --- | --- |
| auth | `POST` | `/api/auth` | public | Sync Supabase auth events into SSR cookies. |
| auth | `GET` | `/api/auth/whoami` | public | Return authenticated user id. |
| auth | `GET` | `/api/auth/debug-cookies` | debug | Inspect auth cookies (auth required, production-disabled unless explicitly enabled). |
| debug | `GET` | `/api/debug/env-check` | debug | Show sanitized env/flag state (auth required, production-disabled unless explicitly enabled). |
| debug | `GET` | `/api/debug/test-rpc` | debug | Check Supabase RPC availability (auth required, production-disabled unless explicitly enabled). |
| debug | `GET` | `/api/debug/whoami` | debug | Minimal debug auth check (auth required, production-disabled unless explicitly enabled). |
| health | `GET` | `/api/health` | public | Minimal process health check. |
| projects | `POST` | `/api/projects` | public | Create a project/workspace. |
| projects | `DELETE` | `/api/projects` | public | Delete a project/workspace. |
| threads | `GET` | `/api/threads/list` | public | List threads for a project. |
| threads | `POST` | `/api/threads` | public | Create a thread. |
| threads | `DELETE` | `/api/threads` | public | Delete a thread. |
| workshop | `POST` | `/api/workshop/translate-line-with-recipes` | public | Default method-2 line translation path. |
| workshop | `POST` | `/api/workshop/translate-line` | internal | Legacy method-1 line translation path. |
| workshop | `POST` | `/api/workshop/initialize-translations` | public | Create a translation job and enqueue work. |
| workshop | `GET` | `/api/workshop/translation-status` | public | Poll translation job status and optionally advance work. |
| workshop | `POST` | `/api/workshop/save-line` | public | Save chosen variant to `state.workshop_lines`. |
| workshop | `POST` | `/api/workshop/save-manual-line` | public | Save manual translation to `state.workshop_lines`. |
| workshop | `POST` | `/api/workshop/retry-line` | internal | Retry one line. |
| workshop | `POST` | `/api/workshop/retry-stanza` | internal | Reset and requeue one stanza/chunk. |
| workshop | `POST` | `/api/workshop/requeue-stanza` | internal | Force one stanza/chunk back to the front of the queue. |
| workshop | `POST` | `/api/workshop/line-suggestions` | public | Generate line suggestions. |
| workshop | `POST` | `/api/workshop/token-suggestions` | public | Generate token-level suggestions. |
| workshop | `POST` | `/api/workshop/additional-suggestions` | public | Generate additional line suggestions. |
| workshop | `POST` | `/api/workshop/rhyme-workshop` | public | Analyze rhyme, rhythm, and sound. |
| notebook | `GET` | `/api/notebook/notes` | public | Fetch notebook notes for a thread. |
| notebook | `POST` | `/api/notebook/notes` | public | Save merged notebook notes for a thread. |
| notebook | `POST` | `/api/notebook/notes/line` | public | Save a single line note atomically. |
| notebook | `POST` | `/api/notebook/suggestions` | public | Run identify/adjust/personalize notebook suggestion steps; persists each step to `state.refine_rhyme`. |
| notebook | `POST` | `/api/notebook/ai-assist` | public | Notebook-side AI assist. |
| notebook | `POST` | `/api/notebook/poem-suggestions` | public | Whole-poem suggestions. |
| notebook | `POST` | `/api/notebook/prismatic` | internal | Notebook-side prismatic generation route. |
| journey | `GET` | `/api/journey/list` | public | List archived journey items. |
| journey | `POST` | `/api/journey/save-reflection` | public | Save reflection text. |
| journey | `POST` | `/api/journey/generate-reflection` | public | Generate reflection and summary artifacts. |
| journey | `POST` | `/api/journey/generate-brief-feedback` | public | Generate short journey feedback. |
| reflection | `GET` | `/api/reflection/artifacts` | public | Load persisted editing-rail AI artifacts (`translation_insights`, `refine_rhyme`, latest journey summary). |
| reflection | `GET` | `/api/reflection/express-your-view` | public | Fetch the student's post-AI reflection (`state.express_your_view`). |
| reflection | `POST` | `/api/reflection/express-your-view` | public | Save the student's post-AI reflection to `state.express_your_view`. |
| reflection | `POST` | `/api/reflection/ai-assist-step-c` | public | Reflection-rail contextual suggestions; persists latest snapshot to `state.translation_insights`. |
| verification | `POST` | `/api/verification/grade-line` | public | Grade one saved line (Track A). |
| verification | `POST` | `/api/verification/context-notes` | public | Generate context notes (Track B). |
| verification | `POST` | `/api/verification/feedback` | internal | Persist verification feedback. |
| verification | `GET` | `/api/verification/analytics` | internal | Read prompt-audit analytics. |
| verification | `GET` | `/api/verification/grade/{auditId}` | internal | Read one audit result. |
| verification | `GET` | `/api/verification/health` | internal | Read in-memory verification metrics and feature state. |
| diary | `GET` | `/api/diary/completed-poems` | public | Fetch completed poem archive via RPC. |
| eval | `POST` | `/api/eval/run` | experimental | Experimental evaluation route. |

## Stable Request and Response Contracts
- `specs/openapi.yaml` contains the machine-readable catalog for the current route set.
- High-use stable shapes are documented there for:
  - auth sync
  - project and thread CRUD
  - method-1 and method-2 line translation
  - translation job init/status polling
  - notebook notes
  - notebook suggestion steps
  - diary completed-poem archive

## Translation Status Response Semantics

`/api/workshop/translation-status` returns well-formed JSON for every edge state:

| Edge state | `edgeState` field | `job` | `progress` | Notes |
|-----------|-------------------|-------|------------|-------|
| No job exists | `"no-job"` | `null` | `null` | Thread exists but no translation has been started. |
| In progress | `"in-progress"` | present | present | Translation is actively being processed. |
| Completed | `"completed"` | present | present | All lines are translated. |
| Failed | `"failed"` | present | present | Job failed permanently. |

When `ENABLE_STATUS_READ_ADVANCE_SPLIT=1`, the route ignores the `advance` query parameter and always serves a read-only response. The worker is the sole advancement owner.

## Queue Admission Control

`/api/workshop/initialize-translations` applies admission control before enqueue:
- Queue depth limit: `TRANSLATION_MAX_QUEUE_DEPTH` (default: 100).
- Poem size limit: `MAX_POEM_LINES_FOR_TRANSLATION` (default: 200 lines).

Jobs that exceed max retries (5) without progress are moved to the dead-letter queue (`translation:dlq`) instead of being re-enqueued indefinitely.

Admission responses:
- `400`: poem exceeds `MAX_POEM_LINES_FOR_TRANSLATION`.
- `200`: job created or resumed. The route always returns `200` on success even when background enqueue is rejected (e.g. queue full); rejection is logged server-side. Clients should poll `/api/workshop/translation-status` to observe job progress.
- `429` does not apply to this route; rate limits apply to other high-cost LLM endpoints.

## Error Patterns
- Validation errors are usually `400`.
- Missing session is usually `401`.
- Ownership failures are usually `403`.
- Missing thread/project/audit is usually `404`.
- Rate-limited routes use `429`.
- LLM or internal processing failures typically surface as `500` or `502`.

## Rate-Limit Notes
- High-cost LLM routes are keyed with per-user daily budgets (not per-thread-only keys).
- Current rate-limited domains include:
  - workshop translation and retry paths
  - workshop suggestion/rhyme paths
  - notebook AI assist and suggestion paths
  - reflection and journey generation paths
  - verification grading/context generation paths

## Read Next
- `specs/openapi.yaml`
- `docs/03-guides/add-endpoint.md`
- `docs/reference/api-contracts.md`
