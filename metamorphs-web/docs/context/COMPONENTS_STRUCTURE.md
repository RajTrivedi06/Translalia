## Components Structure

### Overview

Feature-first structure with shared primitives grouped under `src/components`.

### Key Areas

- `components/auth`: Auth UI elements (buttons, sheets, nav)
- `components/workspace`
  - `chat`: Chat panel and threads drawer
  - `compare`: Compare sheet and related UI
  - `flow`: Plan preview and flow components
  - `journey`: Journey panel
  - `translate`: Translation preview UI
  - `versions`: Version canvas and graph nodes

### Patterns

- Co-locate UI with feature hooks and server modules when practical
- Keep presentational components stateless; push effects/data into hooks
- Use `types/*` for props/state models shared across components

### Styling

- Tailwind CSS with project-level config in `tailwind.config.ts`
- Global styles in `src/app/globals.css`

### Example Feature Slice

- UI: `components/workspace/chat/ChatPanel.tsx`
- Hooks: `hooks/useThreadMessages.ts`
- Server: `app/api/chat/*` and `server/*` helpers

---

## COMPONENTS_STRUCTURE

### 1) Component hierarchy (key slices)

- `WorkspaceShell`
  - `ChatPanel`
    - `ThreadsDrawer`
    - `PlanPreviewSheet`
    - `TranslatorPreview`
  - `VersionCanvas`
  - `JourneyPanel`
  - `CompareSheet` (portal/overlay)

### 2) Props for each (selected)

```ts
// WorkspaceShell
export function WorkspaceShell({ projectId?, threadId? }: { projectId?: string; threadId?: string })

// ChatPanel
export function ChatPanel({ projectId }: { projectId?: string })

// ThreadsDrawer
export default function ThreadsDrawer({ projectId }: { projectId?: string })

// PlanPreviewSheet
export function PlanPreviewSheet({ open, onOpenChange, poem, fields, onLooksGood, plan?, onBuildPlan? }: { ... })

// TranslatorPreview
export function TranslatorPreview({ lines, notes, disabled?, onAccept }: { lines: string[]; notes: string[]; disabled?: boolean; onAccept: (sel: {index:number;text:string}[]) => Promise<void> })
```

### 3) State management in components

- Local UI state: inputs, dialogs (`open`, `translatorOpen`, selection lists)
- Data fetching via React Query hooks (`useThreadMessages`, lists in `WorkspaceShell`)

### 4) Shared vs page-specific

- Shared auth/account: `components/auth/*`, `components/account/ProfileForm.tsx`
- Workspace-specific UI: `components/workspace/*`

### 5) Styling approach

- Tailwind utility classes; global tokens in `tailwind.config.ts` and `globals.css`

### 6) Component dependencies

- Supabase client for queries in UI
- React Query for fetching/caching
- Zustand store (`useWorkspace`) for cross-pane coordination

### 7) Data flow between components

- `WorkspaceShell` loads project-scoped data (versions, journey, compares) and seeds `useWorkspace`
- `ChatPanel` drives flow state via API calls and writes messages; opens sheets
- `ThreadsDrawer` selects active thread in `useWorkspace`
- `CompareSheet` reads selection from `useWorkspace`
