# New Chat State Leakage — Status & RCA (current)

## Summary

- **Status**: Partially fixed (race greatly mitigated; rare stale flashes may remain)
- **Issue**: Historically, opening a new chat could show prior chat state due to a thread ID init race
- **Scope now**: All thread‑scoped slices use `threadStorage` with thread‑aware keys and merge guards; `getActiveThreadId()` now derives threadId from URL before effects, reducing leakage
- **Impact**: Low; intermittent stale UI on first paint in rare navigations

## Reproduction Steps (historical; may not repro consistently now)

1. Start development server: `pnpm dev`
2. Create a chat, paste poem, set Translation Zone/Intent
3. Generate one line in Workshop, open Notebook
4. Click "New Chat" entry point
5. Observe: previous content appears in the fresh chat

## Findings (updated)

### Hypothesis 1: Active thread ID not set early enough

**Status**: 🟡 Mitigated — URL fallback added; effects still set breadcrumb

**Evidence**:

- `setActiveThreadId()` is still called in `useEffect` after mount:

```48:49:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/WorkspaceShell.tsx
React.useEffect(() => {
  setActiveThreadId(effectiveThreadId ?? null);
}, [effectiveThreadId]);
```

```38:40:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx
useEffect(() => {
  setActiveThreadId(threadId ?? null);
}, [threadId]);
```

- However, `getActiveThreadId()` now falls back to parsing the threadId from the URL synchronously before effects run:

```15:25:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/threadStorage.ts
export function getActiveThreadId(): string | null {
  if (activeThreadId) return activeThreadId;
  // Fallback: parse from location (client only)
  if (typeof window !== "undefined") {
    const m = window.location.pathname.match(/\/threads\/([^/]+)/);
    if (m?.[1]) return m[1];
    try { return localStorage.getItem("last-thread-id"); } catch {}
  }
  return null;
}
```

**Code References**:

```52:52:src/components/workspace/WorkspaceShell.tsx
setActiveThreadId(effectiveThreadId ?? null);
```

```39:39:src/app/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx
setActiveThreadId(threadId ?? null);
```

### Hypothesis 2: Some slices don't use threadStorage

**Status**: 🟡 Partially true — `workspace.ts` remains non‑persistent (OK); thread‑scoped slices are guarded

**Evidence**:

- Thread‑scoped slices use `threadStorage` and record `meta.threadId` for merge guards. Example (notebook):

```132:144:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: getActiveThreadId() },
      ...initialState,
      setCells: (cells: NotebookCell[]) => set({ cells, meta: { threadId: getActiveThreadId() } }),
```

```432:449:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
storage: createJSONStorage(() => threadStorage),
merge: (persisted, current) => {
  const tid = getActiveThreadId();
  const p = persisted as NotebookState;
  if (!p || !tid) return { ...current, hydrated: true, meta: { threadId: tid ?? null } };
  if (p.meta?.threadId && p.meta.threadId !== tid) {
    return { ...current, hydrated: true, meta: { threadId: tid } };
  }
  return { ...current, ...p, hydrated: true, meta: { threadId: tid } };
},
```

**Slice Audit Table**:

```
Slice            Thread-scoped?   Hydration guard?   Meta.threadId?   Notes
guideSlice       ✅                ✅                 ✅               Uses threadStorage
workshopSlice    ✅                ✅                 ✅               Uses threadStorage
notebookSlice    ✅                ✅                 ✅               Uses threadStorage
workspace.ts     ❌                ❌                 ❌               No persistence
```

### Hypothesis 3: React Query keys missing threadId

**Status**: ✅ Confirmed good — keys include threadId

**Evidence**:

- All React Query keys properly include `threadId`:
  - `["guide-state", threadId]` ✅
  - `["workshop-state", threadId]` ✅
  - `["notebook-cells", threadId]` ✅
  - `["uploads", threadId ?? "root"]` ✅
  - `["chat_messages", projectId, threadId]` ✅

**Code References**:

```50:50:src/lib/hooks/useGuideFlow.ts
queryKey: ["guide-state", variables.threadId],
```

```58:58:src/lib/hooks/useWorkshopFlow.ts
queryKey: ["workshop-state", variables.threadId],
```

