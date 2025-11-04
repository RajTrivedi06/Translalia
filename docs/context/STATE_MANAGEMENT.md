### [Last Updated: 2025-11-04]

## State Management

### Libraries and patterns

- Global UI/session state: Zustand

```14:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/workspace.ts
export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: undefined,
  threadId: undefined,
  workspaceName: null,
  setProjectId: (id) => set({ projectId: id }),
  setWorkspaceMeta: (id, name) => set({ projectId: id, workspaceName: name }),
  setThreadId: (id) => set({ threadId: id }),
}));
```

- Persisted per-thread UI state: Zustand + `persist` with custom `threadStorage`

```132:141:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: getActiveThreadId() },
      ...initialState,
      setCells: (cells: NotebookCell[]) => set({ cells, meta: { threadId: getActiveThreadId() } }),
    }),
```

```432:463:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
name: "notebook-storage",
version: 1,
storage: createJSONStorage(() => threadStorage),
merge: (persisted, current) => { /* thread-aware merge */ },
onRehydrateStorage: () => (state) => { if (state && !state.hydrated) { state.hydrated = true; } },
partialize: (state) => ({ meta: state.meta, focusedCellIndex: state.focusedCellIndex, view: state.view, filter: state.filter }),
```

- Guide panel persisted per-thread with legacy normalization

```228:293:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/guideSlice.ts
name: "guide-storage",
version: 2,
storage: createJSONStorage(() => threadStorage),
merge: (persisted, current) => { /* normalize legacy and set threadId */ },
partialize: (state) => ({ meta: state.meta, currentStep: state.currentStep, poem: state.poem, translationIntent: state.translationIntent, translationZone: state.translationZone, answers: state.answers }),
```

- Server state: TanStack React Query for fetching, caching, and polling

```19:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/page.tsx
const { data, refetch, isFetching } = useQuery({
  enabled: !!projectId,
  queryKey: ["chat_threads", projectId],
  queryFn: async () => { /* fetch /api/threads/list */ },
});
```

### Global state structure (selected)

- Workspace state: project/thread identity and metadata

```5:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/workspace.ts
type WorkspaceState = {
  projectId?: string;
  threadId?: string;
  workspaceName?: string | null;
  setProjectId: (id?: string) => void;
  setWorkspaceMeta: (id: string, name: string | null) => void;
  setThreadId: (id?: string) => void;
};
```

- Notebook state: cells, view flags, history, drafts

```17:26:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
export interface NotebookState {
  hydrated: boolean;
  meta: { threadId: string | null };
  cells: NotebookCell[];
  focusedCellIndex: number | null;
  view: { showPrismatic: boolean; showLineNumbers: boolean; compareMode: boolean };
  filter: NotebookFilter;
```

### Local component state patterns

- Use local `useState` for UI affordances; lift to stores only when cross-pane
- Memoize derived data and window large lists in V2 views

```28:36:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const stanzas = React.useMemo(() => { /* split */ }, [hasSource, sourceLines]);
```

```54:56:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
const { visible, canLoadMore, loadMore, count, total } = useWindowedList(flatLines, 400);
```

### State persistence strategies

- Thread-scoped localStorage via `threadStorage` ensures per-thread isolation

```28:47:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/threadStorage.ts
export const threadStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    const tid = getActiveThreadId();
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    return window.localStorage.getItem(key);
  },
  setItem: (name: string, value: string): void => { /* namespace by thread */ },
  removeItem: (name: string): void => { /* namespace by thread */ },
};
```

- Guide/Notebook stores use `merge` to discard persisted state when thread changes

```436:450:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
if (p.meta?.threadId && p.meta.threadId !== tid) {
  return { ...current, hydrated: true, meta: { threadId: tid } };
}
return { ...current, ...p, hydrated: true, meta: { threadId: tid } };
```

### Server state management (React Query)

- Thread/project-scoped query keys; polling for nodes; conditional `enabled`

```38:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useNodes.ts
return useQuery({
  queryKey: ["nodes", projectId, threadId],
  queryFn: () => fetchNodes(threadId!),
  enabled,
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: enabled ? 1500 : false,
});
```

### Client ↔ Server synchronization

- Auth and cookies: guard creates SSR client based on cookies or Bearer; UI includes Bearer when available

```35:44:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
const supabase = token
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  : await supabaseServer();
```

- UI hydrates workspace name from Supabase on mount to avoid duplicating state

```47:58:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/page.tsx
const { data, error } = await supabase.from("projects").select("id, title").eq("id", projectId).single();
if (!error && data?.title) {
  const { useWorkspace } = await import("@/store/workspace");
  useWorkspace.getState().setWorkspaceMeta(projectId, data.title as string);
}
```

### Debugging tools and techniques

- Thread-aware storage breadcrumb: persists `last-thread-id` for debugging thread detection

```7:13:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/threadStorage.ts
export function setActiveThreadId(id: string | null) {
  activeThreadId = id ?? null;
  try { if (id) localStorage.setItem("last-thread-id", id); } catch {}
}
```

- Console logs with `requestId` in LLM routes to trace server flows; use these to correlate client actions

```30:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const requestId = crypto.randomUUID();
const started = Date.now();
const log = (...a: any[]) => console.log("[/api/notebook/prismatic]", requestId, ...a);
```

- React Query Devtools: can be added in `Providers` during development (not currently wired)
- Ad-hoc UI: toasts for user‑facing errors and non-throwing error flows in `ChatPanel`

```210:216:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/chat/ChatPanel.tsx
if (!res.ok) {
  const json = await res.json().catch(() => ({}));
  toastError(json?.error || "Failed to send");
  return;
}
```

### Guidance

- Keep global stores minimal and UI-focused; store IDs, not whole rows
- Prefer React Query for server data; invalidate/refetch on mutations
- Persist per-thread UI state via `threadStorage`; avoid cross-thread leakage
- Validate thread ownership on server before heavy reads; update client state optimistically only when safe
