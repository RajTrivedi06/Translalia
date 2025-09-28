Updated: 2025-09-16

### Routes

| Method | Path                          | Purpose                                                         | Auth/Flags                                   | Key Errors                   | Anchor                                                                |
| ------ | ----------------------------- | --------------------------------------------------------------- | -------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| POST   | /api/translate                | Translate with cached moderation and parsing                    | Flag: TRANSLATOR=1; user via thread state    | 400, 404, 409, 422, 502      | `metamorphs-web/src/app/api/translate/route.ts:L15–L19`               |
| POST   | /api/translator/preview       | Preview translation, anti‑echo, cache, persist placeholder node | Auth required; Flag: TRANSLATOR=1; RL 30/min | 400, 409, 422, 429, 500, 502 | `metamorphs-web/src/app/api/translator/preview/route.ts:L33–L39`      |
| POST   | /api/translator/instruct      | Translate with explicit instruction and version linkage         | Auth required; Flag: TRANSLATOR=1            | 400, 401, 404, 422, 500, 502 | `metamorphs-web/src/app/api/translator/instruct/route.ts:L24–L32`     |
| POST   | /api/enhancer                 | Build enhanced request plan                                     | Flag: ENHANCER=1                             | 400, 404, 409, 400/502       | `metamorphs-web/src/app/api/enhancer/route.ts:L13–L16`                |
| POST   | /api/constraints              | Enforce text rules                                              | None                                         | 400                          | `metamorphs-web/src/app/api/constraints/route.ts:L4–L6`               |
| POST   | /api/variants                 | Generate text variants                                          | None                                         | 400                          | `metamorphs-web/src/app/api/variants/route.ts:L4–L8`                  |
| POST   | /api/rag                      | Retrieve augmented context                                      | None                                         | 400                          | `metamorphs-web/src/app/api/rag/route.ts:L4–L6`                       |
| POST   | /api/chat                     | Echo stub (replace with chain)                                  | None                                         | 400                          | `metamorphs-web/src/app/api/chat/route.ts:L3–L7`                      |
| POST   | /api/projects                 | Create project; DELETE delete project                           | Auth required                                | 400                          | `metamorphs-web/src/app/api/projects/route.ts:L5–L11`                 |
| GET    | /api/threads/list             | List threads for project                                        | Auth required                                | 400, 403, 404, 500           | `metamorphs-web/src/app/api/threads/list/route.ts:L8–L15`             |
| POST   | /api/threads                  | Create thread; DELETE delete thread                             | Auth required                                | 400                          | `metamorphs-web/src/app/api/threads/route.ts:L5–L13`                  |
| POST   | /api/chat/[threadId]/messages | Add chat message to thread                                      | Auth required                                | 400                          | `metamorphs-web/src/app/api/chat/[threadId]/messages/route.ts:L6–L13` |
| POST   | /api/versions                 | Create version node                                             | Auth required                                | 400                          | `metamorphs-web/src/app/api/versions/route.ts:L16–L24`                |
| PATCH  | /api/versions/positions       | Update node positions                                           | Auth required                                | 400                          | `metamorphs-web/src/app/api/versions/positions/route.ts:L17–L23`      |
| GET    | /api/versions/nodes           | List nodes for thread                                           | Auth required                                | 400, 403, 500                | `metamorphs-web/src/app/api/versions/nodes/route.ts:L8–L15`           |
| GET    | /api/journey/list             | List journey items                                              | Auth required (Bearer or cookies)            | 400, 500                     | `metamorphs-web/src/app/api/journey/list/route.ts:L15–L23`            |
| GET    | /api/interview/next           | Next interview question snapshot                                | Auth required                                | 400, 403, 404                | `metamorphs-web/src/app/api/interview/next/route.ts:L10–L17`          |
| POST   | /api/flow/intent              | Classify intent (LLM)                                           | None (stubbed guard)                         | 400                          | `metamorphs-web/src/app/api/flow/intent/route.ts:L7–L12`              |
| POST   | /api/flow/confirm             | Confirm plan and advance phase                                  | Auth required                                | 400, 404, 409                | `metamorphs-web/src/app/api/flow/confirm/route.ts:L9–L16`             |
| POST   | /api/flow/peek                | Backtranslate candidate (daily caps)                            | Auth required; Flag: BACKTRANSLATE=1         | 400, 404, 429, 502           | `metamorphs-web/src/app/api/flow/peek/route.ts:L10–L15`               |
| POST   | /api/translator/verify        | Verify candidate (daily caps)                                   | Auth required; Flag: VERIFY=1                | 400, 404, 429, 502           | `metamorphs-web/src/app/api/translator/verify/route.ts:L7–L12`        |
| POST   | /api/translator/accept-lines  | Accept selected lines into draft                                | Auth required                                | 400, 401, 404, 409           | `metamorphs-web/src/app/api/translator/accept-lines/route.ts:L17–L24` |
| POST   | /api/eval/run                 | Admin eval runner (stub)                                        | Auth required                                | 202                          | `metamorphs-web/src/app/api/eval/run/route.ts:L5–L9`                  |
| POST   | /api/auth                     | Sync Supabase SSR cookies from client auth                      | None                                         | 401                          | `metamorphs-web/src/app/api/auth/route.ts:L20–L27`                    |
| GET    | /api/auth/whoami              | Debug current auth identity                                     | None                                         | 200                          | `metamorphs-web/src/app/api/auth/whoami/route.ts:L6–L9`               |
| GET    | /api/auth/debug-cookies       | Debug cookies and headers                                       | None                                         | 200                          | `metamorphs-web/src/app/api/auth/debug-cookies/route.ts:L6–L12`       |
| GET    | /api/dev/thread-state         | Dev-only thread state smoke                                     | Dev only                                     | 400, 403                     | `metamorphs-web/src/app/api/dev/thread-state/route.ts:L8–L13`         |

