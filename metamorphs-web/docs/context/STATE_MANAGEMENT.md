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

### Server-State vs Client-State

- Fetch server data in route handlers or server components where possible
- Hydrate client with minimal initial state; rely on hooks for live updates

### Patterns

- Keep derived state in selectors/memos instead of duplicating sources
- Use URL params and `app/(app)/workspace/*` routes to reflect navigation state
- Co-locate feature state near UI that consumes it

### Side Effects

- Network calls centralized in hooks or `server/*` modules
- Debounce/throttle chat inputs where appropriate

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
  versions: Version[];
  compares: CompareNode[];
  journey: JourneyItem[];
  activeVersionId?: string;
  highlightVersionId?: string;
  activeCompare?: { leftId: string; rightId: string };
  compareOpen: boolean;
  setProjectId(id?: string): void;
  setThreadId(id?: string): void;
  setVersions(vs: Version[]): void;
  setJourney(js: JourneyItem[]): void;
  setCompares(cs: CompareNode[]): void;
  setActiveVersionId(id?: string): void;
  setHighlightVersionId(id?: string): void;
  setActiveCompare(p?: { leftId: string; rightId: string }): void;
  setCompareOpen(open: boolean): void;
  addVersion(v: Version): void;
  addCompare(c: CompareNode): void;
  pinJourney(j: JourneyItem): void;
  setVersionPos(id: string, pos: { x: number; y: number }): void;
  tidyPositions(): void;
};
```

### 3) Actions/reducers/stores

- See `store/workspace.ts` for action list and defaults
- Server session actions: `server/threadState.ts` (`getThreadState`, `patchThreadState`, `appendLedger`)

### 4) Local vs global state decisions

- Local: input fields, dialog open/close, selection state
- Global: active project/thread, versions/compares/journey, compare drawer

### 5) Data persistence approach

- UI data fetched on demand via Supabase (browser) and stored in Zustand
- Conversation/flow state persisted per-thread as JSON in DB via server routes

### 6) Real-time subscriptions

- Auth state: `useSupabaseUser` subscribes to Supabase `onAuthStateChange`
- No DB realtime listeners are currently implemented; React Query refetches as needed
