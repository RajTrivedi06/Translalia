### [Last Updated: 2025-09-23]

## State Management

### Overview

Client-side state focuses on workspace, threads, and UI sheets. This document outlines where state lives and how it flows.

### Stores & Hooks

- `store/workspace.ts`: Central workspace store (project, selection, UI toggles)
- Hooks:
  - `hooks/useThreadMessages.ts`: Fetch/stream thread messages
  - `hooks/useProfile.ts`: Load and cache profile data
  - `hooks/useInterviewFlow.ts`: Orchestrate guided interview flows
  - `hooks/useSupabaseUser.ts`: Supabase auth user state
  - `hooks/useNodes.ts`: Polls `/api/versions/nodes` for node list/overview
  - `hooks/useJourney.ts`: Fetches `journey_items` list for activity

## V2 UI Slice (Zustand)

| Key                          | Type                                                                                           | Purpose                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------- | ----------- | -------------------- |
| `ui.currentView`             | `'chat'                                                                                        | 'line-selection'                                  | 'workshop' | 'notebook'` | Center-pane routing. |
| `ui.targetLang`              | `string`                                                                                       | Settings target language.                         |
| `ui.targetStyle`             | `string`                                                                                       | Settings target style.                            |
| `ui.includeDialectOptions`   | `boolean`                                                                                      | Show dialect-tagged options.                      |
| `ui.currentLine`             | `number`                                                                                       | Workshop line focus.                              |
| `tokensSelections`           | `Record<lineId, Record<tokenId, string>>`                                                      | Selected token options; `user:<text>` for custom. |
| `workshopDraft.notebookText` | `string`                                                                                       | In-progress compiled text.                        |
| Actions                      | `setCurrentView`, `setCurrentLine`, `setTokenSelection`, `appendNotebook`, `clearSelections()` | —                                                 |

Persistence:

- `tokensSelections` and `workshopDraft.notebookText` are hydrated/saved per-thread via localStorage in the Workshop view.

```64:73:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/v2/views/WorkshopView.tsx
// Hydrate from localStorage on thread change
React.useEffect(() => {
  const saved = loadLocal<{ tokenSelections: any; notebookText: string }>(threadId);
  if (saved) {
    useWorkspace.setState((s) => ({
      tokensSelections: saved.tokenSelections ?? s.tokensSelections,
      workshopDraft: { notebookText: saved.notebookText ?? s.workshopDraft.notebookText },
    }));
  } else {
    clearSelections();
    useWorkspace.setState({ workshopDraft: { notebookText: "" } });
  }
}, [threadId]);
```

```82:88:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/v2/views/WorkshopView.tsx
// Throttled save to localStorage
React.useEffect(() => {
  const id = window.setTimeout(
    () => saveLocal(threadId, { tokenSelections, notebookText }),
    2000
  );
  return () => window.clearTimeout(id);
}, [threadId, tokenSelections, notebookText]);
```

Polling rules (TanStack Query):

- `useNodes` polls every ~1.5s when `projectId` and `threadId` are present. Prefer gating polling by view (e.g., poll in `workshop` and pause in others) to reduce load.

```56:62:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
return useQuery({
  queryKey: ["nodes", projectId, threadId],
  queryFn: () => fetchNodes(threadId!),
  enabled: !!projectId && !!threadId,
  refetchInterval: 1500,
});
```

### Server-State vs Client-State

- Fetch server data in route handlers or server components where possible
- Hydrate client with minimal initial state; rely on hooks for live updates

#### Decision Table

| Data                                                  | Source of truth          | Transport (hook/route)                                           | Client cache/store                                   | Persistence    | Anchors                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thread flow snapshot (phase, next question, snapshot) | DB: `chat_threads.state` | `useInterviewFlow().peek` → `GET /api/flow/peek?threadId=`       | React Query `["flow_peek", threadId]`                | Supabase JSONB | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useInterviewFlow.ts#L10-L21; /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/peek/route.ts#L73-L83                                   |
| Thread state edits (poem, collected_fields)           | DB: `chat_threads.state` | Plan sheet writes via Supabase client                            | n/a (write-through)                                  | Supabase JSONB | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx#L108-L116                                                                                               |
| Versions list (nodes for a thread)                    | DB: `versions`           | `useNodes(projectId, threadId)` → `GET /api/versions/nodes`      | React Query `["nodes", projectId, threadId]`         | Supabase rows  | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts#L34-L41; /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/app/api/versions/nodes/route.ts#L63-L69                                     |
| Journey timeline                                      | DB: `journey_items`      | `useJourney(projectId)` → `GET /api/journey/list`                | React Query `["journey", projectId, limit]`          | Supabase rows  | /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/hooks/useJourney.ts#L5-L12; /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/app/api/journey/list/route.ts#L15-L23                                     |
| Chat messages                                         | DB: `chat_messages`      | `useThreadMessages(projectId, threadId)` (browser Supabase read) | React Query `["chat_messages", projectId, threadId]` | Supabase rows  | /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/hooks/useThreadMessages.ts#L20-L25                                                                                                                            |
| Version positions                                     | DB: `versions.pos`       | Canvas PATCH `/api/versions/positions`                           | n/a                                                  | Supabase rows  | /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/components/workspace/versions/VersionCanvas.tsx#L99-L104; /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/app/api/versions/positions/route.ts#L17-L23 |
| Compare nodes                                         | DB: `compares`           | Canvas `POST /api/compares`                                      | Zustand `useWorkspace` compares                      | Supabase rows  | /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/components/workspace/versions/VersionCanvas.tsx#L236-L249; /Users/raaj/Documents/CS/metamorphs-met amorphs-web/src/store/workspace.ts#L55-L63                 |