Purpose: Central index of implemented API routes, flags, and references.
Updated: 2025-09-13

# API Routes Index (2025-09-23)

| Route                              | Purpose                     | Flags                               |
| ---------------------------------- | --------------------------- | ----------------------------------- |
| `/api/translator/preview`          | Create/preview draft        | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    |
| `/api/translator/instruct`         | Accept & generate overview  | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    |
| `/api/translate`                   | Full translate              | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    |
| `/api/enhancer`                    | Plan (JSON)                 | `NEXT_PUBLIC_FEATURE_ENHANCER`      |
| `/api/translator/verify`           | Score NOTES rubric (JSON)   | `NEXT_PUBLIC_FEATURE_VERIFY`        |
| `/api/translator/backtranslate`    | Back-translation (JSON)     | `NEXT_PUBLIC_FEATURE_BACKTRANSLATE` |
| `/api/interview/next`              | [Deprecated] Clarifier LLM  | —                                   |
| `/api/flow/peek`                   | Thread ownership/phase peek | —                                   |
| `/api/flow/{start,answer,confirm}` | Flow state transitions      | —                                   |
| `/api/flow/intent`                 | Router intent (LLM-backed)  | `NEXT_PUBLIC_FEATURE_ROUTER`        |
| `/api/chat`                        | Echo stub                   | —                                   |
| `/api/chat/[threadId]/messages`    | Create message              | — (auth required)                   |
| `/api/projects`                    | Create/delete project       | — (auth required)                   |
| `/api/threads`                     | Create/delete thread        | — (auth required)                   |
| `/api/threads/list`                | List threads for project    | — (auth required)                   |
| `/api/versions`                    | Create version              | — (auth required)                   |
| `/api/versions/nodes`              | List nodes for thread       | — (auth required)                   |
| `/api/versions/positions`          | Upsert version positions    | — (auth required)                   |
| `/api/compares`                    | Create compare              | — (auth required)                   |
| `/api/constraints`                 | Enforce simple constraints  | —                                   |
| `/api/variants`                    | Generate variants (stub)    | —                                   |
| `/api/rag`                         | Retrieve context            | —                                   |
| `/api/auth`                        | Supabase cookie sync        | —                                   |
| `/api/auth/whoami`                 | Identity debug              | —                                   |
| `/api/auth/debug-cookies`          | Cookie debug                | —                                   |
| `/api/eval/run`                    | Admin eval stub             | —                                   |

### Reverse Index (Which docs mention me)

| Route                           | Mentioned in                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/api/translator/preview`       | `docs/flow-api.md`, `docs/llm-api.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md` |
| `/api/translator/instruct`      | `docs/flow-api.md`, `docs/llm-api.md`, `docs/flags-and-models.md`                                   |
| `/api/translate`                | `docs/flow-api.md`, `docs/llm-api.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md` |
| `/api/enhancer`                 | `docs/flow-api.md`, `docs/llm-api.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md` |
| `/api/translator/verify`        | `docs/flow-api.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md`                    |
| `/api/translator/backtranslate` | `docs/flow-api.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md`                    |
| `/api/flow/intent`              | `docs/flow-api.md`, `docs/flags-and-models.md`                                                      |
| `/api/versions`                 | `docs/flow-api.md`                                                                                  |
| `/api/versions/nodes`           | `docs/flow-api.md`                                                                                  |
| `/api/versions/positions`       | `docs/flow-api.md`                                                                                  |

Evidence (files present under `src/app/api/**/route.ts`):

```1:32:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts

```

```1:40:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts

```

```1:40:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/backtranslate/route.ts

```

```1:298:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts

```

```1:214:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts

```

```1:147:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts

```

```1:69:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts

```

```1:109:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/answer/route.ts

```

```1:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/intent/route.ts

```

```1:54:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/interview/next/route.ts

```
