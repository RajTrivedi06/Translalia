Updated: 2025-09-16

### Stack

- Next.js App Router, React 19, TypeScript
- TanStack Query for async data, Zustand for client state
- Supabase for auth (SSR helper), OpenAI for LLM

```17:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/package.json
    "next": "15.4.6",
    "openai": "^4.104.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
```

```3:9:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
```

```1:4:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/store/workspace.ts
"use client";

import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";
```

### Key folders

- `src/app/api/`: HTTP API routes (App Router)
- `src/lib/ai/`: OpenAI calls, cache, ratelimit, prompts, schemas
- `src/server/`: server-only helpers (thread state, translator)
- `src/components/`: UI and providers

```4:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}
```

### Main flows

- Enhancer (collect plan) → Interview (state) → Translator Preview (anti‑echo, cache) → Version persist

```33:41:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
  const body = await req.json();
  const parsed = Body.safeParse(body);
```

```121:131:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
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

```16:27:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/route.ts
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const parsed = createVersionSchema.safeParse(await req.json());
```

```27:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/route.ts
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

- `metamorphs-web`: Next.js application (App Router) and all web assets

### Tech Stack

- Framework: Next.js (App Router, Route Handlers) — baseline: Next.js 14
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
- TRANSLATOR_MODEL: optional, default `gpt-5`
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