### Patterns

- Keep derived state in selectors/memos instead of duplicating sources
- Use URL params and `app/(app)/workspace/*` routes to reflect navigation state
- Co-locate feature state near UI that consumes it
- Prefer React Query for async server data; Zustand for cross-pane UI/session state

### Thread-Scoped Query Keys

We use TanStack Query keys like `["nodes", projectId, threadId]` for thread-scoped remote reads. Zustand holds UI/session state to avoid stale canvas divergence.

| Query Key                     | Params                  | Reader(s)                                | Writer(s) / Invalidators                                       | Anchors                                                                                                                                                                                             |
| ----------------------------- | ----------------------- | ---------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `["nodes", pId, tId]`         | `projectId`, `threadId` | `useNodes(projectId, threadId)` in UI    | API writes update `versions` then polling refresh              | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts#L38-L45                                                                                                                    |
| `["chat_messages", pId, tId]` | `projectId`, `threadId` | `useThreadMessages(projectId, threadId)` | Writes via `/api/chat/[threadId]/messages`; refetch after send | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useThreadMessages.ts#L20-L25; /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/chat/ChatPanel.tsx#L348-L361 |
| `["journey", pId, limit]`     | `projectId`, `limit`    | `useJourney(projectId, limit)`           | Invalidated on accept-lines; also loaded in `WorkspaceShell`   | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useJourney.ts#L5-L12; /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx#L351-L365 |
| `["flow_peek", threadId]`     | `threadId`              | `useInterviewFlow().peek`                | Invalidated on start/answer/confirm                            | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useInterviewFlow.ts#L10-L16; /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useInterviewFlow.ts#L44-L46                  |
| `["citations", pId]`          | `projectId`             | none (placeholder)                       | Invalidated on thread change to avoid stale overlays           | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/WorkspaceShell.tsx#L71-L74                                                                                              |

```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
return useQuery({
  queryKey: ["nodes", projectId, threadId],
  queryFn: () => fetchNodes(threadId!),
  enabled: !!projectId && !!threadId,
  refetchInterval: 1500,
});
```

### Side Effects

- Network calls centralized in hooks or `server/*` modules
- Debounce/throttle chat inputs where appropriate
- Persist graph positions via `PATCH /api/versions/positions` on drag-stop debounce

#### Key mutation flows (client → API)

```346:361:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/chat/ChatPanel.tsx
const res = await fetch(`/api/chat/${threadId}/messages`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  body: JSON.stringify({ projectId, content, meta: cites.length ? { version_ids: cites } : {} }),
});
```

```160:174:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx
const res = await fetch("/api/translator/preview", {
  method: "POST",
  headers,
  credentials: "include",
  body: JSON.stringify({ threadId, forceTranslate: !!force, mode, bundle: { collected_fields: { targetVariety: targetVarietyForPayload } } }),
});
```

```46:52:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/translate/NodeCard.tsx
const res = await fetch("/api/translator/accept-lines", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ threadId, selections }),
});
```

---

## STATE_MANAGEMENT

### 1) Solution(s)

- Global UI/state: Zustand (`store/workspace.ts`)
- Server state: TanStack React Query for lists/messages
- Server conversation state: persisted in `chat_threads.state` with schema `types/sessionState.ts`

### 2) Global state structure (Zustand)

