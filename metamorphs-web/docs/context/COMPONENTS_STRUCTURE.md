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
  - `providers.tsx`: React Query + theme providers

### Patterns

- Co-locate UI with feature hooks and server modules when practical
- Keep presentational components stateless; push effects/data into hooks
- Use `types/*` for props/state models shared across components
- Fetch server data via hooks in `src/hooks/*`; avoid direct fetches in components when a hook exists

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
  - `JourneyList` (inside overlays)

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

// VersionCanvas
export function VersionCanvas(): JSX.Element

// CompareSheet
export function CompareSheet({ open, onOpenChange, left, right }: { open: boolean; onOpenChange: (v:boolean)=>void; left: Version; right: Version })
```

### 3) State management in components

- Local UI state: inputs, dialogs (`open`, `translatorOpen`, selection lists)
- Data fetching via React Query hooks (`useThreadMessages`, lists in `WorkspaceShell`)
- Global coordination via `useWorkspace` store: projectId, threadId, versions, compares, active/selection

### 4) Shared vs page-specific

- Shared auth/account: `components/auth/*`, `components/account/ProfileForm.tsx`
- Workspace-specific UI: `components/workspace/*`

### 5) Styling approach

- Tailwind utility classes; global tokens in `tailwind.config.ts` and `globals.css`

### 6) Component dependencies

- Supabase client for queries in UI
- React Query for fetching/caching
- Zustand store (`useWorkspace`) for cross-pane coordination
- React Flow (`VersionCanvas`) for node/edge graph

### 7) Data flow between components

- `WorkspaceShell` loads project-scoped data (versions, journey, compares) and seeds `useWorkspace`
- `ChatPanel` drives flow state via API calls and writes messages; opens sheets
- `ThreadsDrawer` selects active thread in `useWorkspace`
- `CompareSheet` reads selection from `useWorkspace`
- `VersionCanvas` renders nodes from `useWorkspace.versions` and augments with `/api/versions/nodes` overview labels

### 8) Component Creation Guidelines (LLM)

- Keep components focused and prop-driven; lift side-effects into hooks.
- Prefer server data access via `src/hooks/*`; add a hook if missing.
- Co-locate feature styles and subcomponents under the feature folder.
- Use TypeScript types from `src/types/*`; avoid `any`.
- Validate inputs where applicable; avoid catching errors without handling.

### 9) Usage Examples

```tsx
// In a workspace page
<WorkspaceShell projectId={projectId} threadId={threadId} />

// Sending a message via ChatPanel form is handled internally

// Programmatically create a compare from two selected versions via VersionCanvas UI
```

### 10) LLM Context

- To open plan preview from chat, trigger the interview flow until `await_plan_confirm`, then set `PlanPreviewSheet.open`.
- To preview translation, ensure `NEXT_PUBLIC_FEATURE_TRANSLATOR=1` and call `/api/translator/preview` via `useInterviewFlow().translatorPreview`.
