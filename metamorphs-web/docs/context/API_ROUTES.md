## API Routes

### Overview

This app uses Next.js Route Handlers (`route.ts`) under `src/app/api` for server-side endpoints.

### Index of Routes

- `api/chat`
  - `GET/POST /api/chat` — thread creation or chat orchestration
  - `POST /api/chat/[threadId]/messages` — append and process messages
- `api/flow`
  - `POST /api/flow/start` — initiate a guided flow
  - `POST /api/flow/intent` — detect/confirm user intent
  - `POST /api/flow/peek` — preview next steps or plan
  - `POST /api/flow/confirm` — confirm plan before execution
  - `POST /api/flow/answer` — produce final answer/output
- `api/translator`
  - `POST /api/translator/preview` — parse, diff, and preview translation units
  - `POST /api/translator/accept-lines` — accept line-by-line changes
- `api/translate` — translation helper endpoint (legacy/simple)
- `api/rag` — retrieval helper endpoint
- `api/threads` — thread management
- `api/variants` — variant generation/management
- `api/versions` and `api/versions/positions` — versioning support
- `api/compares` — compare workflows
- `api/constraints` — constraint extraction/validation
- `api/projects` — project/workspace management
- `api/dev/thread-state` — development-only inspection of thread state

### Conventions

- Use `lib/apiGuard.ts` for auth/ratelimit/permission checks where applicable
- Validate inputs with `lib/schemas.ts` and shared `types/*`
- Keep business logic in `server/*` modules; route handlers only orchestrate

### Example Handler Skeleton

```ts
// app/api/example/route.ts
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  // 1) parse and validate input
  // 2) authorize and guard
  // 3) call server module(s)
  // 4) return JSON Response
  return Response.json({ ok: true });
}
```

### Error Handling

- Return typed error shapes; avoid leaking internal details
- Prefer non-200 for hard failures; include actionable messages for clients

---

## API_ROUTES

### 1) All API endpoints

- POST `/api/chat` — echo stub

  - Body: `{ text: string }`
  - Response: `{ ok: true, echo: string }`

- POST `/api/chat/[threadId]/messages` — create message (auth required)

  - Auth: Bearer token from Supabase session
  - Body: `{ projectId: uuid; content: string; role?: 'user'|'assistant'|'system'; meta?: Record<string,unknown> }`
  - Response: `{ id: uuid, created_at: string }`
  - Errors: 400 invalid, 401 unauthorized

- POST `/api/threads` — create thread (auth)

  - Body: `{ projectId: uuid; title?: string }`
  - Response: `{ thread: { id, title, created_at } }`
  - DELETE `/api/threads` — `{ id?: uuid, threadId?: uuid }` → `{ ok: true }`

- POST `/api/projects` — create project (auth)

  - Body: `{ title?: string; src_lang?: string; tgt_langs?: string[] }`
  - Response: `{ project: { id, title, created_at } }`
  - DELETE `/api/projects` — `{ id?: uuid, projectId?: uuid }` → `{ ok: true }`

- POST `/api/versions` — create version (auth)

  - Body: `{ projectId: uuid; title: string; lines: string[]; tags?: string[]; meta?: object; summary?: string }`
  - Response: `{ version: { id, project_id, title, lines, tags, meta, created_at } }`

- PATCH `/api/versions/positions` — upsert version positions (auth)

  - Body: `{ projectId: uuid; positions: Array<{ id: uuid; pos: { x:number; y:number } }> }`
  - Response: `{ ok: true }`

- POST `/api/compares` — create compare (auth)

  - Body: `{ projectId: uuid; leftId: uuid; rightId: uuid; lens?: 'meaning'|'form'|'tone'|'culture'; granularity?: 'line'|'phrase'|'char'; notes?: string }`
  - Response: `{ compare: { id, project_id, left_version_id, right_version_id, lens, granularity, created_at } }`

- POST `/api/constraints` — enforce simple constraints (public)

  - Body: `{ text: string; rules: string[] }`
  - Response: `{ ok: boolean; text: string; violations: string[] }`

- POST `/api/variants` — generate variants (public)

  - Body: `{ input: string; recipe: string }`
  - Response: `Array<{ id: string; title: string; lines: string[]; tags: string[] }>`

- POST `/api/rag` — retrieve context (public)

  - Body: `{ query: string }`
  - Response: `{ passages: []; sources: Array<{ title: string; url: string }> }`

- Flow

  - POST `/api/flow/start` — `{ threadId: uuid; poem: string }` → `{ ok, phase, nextQuestion }`
  - POST `/api/flow/answer` — `{ threadId: uuid; questionId: enum; answer: string }` → `{ ok, phase, nextQuestion? | planPreview? }`
  - POST `/api/flow/peek` — `?threadId=uuid` (GET in hook) → `{ ok, phase, nextQuestion?, snapshot? }`
  - POST `/api/flow/confirm` — `{ threadId: uuid }` → `{ ok, phase }`
  - POST `/api/flow/intent` — `{ message: string; phase: string }` → `{ intent: string }` (when feature enabled)

- Translator (feature-flagged)
  - POST `/api/translator/preview` — `{ threadId: uuid }` → `{ ok, preview, cached?, debug }`
    - Rate limiting: 30 req/min per threadId
  - POST `/api/translator/accept-lines` — `{ threadId: uuid; selections: Array<{ index:number; text:string }>} → { ok }`

### 2) Request/response formats

- Validated with Zod in `src/lib/schemas.ts` and route-local schemas
- JSON responses via `NextResponse.json`

### 3) Authentication requirements

- Routes using `requireUser` require Supabase Bearer token
- Public routes: `/api/chat` (stub), `/api/constraints`, `/api/variants`, `/api/rag`, and translator preview gate by feature flag + moderation

### 4) Rate limiting

- Implemented in `lib/ai/ratelimit.ts`; currently applied to `/api/translator/preview` (30/min per thread)

### 5) Error handling patterns

- 400 for validation errors with Zod `.flatten()`
- 401 for unauthenticated
- 404 for missing resources
- 409 for invalid state transitions
- 429 for rate limiting
- 502 for malformed LLM output

### 6) Middleware used

- `requireUser` composes `@supabase/ssr` with Authorization header passthrough
- No Next.js `middleware.ts` present; security headers configured in `next.config.ts`

### 7) External API integrations

- OpenAI chat completions for translator; moderations for content checks
- Supabase for auth, DB, and storage
