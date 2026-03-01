# Frontend Context Pack

## What this file is for
Dense context for frontend routes, UI flow, and client-state behavior.

## When to read/use this
- Use for tasks in `translalia-web/src/app`, `translalia-web/src/components`, `translalia-web/src/hooks`, and `translalia-web/src/store`.

## Frontend Stack Snapshot
- Framework: Next.js App Router + React + TypeScript.
- Styling: Tailwind CSS.
- Server state: TanStack Query.
- Client state: Zustand with thread-scoped persistence.
- i18n: `next-intl` with locale routes under `src/app/[locale]/`.

## Primary UX Flow
1. Guide Rail setup (source poem, intent, translation settings).
2. Workshop translation flow (line-by-line/stanza-by-stanza variants).
3. Notebook assembly/editing flow.
4. Diary archive browsing for completed poems.

## Key Frontend Directories
- `translalia-web/src/app/[locale]/(app)/workshop` - main translation workspace UI.
- `translalia-web/src/app/[locale]/(app)/notebook` - assembly and refinement UI.
- `translalia-web/src/app/[locale]/(app)/diary` - completed-poem views.
- `translalia-web/src/components/workshop` and `translalia-web/src/components/notebook` - domain components.
- `translalia-web/src/store` - guide, workshop, notebook, and workspace state slices.

## State and Data Patterns
- Keep long-lived UI state thread-scoped to avoid cross-thread leakage.
- Use TanStack Query for server reads/writes and cache invalidation.
- Keep AI-request lifecycle states explicit (pending/success/error).
- Preserve method-specific behavior toggles through feature flags and env switches.

## Translation UI Expectations
- Method 2 is primary and returns 3 variants (A/B/C) for user selection.
- Word-level alignment is displayed with generated suggestions and metadata.
- Distinctness/regeneration logic should preserve clear stylistic separation between variants.
