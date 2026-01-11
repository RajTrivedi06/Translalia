Last updated: 2025-11-04 by CursorDoc-Editor

## Components Structure

### Overview

Feature-first structure with shared primitives grouped under `src/components`. V2 workspace lives under `src/components/workspace/v2`, legacy under `src/components/workspace/*`.

### Component tree (major surfaces)

```
App (src/app/layout.tsx)
  └─ Providers (React Query, Supabase)
     └─ /workspaces/[projectId]/threads/[threadId]
        ├─ WorkspaceV2Shell (flag-dependent; otherwise WorkspaceShell)
        │  ├─ ContextSidebar
        │  │  ├─ SourceTextCard
        │  │  ├─ AnalysisCard
        │  │  └─ SettingsCard
        │  └─ MainWorkspace
        │     ├─ LineSelectionView | WorkshopView | NotebookView (view switch)
        │     │  └─ TokenCard[] (WorkshopView)
        │     └─ ChatView (UI-only)
        │        ├─ ChatTimeline
        │        └─ ChatComposer
        └─ (Legacy) WorkspaceShell
           ├─ GuideRail
           ├─ ChatPanel
           │  └─ ThreadsDrawer
           ├─ WorkshopRail
           ├─ NotebookPhase6
           ├─ Versions (VersionCanvas, VersionCard, nodes/*)
           └─ Overlays: CompareSheet, PlanBuilderOverviewSheet
```

### Shared/common components

- `src/components/ui/*`: button, card, dialog, sheet, input, select, textarea, badge, separator
- `src/components/layout/*`: Pane, LanguageSelector
- `src/components/common/*`: ErrorBoundary, LoadingSkeletons, OnboardingTooltip
- `src/components/providers.tsx`: React Query + Supabase providers

### Page/route components

- `src/app/page.tsx`: landing
- `src/app/(app)/workspaces/*`: list, project page, thread page
- `src/app/auth/*`: sign-in/up
- API route handlers live under `src/app/api/**/route.ts`

### Naming conventions

- Components: PascalCase (`WorkspaceV2Shell`, `TokenCard`); default or named exports depending on usage
- Feature folders: `components/workspace/*`, V2 under `components/workspace/v2/*`
- Hooks: `use*` prefix in `src/hooks/*` (`useJourney`, `useNodes`, `useThreadMessages`)
- Zustand stores: `src/store/*` with `useXxxStore` getters/actions
- Types under `src/types/*` (e.g., `NotebookCell`, `Workshop`)

### Props patterns and state management

- Props are minimal and typed (string ids, callbacks) with most server data fetched via hooks
- Local UI state via `useState` for view toggles, dialogs; cross-pane state via Zustand stores
- Server state fetched with React Query hooks (`useJourney`, `useNodes`, `useUploadsList`, etc.)
- Thread scoping: persisted slices include `meta.threadId` and use `threadStorage` for per-thread keys

### Composition patterns

- Views compose smaller presentational components (e.g., TokenCard list within WorkshopView)
- Overlays/Sheets (e.g., CompareSheet) driven by store state (`useWorkspace`)
- Providers wrap the app for SSR cookie sync and React Query cache
- UI primitives (sheet, dialog) composed to implement accessible overlays

### Reusable hooks and utilities

- Hooks: `src/hooks/*` (uploads, journey, nodes, supabase user, useThreadId, etc.)
- AI utilities: `src/lib/ai/*` (openai client, cache, promptHash, workshop prompts)
- Auth helpers: `src/lib/supabase*`, `src/lib/auth/requireUser`
- Feature flags: `src/lib/featureFlags.ts`
- Thread state: `src/lib/threadStorage.ts`

### Representative components (paths, props)

| Component           | Path                                                      | Props (key)                   |
| ------------------- | --------------------------------------------------------- | ----------------------------- |
| `WorkspaceV2Shell`  | `src/components/workspace/v2/WorkspaceV2Shell.tsx`        | `{ projectId?, threadId? }`   |
| `ContextSidebar`    | `src/components/workspace/v2/ContextSidebar.tsx`          | `{ projectId?, threadId? }`   |
| `MainWorkspace`     | `src/components/workspace/v2/MainWorkspace.tsx`           | `—`                           |
| `LineSelectionView` | `src/components/workspace/v2/views/LineSelectionView.tsx` | `{ lines? }`                  |
| `WorkshopView`      | `src/components/workspace/v2/views/WorkshopView.tsx`      | `—`                           |
| `NotebookView`      | `src/components/workspace/v2/views/NotebookView.tsx`      | `—`                           |
| `ChatView`          | `src/components/workspace/v2/chat/ChatView.tsx`           | `—`                           |
| `TokenCard`         | `src/components/workspace/v2/components/TokenCard.tsx`    | `{ lineId, token, ... }`      |
| `WorkspaceShell`    | `src/components/workspace/WorkspaceShell.tsx`             | `{ projectId?, threadId? }`   |
| `ChatPanel`         | `src/components/workspace/chat/ChatPanel.tsx`             | `{ projectId?, threadId? }`   |
| `ThreadsDrawer`     | `src/components/workspace/chat/ThreadsDrawer.tsx`         | `{ projectId? }`              |
| `VersionCanvas`     | `src/components/workspace/versions/VersionCanvas.tsx`     | `—`                           |
| `CompareSheet`      | `src/components/workspace/compare/CompareSheet.tsx`       | `{ open, onOpenChange, ... }` |

### A11y notes (selected)

- Chat log uses `role="log"` and `aria-live="polite"`
- Sheet/Dialog components set `role="dialog"`, `aria-modal`, focus-trap, Escape close
- TokenCard exposes pressed state and dialect in labels

### Conventions

- Co-locate UI with feature hooks; keep presentational components stateless
- Fetch via hooks; avoid ad hoc fetch inside components when a hook exists
- Reuse UI primitives; prefer composition over inheritance
- Validate inputs with Zod where applicable

### Example usage

```tsx
// In a workspace route page
<WorkspaceV2Shell projectId={projectId} threadId={threadId} />
```
