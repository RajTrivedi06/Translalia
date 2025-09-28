Last updated: 2025-09-11 by CursorDoc-Editor

## Components Structure

### Overview

Feature-first structure with shared primitives grouped under `src/components`.

### Feature-first map

| Component                 | File                                                         | Reads/Writes                                                                               | Flags                            | Anchors                                                                               |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------- |
| ChatPanel                 | `src/components/workspace/chat/ChatPanel.tsx`                | Reads: nodes/messages via hooks; Writes: chat messages, flow actions, instruct             | Router (optional), Translator    | `metamorphs-web/src/components/workspace/chat/ChatPanel.tsx:L519–L523`                |
| PlanBuilderOverviewSheet  | `src/components/workspace/flow/PlanBuilderOverviewSheet.tsx` | Reads: nodes, thread state; Writes: `chat_threads.state`, calls preview; invalidates nodes | Prismatic, Verify, Backtranslate | `metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx:L160–L174` |
| VersionCanvas             | `src/components/workspace/versions/VersionCanvas.tsx`        | Reads: `useNodes`; Writes: positions via PATCH `/api/versions/positions`                   | —                                | `metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx:L52–L52`          |
| ThreadsDrawer             | `src/components/workspace/chat/ThreadsDrawer.tsx`            | Writes: create thread messages; Reads: Supabase lists                                      | —                                | `metamorphs-web/src/components/workspace/chat/ThreadsDrawer.tsx:L28–L28`              |
| NodeCard/FullPoemOverview | `src/components/workspace/translate/*`                       | Reads: selected node overview                                                              | —                                | `metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx:L525–L543` |

Notes:

- Version creation flows through `PlanBuilderOverviewSheet` invoking `/api/translator/preview` and then polling `useNodes`.

### Key Areas

- `components/auth`: Auth UI elements (buttons, sheets, nav)
- `components/workspace`

  - `chat`: Chat panel and threads drawer
  - `compare`: Compare sheet and related UI
  - `flow`: Plan builder overview sheet and flow components
  - `journey`: Journey panel
  - `translate`: Translation preview UI
  - `versions`: Version canvas and graph nodes
  - `providers.tsx`: React Query + theme providers

  - Note: PlanBuilderOverviewSheet shows preview, prismatic tabs if present, and optional verify/back-translate buttons (feature-flagged). VersionCanvas renders nodes sourced from React Query; avoid Zustand as the source of truth for versions.

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
    - `PlanBuilderOverviewSheet`
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

// PlanBuilderOverviewSheet
export default function PlanBuilderOverviewSheet({ threadId, open, onOpenChange }: { threadId: string; open: boolean; onOpenChange: (v:boolean)=>void })

// TranslatorPreview
export function TranslatorPreview({ lines, notes, disabled?, onAccept }: { lines: string[]; notes: string[]; disabled?: boolean; onAccept: (sel: {index:number;text:string}[]) => Promise<void> })

// VersionCanvas
export function VersionCanvas(): JSX.Element

// CompareSheet
export function CompareSheet({ open, onOpenChange, left, right }: { open: boolean; onOpenChange: (v:boolean)=>void; left: Version; right: Version })
```

### 3) State management in components

- Local UI state: inputs, dialogs (`open`, `translatorOpen`, selection lists)
- Data fetching via React Query hooks (`useThreadMessages`, `useNodes`)
- Global coordination via `useWorkspace` store: projectId, threadId, compares, active/selection, drawer open state
  - `useWorkspace` coordinates selection for `CompareSheet` and currently selected node for plan/overview
  - Canvas nodes are NOT sourced from the store; they come from `useNodes(projectId, threadId)`

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
- `react-resizable-panels` for adjustable layout in `WorkspaceShell`

### 7) Data flow between components

- `WorkspaceShell` loads project-scoped data (journey, compares) and seeds `useWorkspace`
- `ChatPanel` drives flow state via API calls and writes messages; opens sheets
- `ThreadsDrawer` selects active thread in `useWorkspace`
- `CompareSheet` reads selection from `useWorkspace`
- `VersionCanvas` renders nodes from React Query via `useNodes(projectId, threadId)` (single source of truth) and enriches from the same list
- `PlanBuilderOverviewSheet` loads thread state from `chat_threads.state`, triggers `/api/translator/preview`, and upon detecting the new node, closes the drawer; invalidation of `["nodes", projectId, threadId]` updates canvas

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

- To open plan preview from chat, trigger the interview flow until `await_plan_confirm`, then open `PlanBuilderOverviewSheet`.
- To preview translation, ensure `NEXT_PUBLIC_FEATURE_TRANSLATOR=1` and call `/api/translator/preview` via `useInterviewFlow().translatorPreview`.

---

#### Changelog

- 2025-09-09: Updated canvas data source to React Query `useNodes`; adjusted data-flow and state responsibilities; added drawer close behavior after Accept. (CursorDoc-Editor)

### VersionCanvas lineage rendering

- Edges are generated from `parent_version_id → id` and rendered with closed arrow markers.

```151:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
const lineage: Edge[] = (apiNodes || [])
  .filter((n) => !!n.parent_version_id)
  .map((n) => ({
    id: `lineage:${String(n.parent_version_id)}->${n.id}`,
    source: String(n.parent_version_id),
    target: n.id,
    type: "straight", // clean vertical line
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
```

- Default edge styling uses thicker strokes and arrow markers.

```327:331:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
defaultEdgeOptions={{
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 3 },
}}
```

- Node layout is vertical with equal spacing; nodes expose top/bottom connection positions.

```117:130:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
return {
  id: api.id,
  type: "versionCard" as const,
  position: { x: X, y: TOP + idx * GAP_Y }, // equal spacing
  targetPosition: Position.Top, // child receives at top
  sourcePosition: Position.Bottom, // parent sends from bottom
  data: { /* ... */ },
};
```
