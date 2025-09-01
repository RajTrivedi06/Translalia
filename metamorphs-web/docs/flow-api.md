# Flow API (dev smoke)

Status: Phases 1–5 landed. Preview/instruct generate nodes with labels and Overview, nodes API is thread-scoped, sheet shows optimistic Overview, canvas renders from nodes API.

## Start

curl -X POST http://localhost:3000/api/flow/start \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>",
"poem": "Salt wind \n broken oar"
}'

## Answer (advance one step)

curl -X POST http://localhost:3000/api/flow/answer \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>",
"questionId": "q1_target",
"answer": "Moroccan Arabic, Casablanca urban register"
}'

## Peek (next question + phase)

GET /api/flow/peek?threadId=<THREAD_UUID>

- 200: { ok: true, phase, nextQuestion?: { id, prompt } | null, snapshot: { poem_excerpt, collected_fields } }
- 400: { error: "threadId required" }
- 404: { error: "Thread not found" }
- 500: { error: string } (e.g., missing column guidance)

## Confirm (move to translating)

curl -X POST http://localhost:3000/api/flow/confirm \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>"
}'

- 200: { ok: true, phase: "translating" }
- 400: { error }
- 404: { error: "Thread not found" }
- 409: { error: "Not at plan gate" }
- 500: { error }

## Journey Activity (recent events)

GET /api/journey/list?projectId=<PROJECT_UUID>&limit=20

- Auth: supports Supabase auth cookies and `Authorization: Bearer <access_token>`.
- 200: `{ ok: true, items: [{ id, kind, summary, meta, created_at }] }`
- 400/500: `{ error }`

Notes:

- Items include `accept_line` per-line entries and a batch summary like “Accepted N line(s)”. The UI groups consecutive accepts from the same submit into one entry with a collapsible details section.

## Translator — Preview (Phase 2)

POST /api/translator/preview

- Auth: cookie and/or `Authorization: Bearer <access_token>`
- Body: `{ threadId: uuid }`
- Behavior:
  - Allocates next label (A/B/C…)
  - Inserts placeholder in `versions` with `project_id`, `meta.thread_id`, `meta.display_label`, `meta.status:"placeholder"`
  - Calls LLM and updates row: `meta.status:"generated"`, `meta.overview:{ lines[], notes[] }`
  - Returns `{ ok, versionId, displayLabel, preview }`
- Failure hardening: returns 401 if unauthenticated; 500 with `UPDATE_FAILED_RLS` or `NO_OVERVIEW_PERSISTED` if RLS prevents update.

## Translator — Instruct (Phase 4)

POST /api/translator/instruct

- Body: `{ threadId: uuid, instruction: string, citeVersionId?: uuid }`
- Behavior: Like preview, but sets `meta.parent_version_id` and includes cited version text when provided.

## Nodes API (Phase 2+)

GET /api/versions/nodes?threadId=<THREAD_UUID>

- Auth: cookie/Bearer
- Response: `{ ok, threadIdEcho, count, nodes: [{ id, display_label, status, parent_version_id, overview, complete, created_at }] }`
- DB filter: `filter("meta->>thread_id","eq",threadId)`

---

## Flow State & Transitions

- States: `welcome` → `interviewing` → `await_plan_confirm` → `translating` → `review` → `finalized`
- Transitions:
  - Start: set `phase:"interviewing"`, store `poem_excerpt`, reset collected fields
  - Answer: merge into `collected_fields`; compute next question
  - Confirm: requires `await_plan_confirm` → moves to `translating`
  - Preview/Translate: allowed when `phase` is `translating` or `review`
- Invalid transitions return 409 with an explanatory error

## Validation & Errors

- Zod schemas validate all flow endpoints; return 400 with `.flatten()`
- 404 when thread not found; 409 for phase mismatches

## Execution & Retry Patterns

- Idempotent operations (e.g., preview) are safe to retry due to cache keys
- For answer/confirm, rely on server-side `patchThreadState` for atomic merges

## Monitoring & Logging

- `journey_items` captures key events: interview_started, interview_answer, plan_confirmed, accept_line, compare
- Use this for UIs and audits

## Rollback/Compensation

- For incorrect accepts, submit a new accept for the same line with corrected text (RPC overwrites)
- For plan changes, re-run enhancer or revise collected fields and reconfirm

## Flow Implementation Guide (LLM)

- Validate inputs; gate by `phase` and return 409 if not ready
- Append to `journey_items` after important steps
- Keep prompts and state snapshots minimal and explicit