```ts
type WorkspaceState = {
  projectId?: string;
  threadId?: string;
  workspaceName?: string | null;
  versions: Version[];
  compares: CompareNode[];
  journey: JourneyItem[];
  activeVersionId?: string;
  highlightVersionId?: string;
  selectedNodeId?: string | null;
  setSelectedNodeId(id?: string | null): void;
  overview: any | null;
  preview?: any | null;
  activeCompare?: { leftId: string; rightId: string };
  compareOpen: boolean;
  setWorkspaceMeta(id: string, name: string | null): void;
  setProjectId(id?: string): void;
  setThreadId(id?: string): void;
  setVersions(vs: Version[]): void;
  setJourney(js: JourneyItem[]): void;
  setCompares(cs: CompareNode[]): void;
  setActiveVersionId(id?: string): void;
  setHighlightVersionId(id?: string): void;
  setSelectedNodeId(id?: string | null): void;
  setActiveCompare(p?: { leftId: string; rightId: string }): void;
  setCompareOpen(open: boolean): void;
  addVersion(v: Version): void;
  addCompare(c: CompareNode): void;
  pinJourney(j: JourneyItem): void;
  setVersionPos(id: string, pos: { x: number; y: number }): void;
  tidyPositions(): void;
  resetThreadEphemera(): void;
};
```

Anchors:

```40:49:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/store/workspace.ts
export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: undefined,
  threadId: undefined,
  workspaceName: null,
  versions: [
    { id: "A", title: "Version A", lines: ["…"], tags: ["literal"] },
```

### 3) Actions/reducers/stores

- See `store/workspace.ts` for action list and defaults
- Server session actions: `server/threadState.ts` (`getThreadState`, `patchThreadState`, `appendLedger`)
- Interview flow: `useInterviewFlow` wraps `/api/flow/*`, `/api/enhancer`, `/api/translate`, and translator preview/instruct endpoints

### 4) Local vs global state decisions

- Local: input fields, dialog open/close, selection state
- Global: active project/thread, versions/compares/journey, compare drawer

### 5) Data persistence approach

- UI data fetched on demand via Supabase (browser) and stored in Zustand
- Conversation/flow state persisted per-thread as JSON in DB via server routes

### 6) Real-time subscriptions

- Auth state: `useSupabaseUser` subscribes to Supabase `onAuthStateChange`
- No DB realtime listeners are currently implemented; React Query refetches as needed
- `WorkspaceShell` invalidates `nodes` and `citations` query keys on thread change

### LLM JSON Index (components → state interactions)

```json
{
  "WorkspaceShell": {
    "props": ["projectId?", "threadId?"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useThreadId", "useQueryClient"],
    "calls_routes": ["GET /api/flow/peek"]
  },
  "ChatPanel": {
    "props": ["projectId?"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useInterviewFlow", "useThreadMessages", "useNodes"],
    "calls_routes": [
      "POST /api/chat/[threadId]/messages",
      "POST /api/flow/intent",
      "POST /api/flow/start",
      "POST /api/flow/answer",
      "POST /api/translator/instruct"
    ]
  },
  "ThreadsDrawer": {
    "props": ["projectId?"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useQuery"],
    "calls_routes": ["SELECT chat_threads via Supabase client"]
  },
  "VersionCanvas": {
    "props": [],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useNodes", "useJourney"],
    "calls_routes": [
      "GET /api/versions/nodes",
      "PATCH /api/versions/positions",
      "POST /api/compares"
    ]
  },
  "PlanBuilderOverviewSheet": {
    "props": ["threadId", "open", "onOpenChange"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": [
      "useQueryClient",
      "useNodes",
      "useVerifyTranslation",
      "useBackTranslate"
    ],
    "calls_routes": [
      "GET /api/flow/peek",
      "POST /api/flow/confirm",
      "POST /api/translator/preview"
    ]
  },
  "NodeCard": {
    "props": ["node", "threadId", "onAccepted?"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useQueryClient"],
    "calls_routes": ["POST /api/translator/accept-lines"]
  },
  "LineCitationDrawer": {
    "props": ["open", "onOpenChange", "node", "threadId"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": ["useNodes"],
    "calls_routes": ["UPDATE versions.meta via Supabase client"]
  },
  "JourneyPanel": {
    "props": [],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": [],
    "calls_routes": []
  },
  "FullPoemOverview": {
    "props": ["node"],
    "uses_stores": [],
    "calls_hooks": [],
    "calls_routes": []
  },
  "CompareSheet": {
    "props": ["open", "onOpenChange", "left", "right"],
    "uses_stores": ["useWorkspace"],
    "calls_hooks": [],
    "calls_routes": ["POST /api/versions"]
  }
}
```

### 7) State Update Patterns (LLM)

- Prefer immutable updates: setters replace arrays; avoid in-place mutation.
- Update selection and positions atomically when possible.
- Invalidate React Query caches after server mutations (e.g., `qc.invalidateQueries({ queryKey: ["flow_peek", threadId] })`).
- Use optimistic UI only when server guarantees idempotency or cache is present.
- Derive labels/overview via `/api/versions/nodes` instead of duplicating in store.

