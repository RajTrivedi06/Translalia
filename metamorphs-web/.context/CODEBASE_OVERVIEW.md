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
          dev/thread-state/route.ts
          enhancer/route.ts
          flow/{start,answer,peek,confirm}/route.ts
          flow/intent/route.ts
          projects/route.ts
          rag/route.ts
          threads/route.ts
          translate/route.ts
          translator/{preview,accept-lines}/route.ts
          variants/route.ts
          versions/{route.ts,positions/route.ts}
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

### 4) Entry points (main files)

- App shell: `src/app/layout.tsx`, `src/app/page.tsx`
- Workspace pages: `src/app/(app)/workspace/*`, `src/app/(app)/workspaces/*`
- API entry points: `src/app/api/**/route.ts`

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