### Hypothesis 4: "New Chat" action doesn't actually create/switch thread

**Status**: ❌ Not an issue — thread creation/switching works

**Evidence**:

- `onNewChat()` properly creates thread via API (`/api/threads` POST)
- Navigation to new thread works: `router.push(routes.projectWithThread(projectId, id))`
- Route structure is correct: `/workspaces/${projectId}/threads/${threadId}`

**Code References**:

```72:93:src/app/(app)/workspaces/[projectId]/page.tsx
async function onNewChat() {
  // ... creates thread via API
  router.push(routes.projectWithThread(projectId, id));
}
```

### Hypothesis 5: Store reset on thread change missing

**Status**: 🟡 Partial — GuideRail resets; other surfaces rely on merge guard

**Evidence**:

- Only `GuideRail.tsx` has thread change reset logic:

```103:120:src/components/guide/GuideRail.tsx
useEffect(() => {
  if (threadId && previousThreadId.current && threadId !== previousThreadId.current) {
    reset();
    workshopReset();
    // ... reset local state
  }
}, [threadId, reset, workshopReset]);
```

- Other components (`WorkshopRail`, `NotebookPhase6`) do NOT reset on thread change
- Zustand slices rely on `threadStorage` key changes, but hydration timing causes issues

## Evidence (what changed vs. original report)

### Console Logs (with debug instrumentation)

_Debug logs added to `threadStorage.ts` - logs will show:_

- Initial hydration using `__global__` keys before thread ID is set
- Subsequent reads using correct thread-specific keys
- Race condition between slice hydration and thread ID setting

### LocalStorage Keys Pattern

Expected keys after proper thread switching:

- `guide-storage:<threadId>` ✅
- `workshop-storage:<threadId>` ✅
- `notebook-storage:<threadId>` ✅
- `last-thread-id` (breadcrumb) ✅

Update: Slices now resolve threadId from URL on first read and ignore persisted payloads with mismatched `meta.threadId`. `__global__` keys should be rare; if present, they are used only when threadId cannot be inferred.

## Likely Root Cause (current)

**Primary Issue**: Race condition in thread ID initialization (mitigated by URL fallback and merge guards)

The core problem is that `setActiveThreadId()` is called in `useEffect` hooks **after** component mount, but Zustand slices hydrate **during** component initialization. This creates a race condition where:

1. Component mounts → Zustand slices initialize
2. `getActiveThreadId()` returns `null` → slices use `__global__` keys
3. `useEffect` runs → `setActiveThreadId()` called
4. Subsequent operations use correct thread-specific keys
5. But initial hydration already loaded global state

**Secondary Observations**:

- `workspace.ts` intentionally non‑persistent (no leak risk)
- Only `GuideRail` explicitly resets on thread change; others rely on per‑thread storage and merge guards

## Detection in production

- Inspect localStorage: absence of `*:__global__` keys during normal navigation
- Add a low‑volume telemetry point when a persisted payload is ignored due to `meta.threadId` mismatch
- Watch for user reports: “new chat shows old content” correlated with fast back/forward navigation

## Workarounds / Mitigations (current)

- URL fallback in `getActiveThreadId()` avoids null thread during early hydration
- Slice `merge` guards ignore persisted state from a different thread
- Breadcrumb `last-thread-id` helps recover on hard reloads

## Steps toward a permanent fix

**Primary Fix**: Initialize threadId before slice hydration

- Set `activeThreadId` from route params at the layout/page boundary before client slices mount (e.g., a tiny client boundary that runs synchronously)
- Consider deferring slice hydration/render until threadId is non‑null (suspense/loading guard)
- Optionally, remove support for `__global__` key entirely and hard‑fail when threadId missing in thread‑scoped pages

**Secondary Fixes**:

- Add thread change reset hooks to `WorkshopRail` and notebook entry to proactively clear transient UI state
- Ensure all thread‑scoped stores include `meta.threadId` and a thread‑mismatch `merge` guard (pattern already present in notebook)

**Testing Strategy**:

- Verify no `__global__` keys appear during normal nav; stale flashes do not occur
- Confirm all slices read threadId from URL on first hydration and ignore mismatched persisted payloads
- Test rapid thread switching/back-forward nav without stale carryover
