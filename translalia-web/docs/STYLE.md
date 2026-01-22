---
title: Docs Style Guide
updated: 2025-11-04
role: CursorDocs
---

### Purpose

This guide standardizes how we write, cite, and maintain documentation across the repository. It defines heading levels, tables, code and evidence blocks, callout notes, redaction rules, a shared glossary, and a reusable boilerplate block for new docs.

### How this doc is generated

- Authored by Cursor Docs from repository sources; human maintainers should review changes.
- Facts must be supported by evidence citations that point to file:line anchors in this repo.
- Redact secrets and sensitive data per the rules below.

### Scope

This document covers both documentation style (below) and the code style conventions actually used in the repository (new sections: Linting, Formatting, Naming, TypeScript, Comments, Imports/Exports, Testing). Each code convention is supported by evidence anchors.

---

### Code Style (Repository Conventions)

#### Linting configuration in use

We use Next.js flat ESLint config with TypeScript rules:

```12:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/eslint.config.mjs
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

- Lint scripts:

```5:11:/Users/raaj/Documents/CS/metamorphs/translalia-web/package.json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "lint": "next lint"
}
```

No explicit Prettier config was found; formatting is enforced primarily by ESLint/Next and editor defaults.

#### Code formatting standards observed

- Indentation: 2 spaces
- Quotes: double quotes for strings
- Semicolons: present
- JSX props/attributes on new lines when multiline

```1:9:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
```

```9:17:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/ui/button.tsx
export function Button({
  className = "",
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
```

#### Naming conventions

- Files/directories:
  - Route files follow Next.js conventions: `route.ts`, `page.tsx`, lower‑case segment folders.
  - Components are PascalCase (e.g., `Button.tsx`).
  - Hooks are in `hooks/` and named with `use*` prefix.
  - Library utilities live under `src/lib/` using camelCase filenames (e.g., `featureFlags.ts`).

```1:5:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspace/page.tsx
import { redirect } from "next/navigation";

export default function WorkspacePage() {
  redirect("/workspaces");
}
```

```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useJourney.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export function useJourney(projectId?: string, limit = 20) {
```

```1:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/featureFlags.ts
export function isEnhancerEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_ENHANCER === "1";
}
export function isTranslatorEnabled() {
```

#### TypeScript patterns and conventions

- `strict` mode enabled; `noEmit` build with `tsc` for types only.
- Module resolution via `bundler`; path alias `@/*` to `src/*`.
- Prefer explicit function return types for exported APIs; component and hook signatures are typed.
- Zod is used for runtime validation of request bodies in API routes.

```2:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/tsconfig.json
"strict": true,
"noEmit": true,
"moduleResolution": "bundler",
"paths": {
  "@/*": ["./src/*"]
}
```

```12:17:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  sourceText: z.string().min(1, "sourceText is required"),
});
```

#### Comments and documentation

- Keep comments concise and focused on non‑obvious rationale, invariants, and edge cases.
- Top‑file notes are used sparingly to mark important conventions.

```1:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
// NOTE(cursor): Centralized translation defaults; envs override without code changes
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";

export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
```

#### Import/export conventions

- Group imports: external packages first, then internal alias imports (`@/*`).
- Use the `@/*` path alias instead of long relative paths.
- Prefer named exports for utilities; components may use named or default exports depending on usage.

```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import OpenAI from "openai";
// import { Redis } from "@upstash/redis"; // Optional dependency
import { TRANSLATOR_MODEL } from "@/lib/models";
```

```1:7:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/ui/button.tsx
"use client";
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};
```

#### Testing conventions

No test files (`*.test.*`/`*.spec.*`) were found in the repository at this time. When adding tests, prefer:

- colocated `__tests__/` folders or `*.test.ts(x)` files near the code under test
- React component tests using Testing Library
- API route tests using supertest or Next test utilities
- Naming: `<unit>.test.ts` for unit tests, `<feature>.spec.ts` for higher‑level behavior

---

### Boilerplate block (embed in new docs)

```md
---
title: <Doc Title>
updated: YYYY-MM-DD
role: CursorDocs
---

> This document is generated from repository sources. Cite evidence with file:line anchors. Do not include secrets; mask .env values.
```

### Headings

- Use at most three levels.
  - Top-level: `###` Title (within the page body; use front matter for the doc title)
  - Subsections: `####`
  - Sub-subsections: plain bold text or lists
- Keep headings short, action-oriented, and scannable.

### Tables

- Use pipe tables with a header row and separator.
- Keep column names concise; prefer nouns over sentences.
- Example:

| Area | Source   | Access                      |
| ---- | -------- | --------------------------- |
| Auth | Supabase | `src/lib/supabaseServer.ts` |

### Code vs Evidence blocks

- When citing code that exists in the repo (evidence), use file:line anchors with no language tag:

```27:30:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

- When showing new or illustrative code that is not in the repo, use fenced code with a language tag (e.g., `ts, `bash).
- Keep snippets minimal and relevant. Prefer linking multiple small evidence blocks over one large one.

### Callout notes

- Format as blockquotes starting with bold labels:
  - **Note**: general context or clarification.
  - **Warning**: risky behavior, limitations, or deprecations.
  - **Policy**: intended behavior irrespective of current implementation.
  - **Implementation**: behavior as currently implemented in code with an evidence anchor.
- Example:
  > **Policy**: Feature-off endpoints should return 403.
  >
  > **Implementation**: Translator preview currently returns 403 when disabled:

```27:30:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

### Policy vs Implementation

- Default to documenting the intended policy. When the code differs, add an adjacent **Implementation** callout with an evidence anchor and clearly state the divergence.
- For feature flags, policy is to return 403 when the feature is OFF unless code explicitly differs in a given route.

### Redaction rules

- Never print secrets, tokens, or PII.
- Mask environment values. List variable names only (e.g., `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) without values. If illustrating a value, redact like `sk-****...abcd`.
- Do not paste cookies, session IDs, or auth headers. Summarize instead.
- When citing evidence that contains sensitive content, excerpt only the necessary lines and avoid secrets in the snippet.

### Evidence citations: format & anchors

- Always include `startLine:endLine:absolute_path` as the first line in the fenced block.
- Do not add a language tag for evidence blocks.
- Keep line ranges tight (≤ ~20 lines).
- Prefer absolute paths under `/Users/raaj/Documents/CS/Translalia/...` for consistency.

#### Anchors (inline references)

- When referring to evidence inline (not as a fenced block), use the short form: `path:Lstart–Lend`.
- Example inline mention: `Translalia-web/package.json:L12–L24`.

### Feature flags (documentation policy)

- Public flags follow `NEXT_PUBLIC_FEATURE_*`. When OFF, policy is 403 for the related endpoint(s) unless noted.
- Examples (policy-level; verify with implementation evidence where needed):
  - `NEXT_PUBLIC_FEATURE_TRANSLATOR`: Translator endpoints OFF → 403.
  - `NEXT_PUBLIC_FEATURE_ENHANCER`: Enhancer endpoint OFF → 403.
  - `NEXT_PUBLIC_FEATURE_PRISMATIC`: Translator ignores prismatic mode when OFF.
  - `NEXT_PUBLIC_FEATURE_VERIFY`: Verify OFF → 403.
  - `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`: Back-translate OFF → 403.
  - `NEXT_PUBLIC_FEATURE_SMART_INTERVIEW_LLM`: Clarifier LLM OFF → 403.

### Shared glossary

- **translator**: LLM pathway that produces poem translation output; main surface uses `TRANSLATOR_MODEL`.
- **enhancer**: JSON planner that synthesizes user inputs/glossary into a structured request; uses `ENHANCER_MODEL`.
- **router**: Lightweight intent classifier guiding interview flow; uses `ROUTER_MODEL` when enabled.
- **prismatic**: Translator mode producing A/B/C variants in one pass; gated by `NEXT_PUBLIC_FEATURE_PRISMATIC`.
- **verify**: Optional QA scoring endpoint that returns JSON rubric scores for a candidate translation.
- **back-translate**: Optional endpoint producing a brief back-translation and drift classification.
- **prompt_hash**: Stable hash over `{route, model, system, user, schema?}` used for logging/correlation, never a secret.
- **thread-scoped**: Data, actions, and caches bound to `(projectId, threadId)`; isolate state per thread.

### Writing style

- Favor short paragraphs and bullet lists; front-load the key point.
- Use backticks for file, directory, function, and class names (e.g., `src/lib/ai/prompts.ts`).
- Use descriptive link text; avoid naked URLs.
- Keep tense consistent; narrate progress succinctly in status updates when applicable.

### Maintenance

- Update the `updated` front-matter date on substantive edits.
- Prefer evidence anchors over paraphrase when documenting behavior.
- When removing outdated statements, replace with current policy and add an implementation callout if code is still catching up.

### Tables-first policy

- Prefer opening sections with a concise table summarizing key facts before prose.
- Follow the table with brief bullets elaborating on decisions or caveats.
- Keep tables under ~7 columns; split if wider.

### Doc update cadence

- Update docs in the same PR as code changes that affect behavior or flags.
- Refresh high-traffic docs (root `README.md`, app `README.md`) when stack, run steps, or envs change.
- Bump the front-matter `updated` date for any meaningful content change.
