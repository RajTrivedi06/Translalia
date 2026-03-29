# Add Component Guide

## What this file is for
Placement and integration rules for new React UI in the Next.js app.

## Placement Rules
- Route-level UI lives under `translalia-web/src/app/[locale]/(app)` or the auth pages under `src/app/[locale]/auth`.
- Reusable domain components live under the domain folder in `translalia-web/src/components/`:
  - `guide`
  - `workshop`
  - `workshop-rail`
  - `notebook`
  - `landing`
  - `account`
  - `reflection-rail`
- Low-level primitives belong in `src/components/ui`.

## State Rules
- If the component needs thread-scoped persistent UI state, prefer the existing Zustand stores in `src/store`.
- If it needs server reads/writes, prefer a TanStack Query hook in `src/lib/hooks` or `src/hooks`.
- Do not create a second source of truth for:
  - guide answers
  - workshop draft/completed line state
  - notebook notes

## Integration Checklist
1. Check whether an existing domain component already covers the use case.
2. Prefer adding a small component under the existing domain folder instead of a new top-level folder.
3. Reuse existing hooks:
   - `useTranslateLine`
   - `useTranslationJob`
   - `useGuideFlow`
   - `useWorkshopFlow`
   - `useNotebookNotes`
4. Reuse existing thread identity helpers (`useThreadId`, `threadStorage`) instead of introducing ad hoc URL parsing or localStorage keys.
5. If the component needs i18n-aware routing or messages, keep it compatible with `next-intl`.

## Styling Rules
- Follow the existing visual language unless the task is explicitly a redesign.
- Reuse `src/components/ui` primitives where they fit.
- Keep new UI state explicit rather than hidden in DOM-only behavior.

## Documentation Update Checklist
- Update this guide only if the component-placement rule itself changes.
- Update `docs/05-llm/context-packs/frontend-pack.md` if the component changes which files agents should open first.
- Update a companion guide/reference doc if the component introduces a new reusable pattern.

## Read Next
- `docs/05-llm/context-packs/frontend-pack.md`
- `docs/01-architecture/system-overview.md`
