Last updated: 2025-09-11 by CursorDoc-Editor

## Components Structure

### Overview

Feature-first structure with shared primitives grouped under `src/components`.

## V2 Components Map (Workspace)

| Component            | Path                                                      | Props (key)                 | Children                                         | Notable deps | A11y                                    |
| -------------------- | --------------------------------------------------------- | --------------------------- | ------------------------------------------------ | ------------ | --------------------------------------- |
| `WorkspaceV2Shell`   | `src/components/workspace/v2/WorkspaceV2Shell.tsx`        | `{ projectId?, threadId? }` | `ContextSidebar`, `MainWorkspace`                | —            | Landmarks only.                         |
| `ContextSidebar`     | `src/components/workspace/v2/ContextSidebar.tsx`          | —                           | `SourceTextCard`, `AnalysisCard`, `SettingsCard` | `Separator`  | `role="region"` + `aria-labelledby`.    |
| `SourceTextCard`     | `src/components/workspace/v2/sidebar/SourceTextCard.tsx`  | `{ projectId, threadId }`   | —                                                | —            | Numbered lines; stanza groups; search.  |
| `AnalysisCard`       | `src/components/workspace/v2/sidebar/AnalysisCard.tsx`    | `{ projectId, threadId }`   | —                                                | —            | dl/dt/dd with placeholders.             |
| `SettingsCard`       | `src/components/workspace/v2/sidebar/SettingsCard.tsx`    | —                           | —                                                | Zustand      | Language/style selects; dialect switch. |
| `MainWorkspace`      | `src/components/workspace/v2/MainWorkspace.tsx`           | —                           | view switch                                      | —            | Keyboard order sane.                    |
| `LineSelectionView`  | `src/components/workspace/v2/views/LineSelectionView.tsx` | `{ lines }`                 | —                                                | —            | Checkboxes; Shift+range.                |
| `WorkshopView`       | `src/components/workspace/v2/views/WorkshopView.tsx`      | —                           | `TokenCard` list                                 | —            | `button[aria-pressed]`.                 |
| `NotebookView`       | `src/components/workspace/v2/views/NotebookView.tsx`      | —                           | `NotebookPanel`                                  | —            | Textarea labeled.                       |
| `ChatView` (UI-only) | `src/components/workspace/v2/chat/ChatView.tsx`           | —                           | `ChatTimeline`, `ChatComposer`                   | lucide-react | `role="log"`; sticky composer.          |

Compare/Legacy: legacy `WorkspaceShell` remains behind flag.

## Components Props Map (current)

| Export                  | Path                                                        | Props (key)                                                                  | Notable Deps            | A11y                                                             |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `WorkspaceV2Shell`      | `src/components/workspace/v2/WorkspaceV2Shell.tsx`          | `{ projectId: string; threadId: string                                       | null }`                 | Zustand                                                          | Landmarks via `<aside>` and `<main>` |
| `ContextSidebar`        | `src/components/workspace/v2/ContextSidebar.tsx`            | `{ projectId?, threadId? }`                                                  | —                       | `<aside>`, separators; labeled cards                             |
| `MainWorkspace`         | `src/components/workspace/v2/MainWorkspace.tsx`             | —                                                                            | Zustand                 | Console debug gated by flag                                      |
| `LineSelectionView`     | `src/components/workspace/v2/views/LineSelectionView.tsx`   | `{ flowPeek?, nodes?, onProceed? }`                                          | lucide-react, shadcn/ui | `role="checkbox"`, `aria-checked`, keyboard Enter/Space          |
| `WorkshopView`          | `src/components/workspace/v2/views/WorkshopView.tsx`        | —                                                                            | Zustand                 | SR text for current line                                         |
| `NotebookView`          | `src/components/workspace/v2/views/NotebookView.tsx`        | —                                                                            | —                       | Buttons with labels; heading                                     |
| `ChatView`              | `src/components/workspace/v2/chat/ChatView.tsx`             | —                                                                            | —                       | `role="log"`, `aria-live="polite"`; sticky composer              |
| `ChatTimeline`          | `src/components/workspace/v2/chat/ChatTimeline.tsx`         | —                                                                            | lucide-react            | Buttons have `aria-label`; info sections                         |
| `ChatComposer`          | `src/components/workspace/v2/chat/ChatComposer.tsx`         | —                                                                            | —                       | Input and send button with aria-labels                           |
| `WelcomeCard`           | `src/components/workspace/v2/chat/WelcomeCard.tsx`          | —                                                                            | —                       | Headings; readable copy                                          |
| `WorkspaceShell`        | `src/components/workspace/WorkspaceShell.tsx`               | `{ projectId?, threadId? }`                                                  | react-resizable-panels  | Split panes; region labels                                       |
| `ChatPanel`             | `src/components/workspace/chat/ChatPanel.tsx`               | `{ projectId?, threadId? }`                                                  | Supabase, Zustand       | Input `aria-label`; buttons labeled                              |
| `VersionCanvas`         | `src/components/workspace/versions/VersionCanvas.tsx`       | —                                                                            | reactflow               | Edge markers; keyboard nav per reactflow defaults                |
| `JourneyPanel`          | `src/components/workspace/journey/JourneyPanel.tsx`         | —                                                                            | —                       | List semantics                                                   |
| `CompareSheet`          | `src/components/workspace/compare/CompareSheet.tsx`         | `{ open, onOpenChange, left, right }`                                        | —                       | Dialog semantics via sheet                                       |
| `NodeCard`              | `src/components/workspace/translate/NodeCard.tsx`           | `{ node, threadId, onAccepted? }`                                            | —                       | Buttons labeled                                                  |
| `LineCitationDrawer`    | `src/components/workspace/translate/LineCitationDrawer.tsx` | `{ open, onOpenChange, node, threadId }`                                     | —                       | Drawer behaves as dialog                                         |
| `FullPoemOverview`      | `src/components/workspace/translate/FullPoemOverview.tsx`   | `{ node }`                                                                   | —                       | Headings and sections                                            |
| `NotebookPanel`         | `src/components/notebook/NotebookPanel.tsx`                 | `{ initial }`                                                                | —                       | Textarea labeled via context                                     |
| `TokenCard`             | `src/components/workspace/v2/components/TokenCard.tsx`      | `{ lineId, token, tokenIndex?, totalTokens?, onGroupWithNext?, onUngroup? }` | Zustand                 | `role="group"`, `aria-labelledby`, option buttons `aria-pressed` |
| `Sheet`, `SheetContent` | `src/components/ui/sheet.tsx`                               | `{ open, onOpenChange }`, `{ side?, className?, ariaLabelledby? }`           | —                       | `role="dialog"`, `aria-modal`, focus trap, Escape to close       |

