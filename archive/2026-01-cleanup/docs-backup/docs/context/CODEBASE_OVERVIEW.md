Updated: 2025-11-04

### DOCS_INTAKE_TABLE (repo index)

| Path                                                               | Title                         | Purpose (1 line)                   | Last Updated | Key Entities                               | Cross-Refs                                 |
| ------------------------------------------------------------------ | ----------------------------- | ---------------------------------- | ------------ | ------------------------------------------ | ------------------------------------------ |
| `src/lib/ui/toast.ts`                                              | toast                         | UI toast helper                    | 2025-09-28   | `toastError`, `toastSuccess`               | `docs/context/ERROR_HANDLING.md`           |
| `src/lib/net/isOnline.ts`                                          | isOnline                      | Offline guard utility              | 2025-09-28   | `assertOnline()`                           | `docs/context/ERROR_HANDLING.md`           |
| `src/lib/storagePath.ts`                                           | storagePath                   | Build and parse storage paths      | 2025-09-28   | `buildPath`, `toBucketRelative`            | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/routers.tsx`                                              | routers                       | App route helpers/components       | 2025-09-28   | default exports                            | TODO                                       |
| `src/lib/i18n/config.ts`                                           | i18n config                   | App i18n configuration             | 2025-09-28   | constants                                  | TODO                                       |
| `src/lib/i18n/targetLanguage.ts`                                   | targetLanguage                | Target language helpers            | 2025-09-28   | helpers                                    | TODO                                       |
| `src/lib/interview/schema.ts`                                      | interview schema              | Types/validation for interview     | 2025-09-28   | types                                      | `docs/context/RELATIONSHIPS.md`            |
| `src/lib/interview/nextQuestion.ts`                                | nextQuestion                  | Compute next interview question    | 2025-09-28   | `computeNextQuestion`                      | `docs/flow-api.md`                         |
| `src/lib/journey/group.ts`                                         | journey group                 | Grouping helpers for journey       | 2025-09-28   | helpers                                    | TODO                                       |
| `src/lib/labels.ts`                                                | labels                        | Display label helpers              | 2025-09-28   | helpers                                    | TODO                                       |
| `src/lib/password.ts`                                              | password                      | Password helper utilities          | 2025-09-28   | helpers                                    | TODO                                       |
| `src/lib/env.ts`                                                   | env                           | Env parsing helpers                | 2025-09-28   | constants                                  | TODO                                       |
| `src/lib/flags.ts`                                                 | flags                         | Global flags aggregator            | 2025-09-28   | helpers                                    | `docs/flags-and-models.md`                 |
| `src/lib/generation.ts`                                            | generation                    | Text generation helpers (stubs)    | 2025-09-28   | helpers                                    | TODO                                       |
| `src/lib/constraints.ts`                                           | constraints                   | Constraint validation helpers      | 2025-09-28   | helpers                                    | `docs/context/API_ROUTES.md`               |
| `src/lib/rag.ts`                                                   | rag                           | Retrieval helpers                  | 2025-09-28   | helpers                                    | `docs/context/API_ROUTES.md`               |
| `src/lib/ai/prismaticParser.ts`                                    | prismaticParser               | Parse prismatic outputs            | 2025-09-28   | helpers                                    | `docs/llm-api.md`                          |
| `src/hooks/useSupabaseUser.ts`                                     | useSupabaseUser               | Auth user hook                     | 2025-09-28   | `useSupabaseUser()`                        | `docs/context/UTILITIES_HELPERS.md`        |
| `src/hooks/useProfile.ts`                                          | useProfile                    | Profile load/save hook             | 2025-09-28   | `useProfile()`                             | `docs/context/UTILITIES_HELPERS.md`        |
| `src/hooks/useThreadId.ts`                                         | useThreadId                   | Thread id from URL                 | 2025-09-28   | `useThreadId()`                            | `docs/context/STATE_MANAGEMENT.md`         |
| `public/file.svg`                                                  | file.svg                      | Asset                              | 2025-09-28   | —                                          | `docs/context/CODEBASE_OVERVIEW.md`        |
| `public/globe.svg`                                                 | globe.svg                     | Asset                              | 2025-09-28   | —                                          | `docs/context/CODEBASE_OVERVIEW.md`        |
| `public/window.svg`                                                | window.svg                    | Asset                              | 2025-09-28   | —                                          | `docs/context/CODEBASE_OVERVIEW.md`        |
| `src/store/workspace.ts`                                           | workspace store               | Zustand store for workspace UI     | 2025-09-28   | `useWorkspace`                             | `docs/context/STATE_MANAGEMENT.md`         |
| `src/hooks/useNodes.ts`                                            | useNodes                      | React Query for nodes list         | 2025-09-28   | `queryKey:["nodes",pid,tid]`               | `docs/context/STATE_MANAGEMENT.md`         |
| `src/hooks/useJourney.ts`                                          | useJourney                    | React Query for journey list       | 2025-09-28   | `queryKey:["journey",pid]`                 | `docs/context/STATE_MANAGEMENT.md`         |
| `src/hooks/useThreadMessages.ts`                                   | useThreadMessages             | React Query for chat messages      | 2025-09-28   | `queryKey:["chat_messages",pid,tid]`       | `docs/context/STATE_MANAGEMENT.md`         |
| `src/hooks/useInterviewFlow.ts`                                    | useInterviewFlow              | Interview flow helpers + peek      | 2025-09-28   | `peek()`                                   | `docs/flow-api.md`                         |
| `src/hooks/uploadsQuery.ts`                                        | uploadsQuery                  | Uploads list/mutations hooks       | 2025-09-28   | `useUploadsList`, `useUploadMutation`      | `docs/context/STATE_MANAGEMENT.md`         |
| `src/hooks/useUploadToSupabase.ts`                                 | useUploadToSupabase           | Direct upload helper               | 2025-09-28   | `useUploadToSupabase()`                    | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/hooks/useVerifier.ts`                                         | useVerifier                   | Verify & backtranslate mutations   | 2025-09-28   | `useVerifyTranslation`, `useBackTranslate` | `docs/llm-api.md`                          |
| `src/lib/ai/cache.ts`                                              | ai cache                      | In-memory response cache           | 2025-09-28   | functions                                  | `docs/llm-api.md`                          |
| `src/lib/ai/enhance.ts`                                            | ai enhance                    | Enhancer LLM call                  | 2025-09-28   | `enhance()`                                | `docs/llm-api.md`                          |
| `src/lib/ai/moderation.ts`                                         | ai moderation                 | Moderation checks                  | 2025-09-28   | `moderate()`                               | `docs/llm-api.md`                          |
| `src/lib/ai/openai.ts`                                             | ai openai                     | OpenAI client factory              | 2025-09-28   | `getOpenAI()`                              | `docs/llm-api.md`                          |
| `src/lib/ai/promptHash.ts`                                         | promptHash                    | Deterministic prompt hashing       | 2025-09-28   | `hashPrompt()`                             | `docs/context/SECURITY_GUIDELINES.md`      |
| `src/lib/ai/prompts.ts`                                            | prompts                       | Centralized prompt constants       | 2025-09-28   | constants                                  | `docs/llm-api.md`                          |
| `src/lib/ai/prismaticParser.ts`                                    | prismaticParser               | Parse prismatic JSON               | 2025-09-28   | `parsePrismatic()`                         | `docs/llm-api.md`                          |
| `src/lib/ai/ratelimit.ts`                                          | ai ratelimit                  | LLM rate limit helpers             | 2025-09-28   | helpers                                    | `docs/spend-and-cache-policy.md`           |
| `src/lib/ai/routeIntent.ts`                                        | routeIntent                   | Intent routing helpers             | 2025-09-28   | `routeIntent()`                            | `docs/flow-api.md`                         |
| `src/lib/ai/schemas.ts`                                            | ai schemas                    | Zod schemas for LLM I/O            | 2025-09-28   | zod types                                  | `docs/llm-api.md`                          |
| `src/lib/ai/translate.ts`                                          | ai translate                  | Translator call helpers            | 2025-09-28   | `translatePreview()`                       | `docs/llm-api.md`                          |
| `src/lib/ai/verify.ts`                                             | ai verify                     | Verifier/Backtranslate calls       | 2025-09-28   | `verify()`, `backtranslate()`              | `docs/llm-api.md`                          |
| `src/lib/apiGuard.ts`                                              | apiGuard                      | API auth guard utility             | 2025-09-28   | `requireUserOr401()`                       | `docs/context/SECURITY_GUIDELINES.md`      |
| `src/lib/auth/requireUser.ts`                                      | requireUser                   | SSR route auth helper              | 2025-09-28   | `requireUser()`                            | `docs/context/SECURITY_GUIDELINES.md`      |
| `src/lib/authHelpers.ts`                                           | authHelpers                   | Auth helper utilities              | 2025-09-28   | helpers                                    | `docs/context/SECURITY_GUIDELINES.md`      |
| `src/lib/constraints.ts`                                           | constraints                   | Shared constraints/utilities       | 2025-09-28   | helpers                                    | `docs/context/UTILITIES_HELPERS.md`        |
| `src/lib/env.ts`                                                   | env                           | Env var parsing                    | 2025-09-28   | constants                                  | `docs/flags-and-models.md`                 |
| `src/lib/featureFlags.ts`                                          | featureFlags                  | Client-side feature flags          | 2025-09-28   | `isEnabled()`                              | `docs/flags-and-models.md`                 |
| `src/lib/flags.ts`                                                 | flags                         | Aggregate flags                    | 2025-09-28   | constants                                  | `docs/flags-and-models.md`                 |
| `src/lib/flags/interview.ts`                                       | flags interview               | Flag helpers: interview            | 2025-09-28   | helpers                                    | `docs/flags-and-models.md`                 |
| `src/lib/flags/prismatic.ts`                                       | flags prismatic               | Flag helpers: prismatic            | 2025-09-28   | helpers                                    | `docs/flags-and-models.md`                 |
| `src/lib/flags/verify.ts`                                          | flags verify                  | Flag helpers: verify/backtranslate | 2025-09-28   | helpers                                    | `docs/flags-and-models.md`                 |
| `src/lib/generation.ts`                                            | generation                    | Text generation helpers            | 2025-09-28   | helpers                                    | `docs/llm-api.md`                          |
| `src/lib/http/errors.ts`                                           | http errors                   | Error helpers/taxonomy             | 2025-09-28   | `HttpError`                                | `docs/context/ERROR_HANDLING.md`           |
| `src/lib/http/timing.ts`                                           | http timing                   | Request timing helpers             | 2025-09-28   | helpers                                    | `docs/context/PERFORMANCE_OPTIMIZATION.md` |
| `src/lib/i18n/config.ts`                                           | i18n config                   | i18n config                        | 2025-09-28   | constants                                  | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/lib/i18n/targetLanguage.ts`                                   | targetLanguage                | Target language helpers            | 2025-09-28   | helpers                                    | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/lib/interview/nextQuestion.ts`                                | nextQuestion                  | Interview next Q logic             | 2025-09-28   | `nextQuestion()`                           | `docs/flow-api.md`                         |
| `src/lib/interview/schema.ts`                                      | interview schema              | Interview zod schemas              | 2025-09-28   | zod                                        | `docs/flow-api.md`                         |
| `src/lib/journey/group.ts`                                         | journey group                 | Group journey entries              | 2025-09-28   | helpers                                    | `docs/context/UTILITIES_HELPERS.md`        |
| `src/lib/labels.ts`                                                | labels                        | Display label helpers              | 2025-09-28   | helpers                                    | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/lib/models.ts`                                                | models                        | LLM model constants                | 2025-09-28   | constants                                  | `docs/llm-api.md`                          |
| `src/lib/policy.ts`                                                | policy                        | Policy helpers                     | 2025-09-28   | helpers                                    | `docs/moderation-policy.md`                |
| `src/lib/rag.ts`                                                   | rag                           | Retrieval helpers                  | 2025-09-28   | helpers                                    | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/ratelimit/redis.ts`                                       | ratelimit redis               | Upstash Redis client               | 2025-09-28   | `getRedis()`                               | `docs/spend-and-cache-policy.md`           |
| `src/lib/schemas.ts`                                               | schemas                       | Shared zod schemas                 | 2025-09-28   | zod                                        | `docs/context/UTILITIES_HELPERS.md`        |
| `src/lib/storage.ts`                                               | storage                       | Supabase storage helpers           | 2025-09-28   | functions                                  | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/supabaseAdmin.ts`                                         | supabaseAdmin                 | Admin client                       | 2025-09-28   | client                                     | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/supabaseBrowser.ts`                                       | supabaseBrowser               | Browser client                     | 2025-09-28   | client                                     | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/supabaseClient.ts`                                        | supabaseClient                | Shared client init                 | 2025-09-28   | client                                     | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/supabaseServer.ts`                                        | supabaseServer                | SSR client helper                  | 2025-09-28   | client                                     | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/lib/text/langGate.ts`                                         | langGate                      | Language gate helper               | 2025-09-28   | functions                                  | `docs/context/PERFORMANCE_OPTIMIZATION.md` |
| `src/lib/text/similarity.ts`                                       | similarity                    | Text similarity                    | 2025-09-28   | functions                                  | `docs/context/PERFORMANCE_OPTIMIZATION.md` |
| `src/lib/utils.ts`                                                 | utils                         | Generic utilities                  | 2025-09-28   | helpers                                    | `docs/context/UTILITIES_HELPERS.md`        |
| `src/app/layout.tsx`                                               | AppLayout                     | Next.js root layout                | 2025-09-28   | `RootLayout`                               | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/page.tsx`                                                 | HomePage                      | Landing page                       | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/globals.css`                                              | globals.css                   | Global styles                      | 2025-09-28   | CSS                                        | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/favicon.ico`                                              | favicon                       | App icon                           | 2025-09-28   | —                                          | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/account/page.tsx`                                   | AccountPage                   | Account settings page              | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspace/layout.tsx`                               | WorkspaceLayout               | Workspace layout                   | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspace/page.tsx`                                 | WorkspaceIndex                | Workspace entry                    | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspace/[projectId]/page.tsx`                     | WorkspaceProjectPage          | Project workspace page             | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspaces/layout.tsx`                              | WorkspacesLayout              | Workspaces layout                  | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspaces/page.tsx`                                | WorkspacesPage                | Workspaces list                    | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspaces/[projectId]/page.tsx`                    | ProjectPage                   | Project details                    | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/(app)/workspaces/[projectId]/threads/[threadId]/page.tsx` | ThreadPage                    | Thread view                        | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/auth/sign-in/page.tsx`                                    | SignInPage                    | Sign-in page                       | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/auth/sign-up/page.tsx`                                    | SignUpPage                    | Sign-up page                       | 2025-09-28   | default export                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/app/api/auth/route.ts`                                        | /api/auth                     | Auth sync route                    | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/auth/whoami/route.ts`                                 | /api/auth/whoami              | Auth whoami                        | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/auth/debug-cookies/route.ts`                          | /api/auth/debug-cookies       | Cookie debug                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/chat/route.ts`                                        | /api/chat                     | Chat API                           | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/chat/[threadId]/messages/route.ts`                    | /api/chat/[threadId]/messages | Messages API                       | 2025-09-28   | GET,POST                                   | `docs/context/API_ROUTES.md`               |
| `src/app/api/compares/route.ts`                                    | /api/compares                 | Compare API                        | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/constraints/route.ts`                                 | /api/constraints              | Constraints API                    | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/debug/whoami/route.ts`                                | /api/debug/whoami             | Debug whoami                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/dev/thread-state/route.ts`                            | /api/dev/thread-state         | Dev thread state                   | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/enhancer/route.ts`                                    | /api/enhancer                 | Enhancer API                       | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/eval/run/route.ts`                                    | /api/eval/run                 | Eval runner                        | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/flow/start/route.ts`                                  | /api/flow/start               | Flow start                         | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/flow/answer/route.ts`                                 | /api/flow/answer              | Flow answer                        | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/flow/peek/route.ts`                                   | /api/flow/peek                | Flow peek                          | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/flow/confirm/route.ts`                                | /api/flow/confirm             | Flow confirm                       | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/flow/intent/route.ts`                                 | /api/flow/intent              | Flow intent route                  | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/health/route.ts`                                      | /api/health                   | Health check                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/interview/next/route.ts`                              | /api/interview/next           | Interview next                     | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/journey/list/route.ts`                                | /api/journey/list             | Journey list                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/projects/route.ts`                                    | /api/projects                 | Projects API                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/rag/route.ts`                                         | /api/rag                      | RAG API                            | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/threads/route.ts`                                     | /api/threads                  | Threads API                        | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/threads/list/route.ts`                                | /api/threads/list             | Threads list                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/translate/route.ts`                                   | /api/translate                | Translate API                      | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/translator/accept-lines/route.ts`                     | /api/translator/accept-lines  | Translator accept                  | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/translator/instruct/route.ts`                         | /api/translator/instruct      | Translator instruct                | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/translator/preview/route.ts`                          | /api/translator/preview       | Translator preview                 | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/translator/verify/route.ts`                           | /api/translator/verify        | Verify translation                 | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/translator/backtranslate/route.ts`                    | /api/translator/backtranslate | Back-translate                     | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/uploads/delete/route.ts`                              | /api/uploads/delete           | Delete upload                      | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/uploads/list/route.ts`                                | /api/uploads/list             | List uploads                       | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/uploads/log/route.ts`                                 | /api/uploads/log              | Log upload                         | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/uploads/sign/route.ts`                                | /api/uploads/sign             | Sign upload                        | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/variants/route.ts`                                    | /api/variants                 | Variants API                       | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/versions/route.ts`                                    | /api/versions                 | Versions API                       | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/app/api/versions/nodes/route.ts`                              | /api/versions/nodes           | Version nodes list                 | 2025-09-28   | GET                                        | `docs/context/API_ROUTES.md`               |
| `src/app/api/versions/positions/route.ts`                          | /api/versions/positions       | Version positions                  | 2025-09-28   | POST                                       | `docs/context/API_ROUTES.md`               |
| `src/components/providers.tsx`                                     | Providers                     | React Query + Supabase providers   | 2025-09-28   | `Providers`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/button.tsx`                                     | Button                        | UI button component                | 2025-09-28   | `Button`                                   | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/card.tsx`                                       | Card                          | UI card component                  | 2025-09-28   | `Card`                                     | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/separator.tsx`                                  | Separator                     | UI separator component             | 2025-09-28   | `Separator`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/badge.tsx`                                      | Badge                         | UI badge component                 | 2025-09-28   | `Badge`                                    | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/dialog.tsx`                                     | Dialog                        | Dialog primitive                   | 2025-09-28   | `Dialog`, `DialogContent`                  | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/ui/sheet.tsx`                                      | Sheet                         | Drawer/Sheet primitive             | 2025-09-28   | `Sheet`, `SheetContent`                    | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/layout/Pane.tsx`                                   | Pane                          | Resizable pane wrapper             | 2025-09-28   | `Pane`                                     | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/nav/MainNav.tsx`                                   | MainNav                       | Main navigation                    | 2025-09-28   | `MainNav`                                  | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/nav/Breadcrumbs.tsx`                               | Breadcrumbs                   | Breadcrumbs                        | 2025-09-28   | `Breadcrumbs`                              | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/auth/AuthNav.tsx`                                  | AuthNav                       | Auth navigation                    | 2025-09-28   | `AuthNav`                                  | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/auth/AuthSheet.tsx`                                | AuthSheet                     | Auth actions sheet                 | 2025-09-28   | `AuthSheet`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/account/ProfileForm.tsx`                           | ProfileForm                   | Profile edit form                  | 2025-09-28   | `ProfileForm`                              | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/components/chat/AttachmentButton.tsx`                         | AttachmentButton              | File attach button                 | 2025-09-28   | `AttachmentButton`                         | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/chat/ChatComposer.tsx`                             | ChatComposer                  | Chat input composer                | 2025-09-28   | `ChatComposer`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/chat/UploadListItem.tsx`                           | UploadListItem                | Upload item row                    | 2025-09-28   | `UploadListItem`                           | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/components/chat/UploadsTray.tsx`                              | UploadsTray                   | Uploads tray                       | 2025-09-28   | `UploadsTray`                              | `docs/context/SERVICES_INTEGRATIONS.md`    |
| `src/components/notebook/NotebookPanel.tsx`                        | NotebookPanel                 | Notebook panel                     | 2025-09-28   | `NotebookPanel`                            | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/poem/ExplodedLineView.tsx`                         | ExplodedLineView              | Exploded line viewer               | 2025-09-28   | `ExplodedLineView`                         | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/poem/LineFrame.tsx`                                | LineFrame                     | Line frame                         | 2025-09-28   | `LineFrame`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/poem/PoemViewer.tsx`                               | PoemViewer                    | Poem viewer                        | 2025-09-28   | `PoemViewer`                               | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/providers.tsx`                                     | Providers                     | App providers                      | 2025-09-28   | `Providers`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/versions/VersionCard.tsx`                          | VersionCard                   | Version card                       | 2025-09-28   | `VersionCard`                              | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/versions/VersionsGrid.tsx`                         | VersionsGrid                  | Versions grid                      | 2025-09-28   | `VersionsGrid`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/WorkspaceShell.tsx`                      | WorkspaceShell                | Legacy workspace shell             | 2025-09-28   | `WorkspaceShell`                           | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/chat/ChatPanel.tsx`                      | ChatPanel                     | Legacy chat panel                  | 2025-09-28   | `ChatPanel`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/chat/ThreadsDrawer.tsx`                  | ThreadsDrawer                 | Threads drawer                     | 2025-09-28   | `ThreadsDrawer`                            | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/compare/CompareSheet.tsx`                | CompareSheet                  | Compare sheet                      | 2025-09-28   | `CompareSheet`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/flow/PlanBuilderOverviewSheet.tsx`       | PlanBuilderOverviewSheet      | Plan builder overview              | 2025-09-28   | `PlanBuilderOverviewSheet`                 | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/journey/JourneyList.tsx`                 | JourneyList                   | Journey list                       | 2025-09-28   | `JourneyList`                              | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/journey/JourneyPanel.tsx`                | JourneyPanel                  | Journey panel                      | 2025-09-28   | `JourneyPanel`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/translate/FullPoemOverview.tsx`          | FullPoemOverview              | Full poem overview                 | 2025-09-28   | `FullPoemOverview`                         | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/translate/LineCitationDrawer.tsx`        | LineCitationDrawer            | Line citation drawer               | 2025-09-28   | `LineCitationDrawer`                       | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/translate/NodeCard.tsx`                  | NodeCard                      | Translate node card                | 2025-09-28   | `NodeCard`                                 | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/versions/VersionCanvas.tsx`              | VersionCanvas                 | Versions graph canvas              | 2025-09-28   | `VersionCanvas`                            | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/versions/nodes/CompareCardNode.tsx`      | CompareCardNode               | Compare node                       | 2025-09-28   | `CompareCardNode`                          | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/versions/nodes/VersionCardNode.tsx`      | VersionCardNode               | Version node                       | 2025-09-28   | `VersionCardNode`                          | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/ContextSidebar.tsx`                   | ContextSidebar                | V2 context sidebar                 | 2025-09-28   | `ContextSidebar`                           | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/MainWorkspace.tsx`                    | MainWorkspace                 | V2 main workspace                  | 2025-09-28   | `MainWorkspace`                            | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/WorkspaceV2Shell.tsx`                 | WorkspaceV2Shell              | V2 workspace shell                 | 2025-09-28   | `WorkspaceV2Shell`                         | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/_utils/data.ts`                       | data utils                    | V2 data helpers                    | 2025-09-28   | `getSourceLines`, `getAnalysisSnapshot`    | `docs/context/UTILITIES_HELPERS.md`        |
| `src/components/workspace/v2/_utils/grouping.ts`                   | grouping utils                | Token grouping reducer             | 2025-09-28   | functions                                  | `docs/context/TESTING_STRATEGIES.md`       |
| `src/components/workspace/v2/_utils/i18n.ts`                       | v2 i18n                       | V2 i18n helpers                    | 2025-09-28   | helpers                                    | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/_utils/persist.ts`                    | persist                       | V2 persist helpers                 | 2025-09-28   | helpers                                    | `docs/context/STATE_MANAGEMENT.md`         |
| `src/components/workspace/v2/_utils/selection.ts`                  | selection utils               | Line/token selection reducer       | 2025-09-28   | functions                                  | `docs/context/TESTING_STRATEGIES.md`       |
| `src/components/workspace/v2/_utils/tokenize.ts`                   | tokenize                      | Tokenization helpers (mock)        | 2025-09-28   | functions                                  | `docs/llm-api.md`                          |
| `src/components/workspace/v2/_utils/useExplodeTokens.ts`           | useExplodeTokens              | Explode tokens hook (mock)         | 2025-09-28   | `useExplodeTokens`                         | `docs/context/TESTING_STRATEGIES.md`       |
| `src/components/workspace/v2/_utils/useRovingFocus.ts`             | useRovingFocus                | Roving focus hook                  | 2025-09-28   | `useRovingFocus`                           | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/_utils/useWindowedList.ts`            | useWindowedList               | Windowed list hook                 | 2025-09-28   | `useWindowedList`                          | `docs/context/PERFORMANCE_OPTIMIZATION.md` |
| `src/components/workspace/v2/chat/ChatComposer.tsx`                | V2ChatComposer                | V2 chat composer                   | 2025-09-28   | `ChatComposer`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/chat/ChatTimeline.tsx`                | V2ChatTimeline                | V2 chat timeline                   | 2025-09-28   | `ChatTimeline`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/chat/ChatView.tsx`                    | V2ChatView                    | V2 chat view                       | 2025-09-28   | `ChatView`                                 | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/chat/WelcomeCard.tsx`                 | WelcomeCard                   | V2 welcome card                    | 2025-09-28   | `WelcomeCard`                              | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/components/TokenCard.tsx`             | TokenCard                     | V2 token card                      | 2025-09-28   | `TokenCard`                                | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/sidebar/AnalysisCard.tsx`             | AnalysisCard                  | V2 analysis card                   | 2025-09-28   | `AnalysisCard`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/sidebar/SettingsCard.tsx`             | SettingsCard                  | V2 settings card                   | 2025-09-28   | `SettingsCard`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/sidebar/SourceTextCard.tsx`           | SourceTextCard                | V2 source text card                | 2025-09-28   | `SourceTextCard`                           | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/views/LineSelectionView.tsx`          | LineSelectionView             | V2 line selection view             | 2025-09-28   | `LineSelectionView`                        | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/views/NotebookView.tsx`               | NotebookView                  | V2 notebook view                   | 2025-09-28   | `NotebookView`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/views/WorkshopView.tsx`               | WorkshopView                  | V2 workshop view                   | 2025-09-28   | `WorkshopView`                             | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/components/workspace/v2/README.md`                            | V2 README                     | Component README                   | 2025-09-28   | —                                          | `docs/context/COMPONENTS_STRUCTURE.md`     |
| `src/state/uiLang.ts`                                              | uiLang store                  | UI language store                  | 2025-09-28   | `useUiLangStore`                           | `docs/context/STATE_MANAGEMENT.md`         |
| `src/state/uploads.ts`                                             | uploads store                 | Uploads Zustand store              | 2025-09-28   | `useUploadsStore`                          | `docs/context/STATE_MANAGEMENT.md`         |

### Stack

- Next.js App Router, React 19, TypeScript
- TanStack Query for async data, Zustand for client state
- Supabase for auth (SSR helper), OpenAI for LLM

```21:24:/Users/raaj/Documents/CS/metamorphs/translalia-web/package.json
    "next": "15.4.6",
    "openai": "^4.104.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
