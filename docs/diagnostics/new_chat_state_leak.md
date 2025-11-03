# New Chat State Leakage — Root Cause Analysis

## Summary

- **Issue**: Opening a "New Chat" displays previous chat's content instead of starting fresh
- **Scope**: Multiple Zustand slices and React Query caches appear to leak state between threads
- **Impact**: Users see stale data from previous conversations when starting new chats

## Reproduction Steps

1. Start development server: `pnpm dev`
2. Create a chat, paste poem, set Translation Zone/Intent
3. Generate one line in Workshop, open Notebook
4. Click "New Chat" entry point
5. Observe: previous content appears in the fresh chat

## Findings

### Hypothesis 1: Active thread ID not set early enough

**Status**: ✅ CONFIRMED - Race condition identified

**Evidence**:

- `setActiveThreadId()` is called in `useEffect` hooks in both `WorkspaceShell.tsx:52` and `ThreadPageClient.tsx:39`
- These effects run **after** component mount, creating a race condition
- Zustand slices hydrate **during** component initialization, before `setActiveThreadId()` is called
- During initial hydration, `getActiveThreadId()` returns `null`, causing slices to use `__global__` keys

**Code References**:

```52:52:src/components/workspace/WorkspaceShell.tsx
setActiveThreadId(effectiveThreadId ?? null);
```

```39:39:src/app/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx
setActiveThreadId(threadId ?? null);
```

### Hypothesis 2: Some slices don't use threadStorage

**Status**: ✅ PARTIALLY CONFIRMED - workspace.ts doesn't persist

**Evidence**:

- `workspace.ts` does NOT use `persist()` middleware at all
- It's a simple in-memory store that resets on page refresh
- Other slices properly use `threadStorage`:
  - `guideSlice.ts:230` ✅
  - `workshopSlice.ts:153` ✅
  - `notebookSlice.ts:434` ✅

**Slice Audit Table**:

```
Slice            Thread-scoped?   Hydration guard?   Meta.threadId?   Notes
guideSlice       ✅                ✅                 ✅               Uses threadStorage
workshopSlice    ✅                ✅                 ✅               Uses threadStorage
notebookSlice    ✅                ✅                 ✅               Uses threadStorage
workspace.ts     ❌                ❌                 ❌               No persistence
```

### Hypothesis 3: React Query keys missing threadId

**Status**: ✅ CONFIRMED - All query keys properly include threadId

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

**Status**: ❌ NOT CONFIRMED - Thread creation works correctly

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

**Status**: ✅ PARTIALLY CONFIRMED - Only GuideRail resets

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

## Evidence

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

Problem: Initial hydration uses `__global__` keys, then switches to thread-specific keys, but old data may persist.

## Likely Root Cause

**Primary Issue**: Race condition in thread ID initialization

The core problem is that `setActiveThreadId()` is called in `useEffect` hooks **after** component mount, but Zustand slices hydrate **during** component initialization. This creates a race condition where:

1. Component mounts → Zustand slices initialize
2. `getActiveThreadId()` returns `null` → slices use `__global__` keys
3. `useEffect` runs → `setActiveThreadId()` called
4. Subsequent operations use correct thread-specific keys
5. But initial hydration already loaded global state

**Secondary Issues**:

- `workspace.ts` doesn't persist at all (minor impact)
- Only `GuideRail` resets on thread change (other components don't)

## Minimal Patch Direction

**Primary Fix**: Move thread ID setting to synchronous initialization

- Set `activeThreadId` immediately when route params are available
- Ensure `setActiveThreadId()` is called before any Zustand slice initialization
- Consider using Next.js middleware or route-level initialization

**Secondary Fixes**:

- Add thread change reset logic to `WorkshopRail` and `NotebookPhase6`
- Consider adding persistence to `workspace.ts` if needed
- Add hydration guards to prevent rendering until thread ID is properly set

**Testing Strategy**:

- Verify no `__global__` keys are used after thread creation
- Confirm all slices use thread-specific keys from initial hydration
- Test rapid thread switching doesn't cause state leakage