### A11y Notes

- Dialog focus trap and Escape-to-close in sheet content:

```87:106:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/ui/sheet.tsx
return (
  <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledby}>
    <div className="absolute inset-0 bg-black/40" onClick={() => ctx.onOpenChange(false)} />
    <div ref={contentRef} tabIndex={-1}>
      {children}
    </div>
  </div>
)
```

- Chat log region with polite announcements:

```11:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/chat/ChatView.tsx
<div role="log" aria-live="polite" className="flex-1 overflow-y-auto" />
```

- Token options expose pressed state and dialect in labels:

```138:147:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/components/TokenCard.tsx
onClick={() => setTokenSelection(lineId, token.tokenId, opt.id)} aria-pressed={active} title={`${opt.label} (${opt.dialect})`} aria-label={`${opt.label} (${opt.dialect})`}
```

### Feature-first map

| Component                 | File                                                         | Reads/Writes                                                                               | Flags                            | Anchors                                                                               |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------- |
| ChatPanel                 | `src/components/workspace/chat/ChatPanel.tsx`                | Reads: nodes/messages via hooks; Writes: chat messages, flow actions, instruct             | Router (optional), Translator    | `Translalia-web/src/components/workspace/chat/ChatPanel.tsx:L519–L523`                |
| PlanBuilderOverviewSheet  | `src/components/workspace/flow/PlanBuilderOverviewSheet.tsx` | Reads: nodes, thread state; Writes: `chat_threads.state`, calls preview; invalidates nodes | Prismatic, Verify, Backtranslate | `Translalia-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx:L160–L174` |
| VersionCanvas             | `src/components/workspace/versions/VersionCanvas.tsx`        | Reads: `useNodes`; Writes: positions via PATCH `/api/versions/positions`                   | —                                | `Translalia-web/src/components/workspace/versions/VersionCanvas.tsx:L52–L52`          |
| ThreadsDrawer             | `src/components/workspace/chat/ThreadsDrawer.tsx`            | Writes: create thread messages; Reads: Supabase lists                                      | —                                | `Translalia-web/src/components/workspace/chat/ThreadsDrawer.tsx:L28–L28`              |
| NodeCard/FullPoemOverview | `src/components/workspace/translate/*`                       | Reads: selected node overview                                                              | —                                | `Translalia-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx:L525–L543` |

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

```151:161:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
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

```327:331:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
defaultEdgeOptions={{
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 3 },
}}
```

- Node layout is vertical with equal spacing; nodes expose top/bottom connection positions.

```117:130:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/versions/VersionCanvas.tsx
return {
  id: api.id,
  type: "versionCard" as const,
  position: { x: X, y: TOP + idx * GAP_Y }, // equal spacing
  targetPosition: Position.Top, // child receives at top
  sourcePosition: Position.Bottom, // parent sends from bottom
  data: { /* ... */ },
};
```
