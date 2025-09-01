## API Routes

### Overview

This app uses Next.js Route Handlers (`route.ts`) under `src/app/api` for server-side endpoints. Authentication is via Supabase: cookie-based SSR by default, with optional Bearer token fallback where `requireUser` is used.

### Quick Reference

| Method | Path                                | Auth                 | Body/Query                                                  | Success                                    | Errors                            |
| ------ | ----------------------------------- | -------------------- | ----------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| POST   | /api/chat                           | none                 | { text }                                                    | 200 { ok, echo }                           | 400                               |
| POST   | /api/chat/[threadId]/messages       | Bearer/cookie        | { projectId, content, role?, meta? }                        | 201 { id, created_at }                     | 400, 401                          |
| POST   | /api/threads                        | Bearer/cookie        | { projectId, title? }                                       | 201 { thread }                             | 400, 401                          |
| DELETE | /api/threads                        | Bearer/cookie        | { id? or threadId? }                                        | 200 { ok:true }                            | 400, 401                          |
| POST   | /api/projects                       | Bearer/cookie        | { title?, src_lang?, tgt_langs? }                           | 201 { project }                            | 400, 401                          |
| DELETE | /api/projects                       | Bearer/cookie        | { id? or projectId? }                                       | 200 { ok:true }                            | 400, 401                          |
| POST   | /api/versions                       | Bearer/cookie        | { projectId, title, lines, tags?, meta?, summary? }         | 201 { version }                            | 400, 401                          |
| PATCH  | /api/versions/positions             | Bearer/cookie        | { projectId, positions[] }                                  | 200 { ok:true }                            | 400, 401                          |
| GET    | /api/versions/nodes?threadId=       | Bearer/cookie        | threadId                                                    | 200 { ok, nodes[] }                        | 400, 403, 500                     |
| POST   | /api/compares                       | Bearer/cookie        | { projectId, leftId, rightId, lens?, granularity?, notes? } | 201 { compare }                            | 400, 401                          |
| POST   | /api/constraints                    | none                 | { text, rules }                                             | 200 { ... }                                | 400                               |
| POST   | /api/variants                       | none                 | { input, recipe }                                           | 200 [variant]                              | 400                               |
| POST   | /api/rag                            | none                 | { query }                                                   | 200 { ... }                                | 400                               |
| POST   | /api/flow/start                     | cookie               | { threadId, poem }                                          | 200 { ok, phase, nextQuestion }            | 400, 404                          |
| POST   | /api/flow/answer                    | cookie               | { threadId, questionId, answer }                            | 200 { ok, phase, ... }                     | 400, 404                          |
| GET    | /api/flow/peek?threadId=            | cookie               | threadId                                                    | 200 { ok, phase, nextQuestion?, snapshot } | 400, 404, 500                     |
| POST   | /api/flow/confirm                   | cookie               | { threadId }                                                | 200 { ok, phase }                          | 400, 404, 409                     |
| POST   | /api/flow/intent                    | none                 | { message, phase }                                          | 200 { intent }                             | 400                               |
| POST   | /api/enhancer                       | cookie + flag        | { threadId }                                                | 200 { ok, plan }                           | 400, 403, 404, 500                |
| POST   | /api/translate                      | cookie + flag        | { threadId }                                                | 200 { ok, result }                         | 400, 403, 404, 409, 502           |
| POST   | /api/translator/preview             | cookie/Bearer + flag | { threadId }                                                | 200 { ok, preview, versionId }             | 400, 401, 403, 409, 429, 500, 502 |
| POST   | /api/translator/accept-lines        | cookie + flag        | { threadId, selections[] }                                  | 200 { ok }                                 | 400, 401, 404                     |
| GET    | /api/journey/list?projectId=&limit= | cookie/Bearer        | projectId, limit?                                           | 200 { ok, items[] }                        | 400, 401?, 500                    |
| GET    | /api/dev/thread-state               | none (dev only)      | threadId                                                    | 200 { before, after }                      | 400, 403                          |
| GET    | /api/debug/whoami                   | none (dev)           | —                                                           | 200 { cookie_names, has_bearer, uid }      | —                                 |

