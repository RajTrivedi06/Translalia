## Codebase Overview

### Purpose

High-level guide to the structure, tech stack, and major flows in this repository.

### Monorepo Layout

- `metamorphs-web`: Next.js application (App Router) and all web assets

### Tech Stack

- Framework: Next.js (App Router, Route Handlers)
- Language: TypeScript
- Styling: Tailwind CSS
- Auth/DB: Supabase (client + server helpers)
- State: Zustand + TanStack React Query
- AI: OpenAI client, in-memory cache + rate limit, moderation helper

### Key Directories (in `metamorphs-web/src`)

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
- Nodes listing: `app/api/versions/nodes` + `hooks/useNodes.ts` used by `VersionCanvas`

### Local Development

1. Install dependencies at the repo root and within `metamorphs-web` if needed
2. Copy any required env vars (Supabase, OpenAI, etc.) into `.env.local`
3. Start dev server: `npm run dev` (or `pnpm dev`/`yarn dev`) inside `metamorphs-web`

### Build & Lint

- Build: `next build`
- Lint: ESLint config in `eslint.config.mjs`
- Typecheck: `npm run typecheck`

### Conventions

- Co-locate feature modules (components, hooks, server code) by domain where practical
- Keep server-only logic in `server/` or `app/*/route.ts`
- Put reusable helpers in `lib/` and shared types in `types/`
- Validate API inputs with Zod schemas (`lib/schemas.ts` or route-local)

### Glossary

- Thread: A chat conversation or unit of dialog
- Flow: Guided intent discovery and response generation pipeline
- Variant/Version: Alternative outputs and versions for comparisons
- Node: A version card or compare card in the graph visualization

---

## CODEBASE_OVERVIEW

### 1) Project structure tree

```
metamorphs/
  metamorphs-web/
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
          translate/route.ts
          translator/{preview,accept-lines}/route.ts
          variants/route.ts
          versions/{route.ts,nodes/route.ts,positions/route.ts}
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

- Next.js: 15.4.6
- React: 19.1.0; React DOM: 19.1.0
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

### 4) Entry points (main files)

- App shell: `src/app/layout.tsx`, `src/app/page.tsx`
- Workspace pages: `src/app/(app)/workspace/*`, `src/app/(app)/workspaces/*`
- API entry points: `src/app/api/**/route.ts`
- Auth/session bootstrap: `src/middleware.ts`, `src/lib/supabaseServer.ts`
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
- ENHANCER_MODEL: optional, default `gpt-4o-mini`
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
- To see translation prompts/parsing: `src/lib/ai/prompts.ts`, `src/server/translator/parse.ts`, `src/app/api/translator/*`.
- For nodes/canvas rendering: `src/hooks/useNodes.ts`, `src/components/workspace/versions/VersionCanvas.tsx`.
- For chat message persistence: `src/app/api/chat/[threadId]/messages/route.ts`.

### 9) Naming and organization

- APIs are pluralized by resource (`/api/threads`, `/api/versions`, `/api/compares`).
- Feature flags prefixed with `NEXT_PUBLIC_FEATURE_*` gate optional flows.
- Files in `server/` are importable from routes and never from the browser.