### 8) Connecting components

```tsx
// WorkspaceShell seeds store and renders panes
<WorkspaceShell projectId={projectId} threadId={threadId} />

// ChatPanel uses useInterviewFlow + useThreadMessages and writes to store via messages and side-effects
<ChatPanel projectId={projectId} />

// VersionCanvas reads versions/compares from store and calls PATCH /api/versions/positions on drag-stop
<VersionCanvas />
```

### Zustand Stores

| Store             | Path                     | Keys                                                                                                                                                                                                     | Actions                                                                                                                                                                                                                                                                                                                                             | Consumers                                        |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `useWorkspace`    | `src/store/workspace.ts` | `projectId`, `threadId`, `workspaceName`, `selectedNodeId`, `compareOpen`, `ui.{currentView,targetLang,targetStyle,includeDialectOptions,currentLine}`, `tokensSelections`, `workshopDraft.notebookText` | `setSelectedNodeId`, `setProjectId`, `setWorkspaceMeta`, `setThreadId`, `setCompareOpen`, `setHighlightVersionId`, `setVersionPos`, `setVersions`, `setCompares`, `setCurrentView`, `setTargetLang`, `setTargetStyle`, `setIncludeDialectOptions`, `setTokenSelection`, `clearSelections`, `setCurrentLine`, `appendNotebook`, `clearNotebookDraft` | `WorkspaceV2Shell`, `MainWorkspace`, `TokenCard` |
| `useUiLangStore`  | `src/state/uiLang.ts`    | `uiLang`                                                                                                                                                                                                 | `setUiLang`                                                                                                                                                                                                                                                                                                                                         | `AuthNav`, `Providers`                           |
| `useUploadsStore` | `src/state/uploads.ts`   | `byThread`                                                                                                                                                                                               | `hydrate`, `add`, `upsert`, `removeByName`, `setStatus`, `clearThread`, `list`, `getKey`                                                                                                                                                                                                                                                            | `UploadsTray`, `UploadListItem`, `ChatPanel`     |

### TanStack Query Hooks

| Hook                      | Path                             | Query Key                                          | Options                                                                                                                       | Consumers                                                |
| ------------------------- | -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `useNodes`                | `src/hooks/useNodes.ts`          | `["nodes", projectId, threadId]`                   | `enabled: !!projectId && !!threadId`; `staleTime: 0`; `refetchOnWindowFocus: true`; `refetchInterval: enabled ? 1500 : false` | `VersionCanvas`, `PlanBuilderOverviewSheet`, `ChatPanel` |
| `useJourney`              | `src/hooks/useJourney.ts`        | `["journey", projectId, limit]`                    | `enabled: !!projectId`; throws on non-200                                                                                     | `JourneyPanel`, `VersionCanvas`                          |
| `useThreadMessages`       | `src/hooks/useThreadMessages.ts` | `["chat_messages", projectId, threadId]`           | `enabled: !!projectId && !!threadId`; ordered ascending                                                                       | `ChatPanel`                                              |
| `useInterviewFlow().peek` | `src/hooks/useInterviewFlow.ts`  | `["flow_peek", threadId]`                          | `enabled: !!threadId`; invalidated on `start/answer/confirm` success                                                          | `ChatPanel`, `PlanBuilderOverviewSheet`                  |
| `useUploadsList`          | `src/hooks/uploadsQuery.ts`      | `["uploads", threadId??"root"]`                    | `staleTime: 60000`; `retry: 3`; backoff `[300,1200,3000]`; hydrates store on success                                          | `UploadsTray`                                            |
| `useUploadMutation`       | `src/hooks/uploadsQuery.ts`      | `mutationKey: ["upload", threadId??"root"]`        | `retry: 3`; backoff; `onSuccess` invalidates uploads                                                                          | `ChatPanel`                                              |
| `useDeleteUploadMutation` | `src/hooks/uploadsQuery.ts`      | `mutationKey: ["delete-upload", threadId??"root"]` | `retry: 3`; optimistic `onMutate`/revert; invalidate uploads on success                                                       | `UploadsTray`                                            |
| `useVerifyTranslation`    | `src/hooks/useVerifier.ts`       | — (mutation)                                       | JSON POST `/api/translator/verify`                                                                                            | `PlanBuilderOverviewSheet`                               |
| `useBackTranslate`        | `src/hooks/useVerifier.ts`       | — (mutation)                                       | JSON POST `/api/translator/backtranslate`                                                                                     | `PlanBuilderOverviewSheet`                               |

Visibility Gating:

- `useNodes` polling should pause when not in Workshop (V2). If not wired: TODO to gate via `opts.enabled` using `useWorkspace((s)=>s.ui.currentView==="workshop")`.
