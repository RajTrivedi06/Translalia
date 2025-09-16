### [Last Updated: 2025-09-16]

## Current Issues

### A) Preview may persist first-pass echo instead of retry result

- Symptoms: Occasionally, preview nodes show echoed lines even when the server retries with stricter instructions.
- Evidence:

```360:369:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
await cacheSet(key, preview, 3600);
// Update node meta with overview + flip status
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: preview.lines,
    notes: preview.notes,
  },
};
```

```345:353:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
return NextResponse.json(
  {
    ok: false,
    code: "PREVIEW_ECHOED_SOURCE",
    error: "Model echoed/left source language after retry.",
  },
  { status: 409 }
);
```

- Suspected Cause: The cache key is computed before retry, and the first-pass `preview` object may be used for persistence if retry succeeds but code paths diverge, or logs suggest we persist `preview` without re-binding after retry in some branches.
- Suggested Fix (doc-only): After a successful retry, ensure `preview` is the retried output before `cacheSet` and persistence; add explicit test asserting echoed-first-pass does not persist when retry succeeds.

### B) 403 on /nodes with stale threadId

- Symptoms: Canvas occasionally shows 403 FORBIDDEN_OR_NOT_FOUND after thread switch until a manual refresh.
- Evidence:

```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
return useQuery({
  queryKey: ["nodes", projectId, threadId],
  queryFn: () => fetchNodes(threadId!),
  enabled: !!projectId && !!threadId,
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: 1500,
});
```

```21:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
const { data: th, error: thErr } = await sb
  .from("chat_threads")
  .select("id, project_id")
  .eq("id", threadId)
  .single();
if (thErr || !th) {
  return NextResponse.json(
    { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
    { status: 403 }
  );
}
```

- Suspected Cause: Client-side access token and `threadId` switching are slightly out of sync during rapid thread changes; the server guard checks the thread before the token-bearing request is established.
- Suggested Fix (doc-only): On thread change, briefly pause polling and invalidate queries after `useWorkspace().setThreadId`; debounce re-enable; optionally add `retryDelay` jitter in `useNodes` and handle 403 by refetching with a small backoff.

### C) Version A overview sometimes not visible until reopen

- Symptoms: After Accept & Generate Version A, the drawer closes but the overview may not be visible on first open.
- Evidence (drawer close after detecting generated node; polling loop):

```221:251:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx
// Wait for thread-scoped nodes to include the new version before closing
const start = Date.now();
let found = false;
while (Date.now() - start < 8000) {
  const q = qc.getQueryData<NodeRow[]>(["nodes", projectId, threadId]);
  const list = Array.isArray(q) ? q : [];
  if (
    list.find(
      (n) =>
        n.id === payload.versionId &&
        n.status === "generated" &&
        Array.isArray(n.overview?.lines) &&
        (n.overview?.lines?.length ?? 0) > 0
    )
  ) {
    found = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 250));
  await qc.invalidateQueries({ queryKey: ["nodes", projectId, threadId] });
}
if (found && payload?.versionId && threadId) {
  onOpenChange(false);
}
```

- Evidence (preview persists overview into `meta.overview`):

```438:447:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: preview.lines,
    notes: preview.notes,
    line_policy: bundle.line_policy,
  },
};
```

- Status: open
- Suspected Cause: race between nodes query invalidation and meta update persistence. The loop mitigates but may miss first render.
- Suggestion: consider optimistic UI or event-driven update; increase wait or show a loading state before closing.
