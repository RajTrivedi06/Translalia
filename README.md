Updated: 2025-09-16

## Translalia

**Mission**: A decolonial, AI‑assisted creative poetry translation workspace.

### Features

- **AI translation and enhancement**: OpenAI Responses API powers translator and enhancer flows.
- **Authentication**: Supabase SSR session handling.
- **State and data**: Zustand for client state; TanStack Query for server data caching and fetching.

### Tech stack

- **Next.js** (App Router) and React 19
- **TanStack Query** for async data
- **Zustand** for client state
- **Supabase** for auth
- **OpenAI** for LLM calls

### Repository structure

- `metamorphs-web/`: Next.js app
- `_docs/`: repository docs and style guide
- `README.md`: this file; see app README for run steps

### Related docs

- App README: `metamorphs-web/README.md`
- Docs index: `_docs/`

### Evidence

```17:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/package.json
    "next": "15.4.6",
    "openai": "^4.104.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
```

```3:5:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
```

```24:25:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/providers.tsx
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

```3:4:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/store/workspace.ts
import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";
```

```29:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/auth/route.ts
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

```3:5:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

```19:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/layout.tsx
  description:
    "A decolonial, AI-assisted creative poetry translation workspace.",
```