```

```3:9:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
```

```1:4:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/store/workspace.ts
"use client";

import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";
```

### Key folders

- `src/app/api/`: HTTP API routes (App Router)
- `src/lib/ai/`: OpenAI calls, cache, ratelimit, prompts, schemas
- `src/server/`: server-only helpers (thread state, translator)
- `src/components/`: UI and providers

```4:10:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}
```

### High-level architecture (text)

```
[Browser UI (React 19)]
  ├─ Components (notebook, workshop, chat)
  ├─ Zustand stores (thread‑scoped via threadStorage)
  └─ TanStack Query (fetches)
        ↓ HTTP
[Next.js Route Handlers (App Router) under src/app/api/*]
  ├─ Auth + ownership guard (Supabase SSR cookies)
  ├─ Business logic (zod validation, caching, quotas)
  └─ LLM calls (OpenAI SDK; JSON outputs where applicable)
        ↓ SDK
[External Services]
  ├─ Supabase (auth + Postgres storage)
  └─ OpenAI (translate/assist/analysis)
```

Communication:

- Client fetches route handlers with fetch; auth via Supabase SSR cookies.
- Server routes call OpenAI; results cached in process memory for 1h.

### Main flows

- Enhancer (collect plan) → Interview (state) → Translator Preview (anti‑echo, cache) → Version persist

### Navigation (V2 IA)

- Entry: Workspaces list → Project chats → Thread route (shell swap by flag).
- V2 center flow: Chat (UI-only for now) → Line Selection → Workshop → Notebook.

```33:41:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
  const body = await req.json();
  const parsed = Body.safeParse(body);
```

```121:131:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
  const { displayLabel, projectId } = await allocateDisplayLabel(threadId);
  // Create placeholder node
  const placeholderMeta = {
    thread_id: threadId,
    display_label: displayLabel,
    status: "placeholder" as const,
    parent_version_id: null as string | null,
  };
```

### Nodes API contract (versions)

- Create version: `POST /api/versions` with `projectId`, `title`, `lines`, optional `tags`, `meta`, `summary`.

```16:27:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/route.ts
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const parsed = createVersionSchema.safeParse(await req.json());
```

```27:33:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/route.ts
  const { data: v, error: vErr } = await guard.sb
    .from("versions")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      lines: parsed.data.lines,
      tags: parsed.data.tags ?? [],
      meta: parsed.data.meta ?? {},
    })
```

### Auth/session entry points

```1:4:/Users/raaj/Documents/CS/Translalia/Translalia-web/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
```

```27:43:/Users/raaj/Documents/CS/Translalia/Translalia-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
const hasSupabaseCookies = Array.from(req.cookies.getAll()).some((c) => c.name.startsWith("sb-") || c.name.includes("supabase"));
if (needsAuth && !hasSupabaseCookies) { /* redirect to sign-in with redirect param */ }
```

### Entry points (frontend/backend)

- Frontend UI roots: `src/app/layout.tsx`, `src/app/page.tsx`; workspace shells in `src/components/workspace/*` and V2 in `src/components/workspace/v2/*`.
- Backend API: `src/app/api/**/route.ts` (e.g., `guide/analyze-poem`, `notebook/*`, `workshop/*`, `journey/*`, `threads/*`).

### Development vs production

- Headers & linting during build:

```3:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { domains: ["images.unsplash.com"] },
  eslint: { ignoreDuringBuilds: true },
}
```

- Rate limits/quotas: in‑memory helper available; Redis quota helper is stubbed (always allows) in this snapshot.
- Caching: in‑process Map with TTL (1h); consider external cache for multi‑instance prod.
- Env gating: `NODE_ENV !== "production"` enables extra logging in helper retries.

Purpose: High-level map of the repo, stack, and flows for contributors.
Updated: 2025-09-13

> **2025-09-11 Update:** Runtime defaults use **GPT-5** family; Translator supports feature-flagged **Prismatic** (A/B/C in one call); optional **Verifier** and **Back-translate** are user-initiated; interview clarifier UI has been removed — Interview Q1 is the single source of truth for target variety.

## Codebase Overview

### Purpose

High-level guide to the structure, tech stack, and major flows in this repository.

### System Purpose & Flow

- Thread-scoped workspace for poetry translation and version exploration.
- End-to-end user path: Interview → Plan Builder → Accept & Generate Version A → node persisted → immediate canvas render (React Query–driven) without page refresh.
- All data + APIs are scoped by `(projectId, threadId)`.

### Primary Data Sources

| Area         | Source of truth                             | Access                                 | Notes                                                                                     |
| ------------ | ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Canvas nodes | React Query `useNodes(projectId, threadId)` | `GET /api/versions/nodes?threadId=...` | Polling supported (≈1500ms). Invalidate `["nodes", projectId, threadId]` to refresh.      |
| UI ephemera  | Zustand store                               | `store/workspace.ts`                   | Drawer open state, highlighted version, compares, journey; not used for canvas node data. |

### Monorepo Layout

- `Translalia-web`: Next.js application (App Router) and all web assets

### Tech Stack

- Framework: Next.js (App Router, Route Handlers) — baseline: Next.js 14
- Language: TypeScript
- Styling: Tailwind CSS
- Auth/DB: Supabase (client + server helpers)
- State: Zustand + TanStack React Query
- AI: OpenAI client, in-memory cache + rate limit, moderation helper

### Key Directories (in `Translalia-web/src`)

- `app/`: App Router pages and `route.ts` API handlers
- `components/`: UI components organized by feature
- `hooks/`: React hooks for data and UI logic
- `lib/`: Helpers for AI, auth, policies, schemas, and utilities
- `server/`: Server-side modules (LLM prompts/execution, translators, flow)
- `store/`: Client-side state management store(s)
- `types/`: Shared types across app and server
  - `types/sessionState.ts`: schema for server-owned thread state

### Important Runtime Flows

- Chat/Threads: `app/api/chat` and `app/api/threads` endpoints; UI in `components/workspace/chat`
- Flow/Intent: `app/api/flow/*` route handlers and `server/flow/*` logic
- Translation: `app/api/translator/*` route handlers and `server/translator/*`
- RAG: `lib/rag.ts` helpers and related server usage
- Nodes listing: `app/api/versions/nodes` + `hooks/useNodes.ts` used by `VersionCanvas` (single source of truth for node rendering)

#### Nodes API contract (summary)

Endpoint: `/api/versions/nodes?threadId=...`

Response JSON:

```json
{
  "ok": true,
  "threadIdEcho": "...",
  "count": 1,
  "nodes": [
    {
      "id": "...",
      "display_label": "Version A",
      "status": "ready",
      "overview": "...",
      "complete": true,
      "created_at": "2025-09-09T00:00:00.000Z",
      "parent_version_id": null
    }
  ]
}
```

### Local Development

1. Install dependencies at the repo root and within `Translalia-web` if needed
2. Copy any required env vars (Supabase, OpenAI, etc.) into `.env.local`
3. Start dev server: `npm run dev` (or `pnpm dev`/`yarn dev`) inside `Translalia-web`

### Build & Lint

- Build: `next build`
- Lint: ESLint config in `eslint.config.mjs`
- Typecheck: `npm run typecheck`

### Conventions

- Co-locate feature modules (components, hooks, server code) by domain where practical
- Keep server-only logic in `server/` or `app/*/route.ts`
- Put reusable helpers in `lib/` and shared types in `types/`
- Validate API inputs with Zod schemas (`lib/schemas.ts` or route-local)

### UX Summary

- Plan Builder CTA label state machine:
  - Default: "Accept & Generate Version A"
  - Busy: "Generating…"
  - After a version exists (optimistic or confirmed via query): "Accept" (click closes drawer; does not re-generate)

### Glossary

- Thread: A chat conversation or unit of dialog
- Flow: Guided intent discovery and response generation pipeline
- Variant/Version: Alternative outputs and versions for comparisons
- Node: A version card or compare card in the graph visualization
- Plan Builder: Drawer that confirms plan and triggers Version A creation

### Glossary (Phase 2 terms)

- Explode: split source text into tokenized lines and options for Workshop.

```36:54:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/_utils/useExplodeTokens.ts
export function useExplodeTokens(sourceLines: string[]): ExplodeTokensResult {
  // explode lines into tokens with equal-weight options (mocked in Phase 2)
}
```

- TokenOption: selectable option for a token (id, label, dialect, from).

```1:20:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/components/TokenCard.tsx
export function TokenCard({ lineId, token, tokenIndex, totalTokens, onGroupWithNext, onUngroup }: { /* … */ })
```

- DialectTag: dialect label attached to `TokenOption` (e.g., Std, regional).

```145:150:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/components/TokenCard.tsx
title={`${opt.label} (${opt.dialect})`} aria-label={`${opt.label} (${opt.dialect})`}
```

- Workshop: center-pane UI to choose token options and compile lines.

```13:25:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/WorkshopView.tsx
export function WorkshopView() { /* token selection → notebook compile */ }
```

- LineSelection: view to pick which lines to work on.

```23:31:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/LineSelectionView.tsx
export function LineSelectionView({ flowPeek, nodes, onProceed }: LineSelectionViewProps)
```

- Journey: recent activity list for thread/project.

```5:13:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/hooks/useJourney.ts
export function useJourney(projectId?: string, limit = 20) { /* … */ }
```

- Version / Compare: version nodes and compare overlays.

```23:41:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
export function VersionCanvas() { /* renders version nodes graph */ }
```

- Notebook: compiled draft area.

```6:13:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/views/NotebookView.tsx
export function NotebookView() { /* shows compiled draft; copy/clear/back */ }
```

---

## CODEBASE_OVERVIEW

### 1) Project structure tree

```
Translalia/
  Translalia-web/
    docs/
      *.md
    public/
      *.svg
    src/
      app/
        (app)/
          account/
          workspace/
          workspaces/
        api/
          chat/[threadId]/messages/route.ts
          chat/route.ts
          compares/route.ts
          constraints/route.ts
          debug/whoami/route.ts
          dev/thread-state/route.ts
          enhancer/route.ts
          flow/{start,answer,peek,confirm}/route.ts
          flow/intent/route.ts
          journey/list/route.ts
          projects/route.ts
          rag/route.ts
          threads/route.ts
          threads/list/route.ts
          translate/route.ts
          translator/{preview,accept-lines,instruct}/route.ts
          variants/route.ts
          versions/{route.ts,nodes/route.ts,positions/route.ts}
          auth/route.ts
          auth/whoami/route.ts
          auth/debug-cookies/route.ts
      components/
        account/
        auth/
        workspace/
          chat/
          compare/
          flow/
          journey/
          translate/
          versions/
      hooks/
      lib/
        ai/
      server/
        flow/
        translator/
      store/
      types/
    next.config.ts
    tailwind.config.ts
    package.json
    tsconfig.json
