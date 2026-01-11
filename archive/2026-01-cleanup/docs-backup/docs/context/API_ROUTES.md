Updated: 2025-11-04

### API Routing Map (current)

This maps all implemented Route Handlers under `translalia-web/src/app/api/**/route.ts`.

#### Legend

- Auth: Yes = requires signed-in Supabase user; No = public; Dev = development-only
- Vis: Public = user-triggered; Internal = app/service-only; Dev = development-only

### Auth

| Method | Path                      | Purpose                     | Handler                                   | Auth | Vis      |
| ------ | ------------------------- | --------------------------- | ----------------------------------------- | ---- | -------- |
| POST   | `/api/auth`               | Sync Supabase SSR cookies   | `src/app/api/auth/route.ts`               | No   | Internal |
| GET    | `/api/auth/whoami`        | Debug current auth identity | `src/app/api/auth/whoami/route.ts`        | No   | Dev      |
| GET    | `/api/auth/debug-cookies` | Debug cookies/headers       | `src/app/api/auth/debug-cookies/route.ts` | No   | Dev      |

### Health/Debug

| Method | Path                | Purpose             | Handler                             | Auth | Vis    |
| ------ | ------------------- | ------------------- | ----------------------------------- | ---- | ------ |
| GET    | `/api/health`       | Liveness check      | `src/app/api/health/route.ts`       | No   | Public |
| GET    | `/api/debug/whoami` | Debug identity echo | `src/app/api/debug/whoami/route.ts` | No   | Dev    |

### Projects/Threads

| Method | Path                | Purpose                    | Handler                             | Auth | Vis    |
| ------ | ------------------- | -------------------------- | ----------------------------------- | ---- | ------ |
| POST   | `/api/projects`     | Create project             | `src/app/api/projects/route.ts`     | Yes  | Public |
| DELETE | `/api/projects`     | Delete project             | `src/app/api/projects/route.ts`     | Yes  | Public |
| POST   | `/api/threads`      | Create thread              | `src/app/api/threads/route.ts`      | Yes  | Public |
| GET    | `/api/threads/list` | List threads for a project | `src/app/api/threads/list/route.ts` | Yes  | Public |

### Chat

| Method | Path                            | Purpose                      | Handler                                         | Auth | Vis      |
| ------ | ------------------------------- | ---------------------------- | ----------------------------------------------- | ---- | -------- |
| POST   | `/api/chat`                     | Echo stub                    | `src/app/api/chat/route.ts`                     | No   | Internal |
| POST   | `/api/chat/[threadId]/messages` | Add chat message to a thread | `src/app/api/chat/[threadId]/messages/route.ts` | Yes  | Public   |

### Guide & Journey

| Method | Path                               | Purpose                           | Handler                                            | Auth | Vis    |
| ------ | ---------------------------------- | --------------------------------- | -------------------------------------------------- | ---- | ------ |
| POST   | `/api/guide/analyze-poem`          | Analyze poem (JSON)               | `src/app/api/guide/analyze-poem/route.ts`          | Yes  | Public |
| GET    | `/api/journey/list`                | List journey items                | `src/app/api/journey/list/route.ts`                | Yes  | Public |
| POST   | `/api/journey/generate-reflection` | Generate journey reflection (LLM) | `src/app/api/journey/generate-reflection/route.ts` | Yes  | Public |

### Notebook & Workshop

| Method | Path                             | Purpose                               | Handler                                          | Auth | Vis    |
| ------ | -------------------------------- | ------------------------------------- | ------------------------------------------------ | ---- | ------ |
| GET    | `/api/notebook/cells`            | Get all notebook cells for a thread   | `src/app/api/notebook/cells/route.ts`            | Yes  | Public |
| PATCH  | `/api/notebook/cells/[cellId]`   | Update a single notebook cell         | `src/app/api/notebook/cells/[cellId]/route.ts`   | Yes  | Public |
| GET    | `/api/notebook/export`           | Export notebook (format param)        | `src/app/api/notebook/export/route.ts`           | Yes  | Public |
| POST   | `/api/notebook/locks`            | Manage cell/line locks                | `src/app/api/notebook/locks/route.ts`            | Yes  | Public |
| POST   | `/api/notebook/ai-assist`        | AI assist suggestion (JSON)           | `src/app/api/notebook/ai-assist/route.ts`        | Yes  | Public |
| POST   | `/api/notebook/prismatic`        | Generate A/B/C variants for a line    | `src/app/api/notebook/prismatic/route.ts`        | Yes  | Public |
| POST   | `/api/workshop/generate-options` | Generate per-word translation options | `src/app/api/workshop/generate-options/route.ts` | Yes  | Public |
| POST   | `/api/workshop/save-line`        | Save compiled selections as line      | `src/app/api/workshop/save-line/route.ts`        | Yes  | Public |

### Uploads

| Method | Path                  | Purpose                   | Handler                               | Auth | Vis      |
| ------ | --------------------- | ------------------------- | ------------------------------------- | ---- | -------- |
| POST   | `/api/uploads/sign`   | Sign upload URL           | `src/app/api/uploads/sign/route.ts`   | Yes  | Public   |
| POST   | `/api/uploads/log`    | Log upload metadata       | `src/app/api/uploads/log/route.ts`    | Yes  | Internal |
| GET    | `/api/uploads/list`   | List uploads for a thread | `src/app/api/uploads/list/route.ts`   | Yes  | Public   |
| POST   | `/api/uploads/delete` | Delete an uploaded file   | `src/app/api/uploads/delete/route.ts` | Yes  | Public   |

### Misc (constraints, compares, rag, eval)

| Method | Path               | Purpose                     | Handler                            | Auth | Vis      |
| ------ | ------------------ | --------------------------- | ---------------------------------- | ---- | -------- |
| POST   | `/api/constraints` | Validate constraints        | `src/app/api/constraints/route.ts` | No   | Public   |
| POST   | `/api/compares`    | Create compare              | `src/app/api/compares/route.ts`    | Yes  | Public   |
| POST   | `/api/rag`         | Retrieval-augmented context | `src/app/api/rag/route.ts`         | Yes  | Internal |
| POST   | `/api/eval/run`    | Admin eval runner (stub)    | `src/app/api/eval/run/route.ts`    | Yes  | Internal |

### Interview (feature off)

| Method | Path                  | Purpose                               | Handler                               | Auth | Vis      |
| ------ | --------------------- | ------------------------------------- | ------------------------------------- | ---- | -------- |
| POST   | `/api/interview/next` | Clarifying question (LLM; deprecated) | `src/app/api/interview/next/route.ts` | Yes  | Internal |

### Notes

- Auth: Most user-facing routes require SSR cookies (Supabase) and verify thread ownership.
- Flags: Some legacy docs mention translator/enhancer flags; current snapshot uses notebook/workshop routes without those flags.
- Dev routes should be disabled in production builds.

Purpose: Central index of implemented API routes with handlers and auth/visibility.
