### [Last Updated: 2025-09-16]

## Current Issues

<!-- TODO: Link to relevant helper in UTILITIES_HELPERS.md -->
<!-- TODO: Link to relevant overview in CODEBASE_OVERVIEW.md -->

### Issue Card 1: Preview echo persists first-pass output

- Title: Preview may persist first-pass echo instead of retry result
- Symptoms: Preview nodes sometimes show echoed lines even though server retry should replace them.
- Scope: Translator Preview route; echo detection helper; DB meta persistence.
- Evidence (≥2 anchors from different layers):
  ```298:306:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  if (!forceTranslate && (echoish || untranslated)) {
    const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language (English if requested).\nDo NOT echo or quote SOURCE_POEM lines or reproduce Urdu/Arabic script.`;
    const respRetryUnknown: unknown = await responsesCall({ /* ... */ });
  }
  ```
  ```59:75:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/text/similarity.ts
  export function looksLikeEcho(source: string[], output: string[]): boolean {
    // ... lineRatio & character-level similarity
    return lineRatio >= 0.5 || charSimilarity >= 0.8;
  }
  ```
  ```438:447:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  const updatedMeta: Record<string, unknown> = {
    ...placeholderMeta,
    status: "generated" as const,
    overview: { lines: preview.lines, notes: preview.notes, line_policy: bundle.line_policy },
  };
  ```
- Suspected cause: `preview` object not re-bound to the retried output in all branches before `cacheSet`/persist; early persistence path may use first-pass data.
- Candidate fix: After retry success, always assign `preview = { lines, notes, ... }` from retried parse before persistence; add an explicit boolean `wasRetried` used in persistence path.
- Risk: Minor; potential behavior change if previous lines intentionally preserved.
- Owner?: Translator area
- Status: open
- Observability hooks:
  - Count metrics: `preview.echo_detected`, `preview.retry_success`, `preview.retry_failed`.
  - Attach `prompt_hash` and echo flags to logs (already redacted) for correlation.
  - Emit a debug event when persisted overview differs from final preview lines.

### Issue Card 2: 403 on /nodes with stale threadId

- Title: 403 FORBIDDEN_OR_NOT_FOUND when rapidly switching threads
- Symptoms: Canvas shows 403 until manual refresh or next poll.
- Scope: `useNodes` hook; `versions/nodes` API guard; thread switch behavior.
- Evidence (≥2 anchors from different layers):
  ```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
  return useQuery({ queryKey: ["nodes", projectId, threadId], queryFn: () => fetchNodes(threadId!), enabled: !!projectId && !!threadId, refetchInterval: 1500 });
  ```
  ```21:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
  const { data: th, error: thErr } = await sb.from("chat_threads").select("id, project_id").eq("id", threadId).single();
  if (thErr || !th) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403 });
  ```
- Suspected cause: Access token propagation and `threadId` change are out of sync; polling during handoff hits server before auth or thread context stabilizes.
- Candidate fix: Pause `useNodes` polling on thread change; re-enable after `useWorkspace().setThreadId`. Add `retryDelay` jitter and handle 403 with short backoff.
- Risk: Slight delay in node updates; potential UI lag if backoff too high.
- Owner?: Workspace
- Status: open
- Observability hooks:
  - Client metric: `nodes.fetch_403_count` with threadId labels; measure time from thread switch to first 200.
  - Server log sample on 403 including cookie/bearer presence (no tokens), and `threadId`.

### Issue Card 3: Version A overview not visible until reopen

- Title: Overview sometimes missing on first open after Accept & Generate
- Symptoms: Drawer closes, but overview lines are not visible until reopening or after another poll.
- Scope: Plan Builder drawer; nodes polling/invalidation; preview meta persistence.
- Evidence (≥2 anchors from different layers):
  ```221:251:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx
  // loop waits for nodes to include generated status + overview lines; invalidates queries every 250ms
  ```
  ```104:113:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  const updatedMeta: Record<string, unknown> = {
    ...placeholderMeta,
    status: "generated" as const,
    overview: { lines: preview.lines, notes: preview.notes, line_policy: bundle.line_policy },
  };
  ```
  ```120:137:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
  const overviewLines: string[] = Array.isArray(api.overview?.lines) ? (api.overview!.lines as string[]) : [];
  // rendered in node card; shows "No overview yet" otherwise
  ```
- Suspected cause: Race between DB meta update commit and the next nodes fetch; first render may occur before overview is persisted/readable.
- Candidate fix: Delay drawer close until nodes contains non-empty `overview.lines`; optionally add optimistic state to UI.
- Risk: Slightly longer drawer display; potential false waits if overview remains empty legitimately.
- Owner?: Translator UX
- Status: open
- Observability hooks:
  - Measure time from preview response to first nodes payload with non-empty overview.
  - Log cases where the loop exceeds threshold (e.g., 8s) with threadId/versionId.

### JSON patch skeleton (LLM consumption)

```json
{
  "op": "add",
  "path": "/issues/-",
  "value": {
    "title": "string",
    "symptoms": "string",
    "scope": ["module", "route", "component"],
    "anchors": [
      { "ref": "start:end:/abs/path/to/file", "note": "why relevant" },
      { "ref": "start:end:/abs/path/to/other", "note": "another layer" }
    ],
    "suspected_cause": "string",
    "candidate_fix": "string",
    "risk": "low|medium|high",
    "owner": "string|null",
    "status": "open|triaged|in_progress|fixed",
    "observability_hooks": ["metric_name", "log/event outline"]
  }
}
```
