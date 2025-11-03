Updated: 2025-09-16

## Translalia Web

A Next.js app for AI‑assisted creative poetry translation.

### Run locally

```bash
pnpm i
pnpm dev
```

Open `http://localhost:3000`.

### Environment variables (names only)

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FEATURE_PRISMATIC` ("1" to enable)
- `ECHO_THRESHOLD` (optional numeric override)

### Supabase auth locally

- Create a project at Supabase and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The app posts auth events to an API route to sync SSR cookies:

```20:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as {
    event?: SupabaseAuthEvent;
    session?: SupabaseSessionPayload;
  };
```

```29:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

### Feature flags

- Prismatic variants: `NEXT_PUBLIC_FEATURE_PRISMATIC` controls translator mode gating.

```1:3:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/flags/prismatic.ts
export function isPrismaticEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_PRISMATIC === "1";
}
```

### Stack evidence

- TanStack Query provider and client:

```3:9:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
```

- Zustand store:

```1:4:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/workspace.ts
"use client";

import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";
```

- OpenAI initialization:

```1:5:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

### Troubleshooting

- See `docs/context/CURRENT_ISSUES.md` for known issues and workarounds.

```17:22:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/layout.tsx
export const metadata: Metadata = {
  title: "Translalia",
  description:
    "A decolonial, AI-assisted creative poetry translation workspace.",
  icons: { icon: "/favicon.ico" },
};
```