LLM Context: prefer the table above to quickly find method, path, auth, and typical success/error shapes.

### Conventions

- Use `lib/apiGuard.ts` for auth where RLS-protected operations are performed. It supports SSR cookies and Bearer fallback.
- Validate inputs with Zod (`lib/schemas.ts` or local schemas).
- Keep business logic in `server/*`; route handlers orchestrate and shape responses.

### Endpoint Details

## POST /api/chat

- Authentication: none
- Parameters: { text: string }
- Response: { ok: true, echo: string }
- Status Codes: 200, 400
- Example Request:

```json
{ "text": "hello" }
```

- Example Response:

```json
{ "ok": true, "echo": "hello" }
```

## POST /api/chat/[threadId]/messages

- Authentication: Bearer token or SSR cookie (requireUser)
- Parameters: { projectId: string (uuid), content: string, role?: "user"|"assistant"|"system", meta?: object }
- Response: { id: string (uuid), created_at: string }
- Status Codes: 201, 400, 401
- Example Request:

```json
{ "projectId": "00000000-0000-0000-0000-000000000000", "content": "My poem…" }
```

- Example Response:

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "created_at": "2025-01-01T00:00:00Z"
}
```

## POST /api/threads

- Authentication: Bearer/cookie
- Parameters: { projectId: uuid, title?: string }
- Response: { thread: { id, title, created_at } }
- Status Codes: 201, 400, 401

## DELETE /api/threads

- Authentication: Bearer/cookie
- Parameters: { id?: uuid, threadId?: uuid }
- Response: { ok: true }
- Status Codes: 200, 400, 401

## POST /api/projects

- Authentication: Bearer/cookie
- Parameters: { title?: string, src_lang?: string, tgt_langs?: string[] }
- Response: { project: { id, title, created_at } }
- Status Codes: 201, 400, 401

## DELETE /api/projects

- Authentication: Bearer/cookie
- Parameters: { id?: uuid, projectId?: uuid }
- Response: { ok: true }
- Status Codes: 200, 400, 401

## POST /api/versions

- Authentication: Bearer/cookie
- Parameters: { projectId: uuid, title: string, lines: string[], tags?: string[], meta?: object, summary?: string }
- Response: { version: { id, project_id, title, lines, tags, meta, created_at } }
- Status Codes: 201, 400, 401

## PATCH /api/versions/positions

- Authentication: Bearer/cookie
- Parameters: { projectId: uuid, positions: [{ id: uuid, pos: { x:number, y:number }}] }
- Response: { ok: true }
- Status Codes: 200, 400, 401

## GET /api/versions/nodes?threadId=

- Authentication: Bearer/cookie
- Parameters: threadId: uuid (query)
- Response: { ok: true, count: number, nodes: [{ id, display_label, status, parent_version_id, overview, complete, created_at }] }
- Status Codes: 200, 400, 403, 500

## POST /api/compares

- Authentication: Bearer/cookie
- Parameters: { projectId: uuid, leftId: uuid, rightId: uuid, lens?: "meaning"|"form"|"tone"|"culture", granularity?: "line"|"phrase"|"char", notes?: string }
- Response: { compare: { id, project_id, left_version_id, right_version_id, lens, granularity, created_at } }
- Status Codes: 201, 400, 401

## POST /api/constraints

- Authentication: none
- Parameters: { text: string, rules: string[] }
- Response: { ok: boolean, text: string, violations: string[] }
- Status Codes: 200, 400

## POST /api/variants

- Authentication: none
- Parameters: { input: string, recipe: string }
- Response: [ { id: string, title: string, lines: string[], tags: string[] } ]
- Status Codes: 200, 400

## POST /api/rag

- Authentication: none
- Parameters: { query: string }
- Response: implementation-defined context bundle
- Status Codes: 200, 400

## POST /api/flow/start

- Authentication: SSR cookie (RLS guards ownership)
- Parameters: { threadId: uuid, poem: string }
- Response: { ok: true, phase: "interviewing", nextQuestion: { id, prompt } }
- Status Codes: 200, 400, 404

## POST /api/flow/answer

- Authentication: SSR cookie
- Parameters: { threadId: uuid, questionId: enum, answer: string }
- Response: one of:
  - interviewing: { ok: true, phase: "interviewing", nextQuestion: { id, prompt }, snapshot }
  - plan gate: { ok: true, phase: "await_plan_confirm", planPreview: { poem_excerpt, collected_fields, readyForEnhancer } }
- Status Codes: 200, 400, 404

## GET /api/flow/peek?threadId=

- Authentication: SSR cookie
- Parameters: threadId (query)
- Response: { ok: true, phase, nextQuestion?: { id, prompt } | null, snapshot: { poem_excerpt, collected_fields } }
- Status Codes: 200, 400, 404, 500

## POST /api/flow/confirm

- Authentication: SSR cookie
- Parameters: { threadId: uuid }
- Response: { ok: true, phase: "translating" }
- Status Codes: 200, 400, 404, 409

## POST /api/flow/intent

- Authentication: none (feature-gated by client)
- Parameters: { message: string, phase: string }
- Response: { intent: string|null }
- Status Codes: 200, 400

## POST /api/enhancer

- Authentication: SSR cookie; Feature flag: NEXT_PUBLIC_FEATURE_ENHANCER=1
- Parameters: { threadId: uuid }
- Response: { ok: true, plan: ENHANCER_PAYLOAD, usage? }
- Status Codes: 200, 400 (validation/moderation), 403 (disabled), 404, 500

## POST /api/translate

- Authentication: SSR cookie; Feature flag: NEXT_PUBLIC_FEATURE_TRANSLATOR=1
- Parameters: { threadId: uuid }
- Response: { ok: true, result: { versionA: string, notes: string[], blocked: boolean }, usage? }
- Status Codes: 200, 400 (validation/moderation), 403 (disabled), 404 (thread), 409 (state), 502 (LLM parse)

## POST /api/translator/preview

- Authentication: SSR cookie or Bearer; Feature flag: NEXT_PUBLIC_FEATURE_TRANSLATOR=1
- Parameters: { threadId: uuid }
- Response: { ok: true, preview: { lines: string[], notes: string[], line_policy }, versionId, displayLabel, cached? }
- Rate Limit: 30 req/min per threadId
- Status Codes: 200, 400, 401, 403, 409, 429, 500, 502

## POST /api/translator/accept-lines

- Authentication: SSR cookie
- Parameters: { threadId: uuid, selections: [{ index: number, text: string }] }
- Response: { ok: true }
- Status Codes: 200, 400 (validation/moderation), 401, 404

## GET /api/journey/list

- Authentication: SSR cookie or Bearer
- Query: projectId: uuid, limit?: 1..50 (default 20)
- Response: { ok: true, items: [{ id, kind, summary, meta, created_at }] }
- Status Codes: 200, 400, 401?, 500

## GET /api/dev/thread-state

- Authentication: none (blocked in production)
- Query: threadId: uuid
- Response: { before: SessionState, after: SessionState, didHitCadence: boolean }
- Status Codes: 200, 400, 403

### Error Handling

- 400 validation errors (Zod `.flatten()`), moderation failures
- 401 unauthorized (missing/invalid auth)
- 403 forbidden or feature disabled
- 404 not found (or RLS-protected not visible)
- 409 invalid state transitions
- 429 rate limiting
- 500 internal server errors
- 502 malformed LLM output

### Middleware and Auth

- `src/middleware.ts` initializes Supabase session on each request.
- `lib/apiGuard.ts` provides `requireUser(req)` to resolve user from cookies or `Authorization: Bearer <token>`.

### LLM Context

- Feature flags control LLM endpoints: set `NEXT_PUBLIC_FEATURE_TRANSLATOR=1` and/or `NEXT_PUBLIC_FEATURE_ENHANCER=1`.
- Outputs use stable shapes suitable for downstream parsing; see sections above for exact fields.
