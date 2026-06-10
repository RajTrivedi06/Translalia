# Frontend Context Pack

## Load This For
- UI work in `translalia-web/src/app/[locale]`
- domain components in `translalia-web/src/components`
- thread-scoped client state and query hooks

## Open These Files First
- `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/page.tsx`
- `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx`
- `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/tuning/page.tsx` (translation tuning UI; mock-data prototype)
- `translalia-web/src/app/[locale]/(app)/verification-dashboard/page.tsx`
- `translalia-web/src/store/guideSlice.ts`
- `translalia-web/src/store/workshopSlice.ts`
- `translalia-web/src/store/notebookSlice.ts`
- `translalia-web/src/lib/hooks/useTranslateLine.ts`
- `translalia-web/src/lib/hooks/useTranslationJob.ts`

## Frontend Invariants
- State is thread-scoped. Do not introduce localStorage keys or persistence outside the existing thread-aware stores.
- `useGuideStore` holds translation intent, model, range mode, and method selection.
- `useWorkshopStore` is the source of truth for draft lines, completed lines, and variant selection in the workshop UI.
- `useNotebookStore` owns note-panel and notebook session UI state; persisted notes themselves live in Supabase.
- `useTranslateLine()` decides between `method-1` and `method-2` endpoints.
- `useTranslationJob()` keeps polling until the backend job reaches a terminal status.

## Page and Component Shape
- Route group: `src/app/[locale]/(app)` contains authenticated app pages.
- Legacy `/workspace` URLs redirect to `/workspaces`; prefer `workspaces` paths in new work.
- Domain folders under `src/components` are meaningful; prefer adding to an existing domain folder rather than inventing a new top-level folder.
- `src/components/ui` is the primitive layer.

## What Usually Breaks
- Thread hydration mismatches after URL/thread changes
- Duplicate or conflicting sources of truth for draft/completed translations
- Components bypassing existing hooks and writing fetch logic ad hoc

## Read Next
- `docs/03-guides/add-component.md`
- `docs/01-architecture/data-flow.md`