```

### 2) Technology stack with versions

- Next.js: 14.x
- React: 18.x; React DOM: 18.x
- TypeScript: ^5
- Tailwind CSS: ^3.4.17; PostCSS: ^8.5.6; Autoprefixer: ^10.4.21
- Supabase JS: 2.55.0; @supabase/ssr: ^0.5.0
- TanStack React Query: ^5.85.3
- OpenAI SDK: ^4.104.0
- Zustand: ^5.0.7
- React Flow: ^11.11.4
- ESLint: ^9; eslint-config-next: 15.4.6

### 3) Key dependencies and their purposes

- next: framework/runtime, routing (App Router + Route Handlers)
- @supabase/supabase-js, @supabase/ssr: auth and database client (browser + server)
- @tanstack/react-query: client-side server-state fetching/caching
- openai: LLM access for translation/moderation
- zustand: lightweight global UI/workspace state
- zod: input validation for APIs and state schemas
- reactflow: versions graph UI
- lucide-react: icons
- react-resizable-panels: resizable panes in workspace layout

### 4) Entry points (main files)

- App shell: `src/app/layout.tsx`, `src/app/page.tsx`
- Workspace pages: `src/app/(app)/workspace/*`, `src/app/(app)/workspaces/*`
- API entry points: `src/app/api/**/route.ts`
- Auth/session bootstrap: `middleware.ts`, `src/lib/supabaseServer.ts`
- Auth cookie sync handler: `src/app/api/auth/route.ts` (triggered by `src/components/providers.tsx` on auth state changes)
- LLM clients/utilities: `src/lib/ai/*`

### 5) Build and deployment configuration

- Scripts: `dev`, `build`, `start` in `package.json`
- Next config: `next.config.ts` (security headers, image domains)
- Tailwind: `tailwind.config.ts` and `src/app/globals.css`
- TypeScript: `tsconfig.json`

### 6) Environment variables needed

- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase public anon key
- OPENAI_API_KEY: OpenAI key for moderation and translator
- TRANSLATOR_MODEL: optional, default `gpt-4o`
- ENHANCER_MODEL: optional, default `gpt-5-mini`
- EMBEDDINGS_MODEL: optional, default `text-embedding-3-large`
- NEXT_PUBLIC_FEATURE_TRANSLATOR: "1" to enable translator UI/endpoint
- NEXT_PUBLIC_FEATURE_ROUTER: "1" to allow server-side intent routing
- NEXT_PUBLIC_FEATURE_ENHANCER: "1" to enable enhancer pathway

### 7) Overall architecture pattern

- Component-based Next.js App Router
- Server-side Route Handlers for APIs; business logic in `src/server/*`
- Client state via Zustand (`store/workspace.ts`) and React Query for data
- Supabase for auth/DB; OpenAI for LLM; modular utilities under `src/lib/*`

### 8) Entry Points for LLMs (Quick Start)

- To understand flow state: see `src/server/threadState.ts` and `src/types/sessionState.ts`.
- To see interview logic: `src/server/flow/questions.ts` and `src/app/api/flow/*`.
- To see translation prompts/parsing: `src/lib/ai/prompts.ts`, `src/server/translator/parse.ts`, `src/app/api/translator/*` (including `/api/translator/instruct`).
- For nodes/canvas rendering: `src/hooks/useNodes.ts` (source of truth), `src/components/workspace/versions/VersionCanvas.tsx`.
- For chat message persistence: `src/app/api/chat/[threadId]/messages/route.ts`.

### QA & Regression Guards (high-level)

- Interview flow: peek default phase is "welcome"; snapshot present on all responses; confirm leads to `phase:"translating"`.
- Accept path: translator preview returns `{ versionId }`; nodes query shows the new node within polling window; canvas renders immediately.
- CTA states: default → generating → accept (post-create).
- Drawer: closes on success (after node detection).
- Flags: "Force translate" appears only when `NEXT_PUBLIC_SHOW_FORCE_TRANSLATE=true`.
- Thread hygiene: switching threads isolates nodes and CTA state.

### 9) Naming and organization

- APIs are pluralized by resource (`/api/threads`, `/api/versions`, `/api/compares`).
- Feature flags prefixed with `NEXT_PUBLIC_FEATURE_*` gate optional flows.
- Files in `server/` are importable from routes and never from the browser.

---

#### Changelog

- 2025-09-09: Documented React Query as canvas source of truth, nodes API contract, CTA label states, and end-to-end Accept flow; added QA guards. (CursorDoc-Editor)
