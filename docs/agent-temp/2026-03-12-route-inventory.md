# Route Inventory

## Purpose
Working inventory of API handlers used to rebuild the permanent API docs and OpenAPI file.

## Source
- `translalia-web/src/app/api/**/route.ts`
- Extracted on 2026-03-12 from the local repo state

## Inventory

| Path | Methods | Domain | Notes |
| --- | --- | --- | --- |
| `/api/auth` | `POST` | auth | Syncs Supabase auth events into SSR cookies. |
| `/api/auth/debug-cookies` | `GET` | auth/debug | Cookie inspection helper. |
| `/api/auth/whoami` | `GET` | auth | Returns authenticated user id. |
| `/api/debug/env-check` | `GET` | debug | Disabled in production via `VERCEL_ENV`. |
| `/api/debug/test-rpc` | `GET` | debug | Checks Supabase RPC availability. |
| `/api/debug/whoami` | `GET` | debug | Debug auth check. |
| `/api/diary/completed-poems` | `GET` | diary | Uses `diary_completed_poems` RPC with cursor pagination. |
| `/api/eval/run` | `POST` | eval | Experimental/internal route. |
| `/api/health` | `GET` | health | Minimal process health check. |
| `/api/journey/generate-brief-feedback` | `POST` | journey | Generates short feedback for a thread. |
| `/api/journey/generate-reflection` | `POST` | journey | Generates reflection and summary artifacts. |
| `/api/journey/list` | `GET` | journey | Lists archived journey items. |
| `/api/journey/save-reflection` | `POST` | journey | Saves user-authored reflection text. |
| `/api/notebook/ai-assist` | `POST` | notebook | Line or poem assistance in notebook flow. |
| `/api/notebook/notes` | `GET`, `POST` | notebook | Reads/writes `state.notebook_notes`. |
| `/api/notebook/notes/line` | `POST` | notebook | Atomic per-line note update. |
| `/api/notebook/poem-suggestions` | `POST` | notebook | Poem-level suggestion generation. |
| `/api/notebook/prismatic` | `POST` | notebook | Notebook-side prismatic generation path. |
| `/api/notebook/suggestions` | `POST` | notebook | Multi-step conversational suggestion workflow. |
| `/api/projects` | `POST`, `DELETE` | projects | Creates and deletes workspaces/projects. |
| `/api/reflection/ai-assist-step-c` | `POST` | reflection | Reflection rail contextual suggestions. |
| `/api/threads` | `POST`, `DELETE` | threads | Creates and deletes threads under a project. |
| `/api/threads/list` | `GET` | threads | Lists threads for one project. |
| `/api/verification/analytics` | `GET` | verification | Reads prompt-audit analytics. |
| `/api/verification/context-notes` | `POST` | verification | Generates educational context notes. |
| `/api/verification/feedback` | `POST` | verification | Writes verification feedback to audits. |
| `/api/verification/grade-line` | `POST` | verification | Track A grading for one saved line. |
| `/api/verification/grade/[auditId]` | `GET` | verification | Reads one stored audit result. |
| `/api/verification/health` | `GET` | verification | In-memory metrics and feature-flag status. |
| `/api/workshop/additional-suggestions` | `POST` | workshop | Extra line suggestions. |
| `/api/workshop/initialize-translations` | `POST` | workshop | Creates translation job and enqueues work. |
| `/api/workshop/line-suggestions` | `POST` | workshop | Rate-limited line suggestion route. |
| `/api/workshop/requeue-stanza` | `POST` | workshop | Requeues a stanza/chunk for processing. |
| `/api/workshop/retry-line` | `POST` | workshop | Regenerates a single line. |
| `/api/workshop/retry-stanza` | `POST` | workshop | Resets one stanza/chunk for retry. |
| `/api/workshop/rhyme-workshop` | `POST` | workshop | Rhyme/sound analysis workflow. |
| `/api/workshop/save-line` | `POST` | workshop | Saves selected variant to `state.workshop_lines`. |
| `/api/workshop/save-manual-line` | `POST` | workshop | Saves manually edited line to `state.workshop_lines`. |
| `/api/workshop/token-suggestions` | `POST` | workshop | Token-level suggestions. |
| `/api/workshop/translate-line` | `POST` | workshop | Legacy method-1 line translation. |
| `/api/workshop/translate-line-with-recipes` | `POST` | workshop | Default method-2 line translation path. |
| `/api/workshop/translation-status` | `GET` | workshop | Polling endpoint for background translation job state. |

## Classification Summary
- Stable/high-use: `auth`, `projects`, `threads`, `workshop/translate-line-with-recipes`, `workshop/initialize-translations`, `workshop/translation-status`, `notebook/notes`, `notebook/suggestions`, `diary/completed-poems`
- Internal/debug: `debug/*`, `auth/debug-cookies`, `eval/run`
- Transitional/legacy: `workshop/translate-line` remains active for `method-1`
