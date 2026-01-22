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
- `MAIN_GEN_MAX_OUTPUT_TOKENS` (optional, default: 2000, min: 300, max: 4000) - Output token cap for Method 2 main generation
- `REGEN_MAX_OUTPUT_TOKENS` (optional, default: 1500, min: 200, max: 3000) - Output token cap for Method 2 regeneration
- `DEBUG_OAI_RAW_OUTPUT` (optional, "1" to enable) - Logs full raw output on parse failures (use with caution)
- `MAIN_GEN_PARALLEL_LINES` (optional, default: "1" enabled, "0" to disable) - Enable parallel line processing within stanzas
- `MAIN_GEN_LINE_CONCURRENCY` (optional, default: 3, min: 1, max: 6) - Max concurrent line translations per stanza
- `ENABLE_TICK_TIME_SLICING` (optional, default: "1" enabled, "0" to disable) - Enable interruptible time-slicing during chunk processing
- `TICK_TIME_BUDGET_MS` (optional, default: 2500) - Time budget per tick in milliseconds
- `ENABLE_PARALLEL_STANZAS` (optional, default: "1" enabled, "0" to disable) - Enable parallel stanza processing (kill switch)
- `MAX_STANZAS_PER_TICK` (optional, default: 1, min: 1, max: 5) - Maximum stanzas to process per tick
- `CHUNK_CONCURRENCY` (optional, default: 1, min: 1, max: 3) - Maximum concurrent stanzas per tick
- `ENABLE_GPT5_REGEN_PARALLEL` (optional, default: "1" enabled, "0" to disable) - Enable GPT-5 regen optimizations (kill switch)
- `GPT5_REGEN_K` (optional, default: 3, min: 1, max: 6) - Number of regen candidates for GPT-5 (reduced from 6 for speed)
- `GPT5_REGEN_CONCURRENCY` (optional, default: 6, min: 1, max: 8) - Max concurrent regen calls for GPT-5
- `DEFAULT_REGEN_K` (optional, default: 6, min: 1, max: 6) - Number of regen candidates for non-GPT-5 models
- `DEFAULT_REGEN_CONCURRENCY` (optional, default: 3, min: 1, max: 8) - Max concurrent regen calls for non-GPT-5 models
- `DEBUG_ANCHOR_VALIDATION` (optional, "1" to enable) - Logs stopword-only anchor validation failures with anchorId and context
- `ALLOW_STOPWORD_ONLY_ANCHORS` (optional, default: "0" disabled) - Enable allowlist for stopword-only anchor realizations (ISS-008)
- `STOPWORD_ALLOWED_ANCHORS` (optional, default: empty) - Comma-separated list of anchor IDs allowed to have stopword-only realizations (e.g., "ADDR,POSSESSION_REFERENCE")
- `ENABLE_STRICT_JSON_SCHEMA` (optional, default: "1" enabled, "0" to disable) - Enable strict JSON schema for main-gen responses (ISS-009)
- `STRICT_JSON_SCHEMA_MODELS` (optional, default: "gpt-5,gpt-5-mini,gpt-5-turbo") - Comma-separated list of model prefixes that support strict schema
- `STRICT_SCHEMA_FALLBACK_TO_JSON_OBJECT` (optional, default: "1" enabled, "0" to disable) - Fallback to json_object if strict schema is unsupported
- `DEBUG_SCHEMA` (optional, "1" to enable) - Logs strict schema attempts, successes, and fallbacks
- `ENABLE_COMPRESSED_RECIPES` (optional, default: "0" disabled) - Enable compressed recipe prompt format to reduce verbosity (ISS-010)
- `DEBUG_PROMPT_SIZES` (optional, "1" to enable) - Logs prompt sizes (system, user, recipe block) and estimated tokens
- `ENABLE_LOCAL_ANCHOR_REALIZATIONS` (optional, default: "0" disabled) - Compute anchor_realizations locally instead of asking model (ISS-011)
- `OMIT_ANCHOR_REALIZATIONS_FROM_PROMPT` (optional, default: "0" disabled) - Remove anchor_realizations from prompts/schema (requires ENABLE_LOCAL_ANCHOR_REALIZATIONS=1)
- `DEBUG_ANCHOR_REALIZATIONS` (optional, "1" to enable) - Logs comparison between model-provided and locally-computed realizations
- `ENABLE_GPT5_SAMPLING_TUNING` (optional, default: "0" disabled) - Enable experimental sampling parameter tuning for GPT-5 models (ISS-012)
- `DEBUG_SAMPLING` (optional, "1" to enable) - Logs which sampling parameters were applied, rejected, or used via fallback
- `ENABLE_STOP_SEQUENCES` (optional, default: "0" disabled) - Enable stop sequences to reduce trailing non-JSON output (ISS-013)
- `DEBUG_STOP_SEQUENCES` (optional, "1" to enable) - Logs stop sequences applied, parse failures, and fallback retries
- `DEBUG_RAW_COMPLETION` (optional, "1" to enable) - Logs raw completion text for debugging (use with caution, can be verbose)
- `OMIT_SUBJECT_FORM_FROM_PROMPT` (optional, default: "0" disabled) - Remove c_subject_form_used from prompts/schema (ISS-014, computed locally)
- `DEBUG_SUBJECT_FORM` (optional, "1" to enable) - Logs computed vs model-provided c_subject_form_used values
- `DEBUG_PROMPT_SIZES` (optional, "1" to enable) - Logs prompt section sizes (system, user, total chars, estimated tokens) for verification (ISS-015)
- `DEBUG_RETRY` (optional, "1" to enable) - Logs retry attempts across all retry layers (ISS-016)
- `DEBUG_MAIN_GEN_OUTPUT` (optional, "1" to enable) - Logs raw JSON output from main-gen calls (truncated, ISS-018)
- `DEBUG_REGEN_OUTPUT` (optional, "1" to enable) - Logs raw JSON output from regen calls (truncated, ISS-018)
- `DEBUG_OUTPUT_MAX_CHARS` (optional, default: 8000) - Maximum characters to log in raw output (ISS-018)
- `DEBUG_OUTPUT_ON_PARSE_FAIL` (optional, "1" to enable) - Logs raw output when JSON parsing fails (ISS-018)

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
