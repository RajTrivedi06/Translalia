## Relationships Map

### 1) Component → Component Imports

- `src/components/workspace/WorkspaceShell.tsx`
  - imports: `./chat/ChatPanel`, `./versions/VersionCanvas`, `./journey/JourneyPanel`, `./compare/CompareSheet`, `@/store/workspace`, `@/lib/supabaseClient`
- `src/components/workspace/chat/ChatPanel.tsx`
  - imports: `./ThreadsDrawer`, `../flow/PlanPreviewSheet`, `../translate/TranslatorPreview`, `@/store/workspace`, `@/hooks/useThreadMessages`, `@/hooks/useInterviewFlow`, `@/lib/supabaseClient`, `@/server/flow/intent`, `@/server/flow/softReplies`
- `src/components/workspace/chat/ThreadsDrawer.tsx`
  - imports: `@/lib/supabaseClient`, `@/store/workspace`, `@tanstack/react-query`
- `src/components/workspace/flow/PlanPreviewSheet.tsx`
  - used by: `ChatPanel`
- `src/components/workspace/translate/TranslatorPreview.tsx`
  - used by: `ChatPanel`
- `src/components/auth/AuthButton.tsx`
  - imports: `./AuthSheet`, `@/hooks/useSupabaseUser`, `@/hooks/useProfile`, `@/lib/supabaseClient`, `next/link`
- `src/components/auth/AuthNav.tsx`
  - imports: `next/link`, `next/navigation`, `@/lib/supabaseClient`, `@/hooks/useSupabaseUser`, `@/hooks/useProfile`
- `src/components/account/ProfileForm.tsx`
  - imports: `@/hooks/useSupabaseUser`, `@/hooks/useProfile`, `@/lib/supabaseClient`

### 2) Files → Services Dependencies

- Supabase (client):
  - `src/components/workspace/WorkspaceShell.tsx`, `src/components/workspace/chat/ThreadsDrawer.tsx`, `src/hooks/useThreadMessages.ts`, `src/hooks/useProfile.ts`, `src/components/auth/*`, `src/components/account/ProfileForm.tsx`, `src/app/(app)/workspaces/**/*.tsx`, `src/lib/authHelpers.ts`
- Supabase (server SSR):
  - `src/lib/supabaseServer.ts`, API routes that call it indirectly via `@/lib/apiGuard` or directly
- OpenAI SDK:
  - `src/lib/ai/openai.ts` (factory), used by `src/app/api/translator/preview/route.ts`
- Moderation:
  - `src/lib/ai/moderation.ts`, used by translator routes and accept-lines
- Rate limit & cache:
  - `src/lib/ai/ratelimit.ts`, `src/lib/ai/cache.ts`, used by translator preview
- Zod validation:
  - `src/lib/schemas.ts`, and inline in `src/app/api/flow/*`, `src/app/api/translator/*`, etc.
- React Query:
  - providers in `src/components/providers.tsx`, hooks in `src/hooks/*`, components (`ThreadsDrawer`, `ChatPanel`)
- Zustand:
  - `src/store/workspace.ts` consumed by many workspace components

### 3) UI → API Routes

- `ChatPanel.tsx`
  - `/api/chat/[threadId]/messages` (POST)
  - `/api/variants` (POST), then `/api/versions` (POST)
  - `/api/flow/start` (POST), `/api/flow/answer` (POST), `/api/flow/confirm` (POST)
  - `/api/flow/intent` (POST) [feature flagged]
  - `/api/translator/preview` (POST), `/api/translator/accept-lines` (POST) [flagged]
- `ThreadsDrawer.tsx`
  - `/api/threads` (POST)
- `WorkspaceShell.tsx`
  - reads via Supabase client (no route calls) for `versions`, `journey_items`, `compares`
- `useInterviewFlow.ts`
  - `/api/flow/peek?threadId=...` (GET)
- `Projects/threads` pages
  - `/api/projects` (POST/DELETE), `/api/threads` (DELETE)

### 4) Database Tables → Accessing Functions/Files

- `profiles`
  - `src/hooks/useProfile.ts` (read/upsert), `src/components/auth/AuthSheet.tsx` (exists check, upsert), `src/lib/authHelpers.ts` (lookup by username)
- `projects`
  - `src/app/api/projects/route.ts` (insert/delete), `src/app/(app)/workspaces/page.tsx` (list)
- `chat_threads`
  - `src/app/api/threads/route.ts` (insert/delete), `src/app/api/flow/*/route.ts` (select for project), `src/server/threadState.ts` (select/update `state`), `src/components/workspace/chat/ThreadsDrawer.tsx` (list)
- `chat_messages`
  - `src/app/api/chat/[threadId]/messages/route.ts` (insert), `src/hooks/useThreadMessages.ts` (select)
- `versions`
  - `src/app/api/versions/route.ts` (insert), `src/app/api/versions/positions/route.ts` (upsert pos), `src/components/workspace/WorkspaceShell.tsx` (select)
- `compares`
  - `src/app/api/compares/route.ts` (insert), `src/components/workspace/WorkspaceShell.tsx` (select)
- `journey_items`
  - `src/server/flow/journeyLog.ts` (insert), `src/app/api/versions/route.ts` (insert), `src/app/api/compares/route.ts` (insert), `src/components/workspace/WorkspaceShell.tsx` (select)
- Storage `avatars`
  - `src/components/account/ProfileForm.tsx` (upload/getPublicUrl)
- RPC `accept_line`
  - `src/app/api/translator/accept-lines/route.ts`

### 5) Data Flow Diagram (Mermaid)

```mermaid
graph TD
  A[User] --> B[WorkspaceShell]
  B --> C[ChatPanel]
  B --> D[VersionCanvas]
  B --> E[JourneyPanel]
  C --> F[/api/flow/start]
  C --> G[/api/flow/answer]
  C --> H[/api/flow/confirm]
  C --> I[/api/chat/:threadId/messages]
  C --> J[/api/translator/preview]
  C --> K[/api/translator/accept-lines]
  C --> L[/api/variants]
  C --> M[/api/versions]
  B --> N{Supabase Client}
  N --> V[(versions)]
  N --> JI[(journey_items)]
  N --> CP[(compares)]
  I --> CM[(chat_messages)]
  F --> CT[(chat_threads)]
  G --> CT
  H --> CT
  J --> O{OpenAI}
  J --> P{Moderation}
  J --> Q[(Cache)]
  K --> R[[RPC accept_line]]
  R --> CT
  subgraph DB[Supabase DB]
    CT
    CM
    V
    JI
    CP
  end
```

Notes:

- Most protected routes use `src/lib/apiGuard.ts` to require a Supabase session.
- Feature-flagged areas: translator preview/accept-lines, router, enhancer.
