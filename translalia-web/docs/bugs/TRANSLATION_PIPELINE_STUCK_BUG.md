# Translation Pipeline Stuck Bug Analysis

## Issue Summary
Jobs get stuck in "processing" state with only partial lines translated. The UI shows continuous polling but no progress is made. **Specifically, the LAST line often gets stuck in "processing".**

---

## 1. FINDINGS (Confirmed Failure Modes)

### Finding 0: **PRIMARY (NEW)** - Last Line Stuck Due to Premature Interrupt Flag
**File:** `src/lib/workshop/processStanza.ts:458-477`

```typescript
// When interrupted flag is set, processStanza returns early WITHOUT checking if all lines completed
if (interrupted) {
  // ... logs ...
  await updateStanzaStatus(threadId, stanzaIndex, { status: "processing" });
  return { interrupted: true, linesCompleted, linesTotal };  // ← RETURNS EARLY
}
```

**Problem:** The `interrupted` flag is set when ANY line sees `budget.shouldStop() === true` BEFORE starting. But with parallel processing, the last line might already be IN-FLIGHT and complete successfully. The code returns early as "interrupted" even when all lines are actually done.

**Scenario:**
1. Lines 0, 1, 2 (last) start in parallel
2. Lines 0, 1 complete quickly
3. Line 2 is still processing when budget expires
4. No more lines to start, so `interrupted` stays `false` from the budget check
5. BUT if line 2 completes AFTER budget expires (in-flight work), it finishes successfully
6. If the next line would have triggered the budget check but there IS no next line, `interrupted` stays `false`

**Actual issue discovered:** When a stanza is marked "interrupted" and returned to runTranslationTick:
1. runTranslationTick handles interrupted chunks at lines 942-961
2. It marks them as "processing" and removes from active
3. **It NEVER checks if all lines actually completed in the DB**
4. Next tick: reconciliation re-adds to active, processStanza re-runs
5. But if all lines were already done, the cycle repeats forever

**FIX APPLIED:**
- In `processStanza`: When `interrupted === true`, check DB to see if ALL lines are actually translated. If yes, clear the flag and proceed to normal completion.
- In `runTranslationTick`: When handling "interrupted" chunks, check if all lines are done and mark as "completed" instead.

---

### Finding 1: SECONDARY - Chunk Never Transitions to "completed" from processStanza (Original Finding)
**File:** `src/lib/workshop/processStanza.ts:542-543`

```typescript
// Line 542-543 - processStanza NEVER sets status to "completed"
await updateStanzaStatus(threadId, stanzaIndex, {
  status: permanentFailures.length > 0 ? "failed" : "processing",  // ← Always "processing" on success!
});
```

**Problem:** `processStanza` relies entirely on the caller (`runTranslationTick` at lines 731-788) to mark the chunk as "completed". If that update fails or is skipped, the chunk remains "processing" forever.

**Evidence:** The completion logic in `runTranslationTick.ts:748-755` only runs if the chunk processing promise resolves successfully AND the subsequent `updateTranslationJob` call succeeds.

---

### Finding 2: SECONDARY - Incomplete Work Detection is Too Narrow
**File:** `src/lib/workshop/jobState.ts:748-752`

```typescript
const hasActiveWorkFromChunks = Object.values(chunkOrStanzaStates).some(
  (stanza) =>
    stanza.status === "processing" &&  // ← Only checks "processing", misses "queued" and "pending"
    stanza.linesProcessed < stanza.totalLines
);
```

**Problem:** A chunk with `status === "queued"` or `status === "pending"` but `linesProcessed < totalLines` is not detected as having active work. If `queue = []` and `active = []` (due to array drift), the job could be incorrectly marked "completed".

---

### Finding 3: SECONDARY - Reconciliation Uses linesProcessed, Can Miss Edge Cases
**File:** `src/lib/workshop/runTranslationTick.ts:201-208`

```typescript
const isIncomplete =
  chunk.status !== "completed" &&
  chunk.status !== "failed" &&
  chunk.linesProcessed < chunk.totalLines;  // ← What if linesProcessed === totalLines but status is still "processing"?
```

**Problem:** A chunk can have `linesProcessed === totalLines` (all lines in array) but `status !== "completed"` if the status update in `runTranslationTick:751-752` was skipped or failed. This chunk would be considered "complete" by reconciliation but job wouldn't be marked "completed" because chunk.status !== "completed".

**Stuck state:** `queue = []`, `active = []`, all chunks have `linesProcessed === totalLines`, but some have `status === "processing"`. Job stays "processing" indefinitely.

---

### Finding 4: TERTIARY - Silent Persistence Failures in updateSingleLine
**File:** `src/lib/workshop/processStanza.ts:376-378`

```typescript
await updateSingleLine(threadId, stanzaIndex, lineData);  // ← If this throws, line is lost
linesCompletedThisTick++;
```

**Problem:** `updateSingleLine` can fail due to concurrent modification (after max retries in `mutateTranslationJob`). The error propagates to `Promise.allSettled`, marking the line as failed, but:
1. The translation itself succeeded
2. The line data is lost (not persisted)
3. The error is classified as "unknown" (retryable), causing full stanza re-translation

This is wasteful but recoverable. However, combined with time-slicing interruption, it can cause repeated failures.

---

## 2. PRIMARY ROOT CAUSE + SECONDARY CAUSES

### Primary Root Cause
**Chunk status "completed" transition only happens in runTranslationTick, not processStanza.**

When `processStanza` finishes successfully, it sets status to "processing" (not "completed"). The actual "completed" transition happens in `runTranslationTick.ts:748-752`:

```typescript
if (allLinesTranslated && allLinesPresent && lines.length > 0) {
  stanzaState.status = "completed";
  // ...
}
```

If this `updateTranslationJob` call fails (concurrent modification, network error, timeout), the chunk remains "processing" with all lines translated but never marked complete.

### Secondary Causes

1. **Reconciliation gap:** Chunks with `linesProcessed === totalLines` but `status === "processing"` are not re-processed (considered "complete" by `isIncomplete` check).

2. **hasActiveWork check misses queued/pending:** Only checks `status === "processing"`, so a job can be marked "completed" while chunks are still queued.

3. **No watchdog for stuck chunks:** There's no timeout-based recovery for chunks stuck in "processing" state.

---

## 3. MINIMAL PATCH PLAN

### Patch 1: Fix isIncomplete Check in reconcileJobState
**File:** `src/lib/workshop/runTranslationTick.ts`

```diff
  // Track incomplete chunks
- const isIncomplete =
-   chunk.status !== "completed" &&
-   chunk.status !== "failed" &&
-   chunk.linesProcessed < chunk.totalLines;
+ const isIncomplete =
+   chunk.status !== "completed" &&
+   chunk.status !== "failed";
+ // Note: Even if linesProcessed === totalLines, if status isn't "completed",
+ // we need to re-process to trigger the completion logic
```

**Rationale:** A chunk should be considered incomplete if its status isn't terminal ("completed" or "failed"), regardless of linesProcessed count.

---

### Patch 2: Fix hasActiveWorkFromChunks Check in markJobCompletedIfDone
**File:** `src/lib/workshop/jobState.ts`

```diff
  const hasActiveWorkFromChunks = Object.values(chunkOrStanzaStates).some(
    (stanza) =>
-     stanza.status === "processing" &&
-     stanza.linesProcessed < stanza.totalLines
+     stanza.status !== "completed" && stanza.status !== "failed"
  );
```

**Rationale:** Any non-terminal chunk means the job has active work, regardless of `linesProcessed`.

---

### Patch 3: Add Chunk Completion Fallback in processStanza
**File:** `src/lib/workshop/processStanza.ts`

```diff
  // After line 541 (existing updateStanzaStatus call)

+ // ✅ FIX: If all lines translated, explicitly mark chunk as completed
+ // This is a safety net in case runTranslationTick's completion update fails
+ const jobAfterProcessing = await getTranslationJob(threadId);
+ const chunkAfter = (jobAfterProcessing?.chunks || jobAfterProcessing?.stanzas || {})[stanzaIndex];
+ if (chunkAfter) {
+   const allLinesTranslated = (chunkAfter.lines || []).every(
+     (l) => l.translationStatus === "translated"
+   );
+   const allLinesPresent = (chunkAfter.lines || []).length === chunkAfter.totalLines;
+
+   if (allLinesTranslated && allLinesPresent && chunkAfter.status !== "completed") {
+     console.log(
+       `[processStanza] Safety completion: marking chunk ${stanzaIndex} as completed ` +
+       `(lines: ${chunkAfter.lines?.length}/${chunkAfter.totalLines})`
+     );
+     await updateStanzaStatus(threadId, stanzaIndex, {
+       status: "completed",
+       completedAt: Date.now(),
+       error: undefined,
+     });
+   }
+ }
```

**Rationale:** Defense in depth — if the caller's completion update fails, `processStanza` marks the chunk complete itself.

---

### Patch 4: Add Watchdog for Stuck Chunks
**File:** `src/lib/workshop/runTranslationTick.ts` (add after reconcileJobState)

```typescript
// ✅ WATCHDOG: Detect and fix chunks stuck in "processing" with all lines done
const STUCK_CHUNK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function fixStuckChunks(draft: TranslationJobState): boolean {
  let fixed = false;
  const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
  const now = Date.now();

  Object.entries(chunkOrStanzaStates).forEach(([idxStr, chunk]) => {
    const idx = parseInt(idxStr, 10);
    const lines = chunk.lines || [];
    const allLinesTranslated = lines.every((l) => l.translationStatus === "translated");
    const allLinesPresent = lines.length === chunk.totalLines;
    const isStuckProcessing = chunk.status === "processing" && allLinesTranslated && allLinesPresent;
    const startedAt = chunk.startedAt || 0;
    const isOld = now - startedAt > STUCK_CHUNK_THRESHOLD_MS;

    if (isStuckProcessing) {
      console.warn(
        `[fixStuckChunks] Chunk ${idx} stuck in "processing" with all lines done ` +
        `(lines: ${lines.length}/${chunk.totalLines}, age: ${Math.round((now - startedAt) / 1000)}s)`
      );

      // Fix: Mark as completed
      chunk.status = "completed";
      chunk.completedAt = now;
      chunk.error = undefined;
      fixed = true;
    }

    // Also fix chunks with old "processing" status and no progress
    if (chunk.status === "processing" && isOld && !allLinesPresent) {
      console.warn(
        `[fixStuckChunks] Chunk ${idx} processing timeout ` +
        `(lines: ${lines.length}/${chunk.totalLines}, age: ${Math.round((now - startedAt) / 1000)}s) - requeueing`
      );
      chunk.status = "queued";
      if (!draft.queue.includes(idx)) {
        draft.queue.push(idx);
      }
      draft.active = draft.active.filter((i) => i !== idx);
      fixed = true;
    }
  });

  return fixed;
}
```

**Usage:** Call `fixStuckChunks(draft)` inside the reconciliation updater, after `reconcileJobState(draft)`.

---

## 4. REGRESSION TEST / REPRO HARNESS

### Test 1: Chunk Completion After All Lines Translated
```typescript
// test/workshop/chunkCompletion.test.ts
describe("Chunk completion", () => {
  it("should mark chunk completed when all lines are translated", async () => {
    // Setup: Create job with 1 chunk, 3 lines
    const job = await createTranslationJob({
      threadId: testThreadId,
      chunks: [{ lines: ["Line 1", "Line 2", "Line 3"] }],
      poem: "Line 1\nLine 2\nLine 3",
    });

    // Add all lines as translated
    for (let i = 0; i < 3; i++) {
      await updateSingleLine(testThreadId, 0, {
        line_number: i,
        original_text: `Line ${i + 1}`,
        translations: [{ text: `Translated ${i + 1}`, variant: "A" }],
        translationStatus: "translated",
        alignmentStatus: "skipped",
      });
    }

    // Run tick
    await runTranslationTick(testThreadId);

    // Verify chunk is completed
    const finalJob = await getTranslationJob(testThreadId);
    expect(finalJob?.chunks?.[0]?.status).toBe("completed");
    expect(finalJob?.status).toBe("completed");
  });

  it("should not mark job completed if chunk status is still processing", async () => {
    // Setup: Create job with chunk having all lines but status="processing"
    // (Simulating the bug scenario)
    const job = await createTranslationJob({...});

    // Manually set chunk to have all lines but wrong status
    await updateStanzaStatus(testThreadId, 0, {
      status: "processing",
      lines: [/* all 3 lines with translationStatus="translated" */],
      linesProcessed: 3,
    });

    // Verify job is NOT completed (before fix)
    const jobBefore = await getTranslationJob(testThreadId);
    expect(jobBefore?.status).not.toBe("completed");  // Bug: Would pass before fix

    // Run reconciliation + tick
    await runTranslationTick(testThreadId);

    // Verify chunk is now completed (after fix)
    const jobAfter = await getTranslationJob(testThreadId);
    expect(jobAfter?.chunks?.[0]?.status).toBe("completed");
    expect(jobAfter?.status).toBe("completed");
  });
});
```

### Test 2: Reconciliation Picks Up Stuck Chunks
```typescript
describe("Reconciliation", () => {
  it("should re-queue chunks with linesProcessed === totalLines but status !== completed", async () => {
    // Setup: Create job with artificially stuck chunk
    const job = await createTranslationJob({...});

    // Manually create stuck state
    await updateTranslationJob(testThreadId, (draft) => {
      draft.chunks![0].status = "processing";
      draft.chunks![0].linesProcessed = 3;
      draft.chunks![0].totalLines = 3;
      draft.chunks![0].lines = [/* 3 translated lines */];
      draft.queue = [];  // Empty queue
      draft.active = []; // Empty active
      return draft;
    });

    // Run tick (should trigger reconciliation)
    await runTranslationTick(testThreadId);

    // Verify chunk was picked up and completed
    const finalJob = await getTranslationJob(testThreadId);
    expect(finalJob?.chunks?.[0]?.status).toBe("completed");
  });
});
```

---

## 5. EXTRA OBSERVABILITY

### Log Fields to Add

**In `runTranslationTick.ts` tick summary:**
```typescript
console.log(
  `[runTranslationTick] 📊 TICK SUMMARY: ` +
  `duration=${tickDuration}ms ` +
  `active=[${finalJob.active.join(", ")}] queue=[${finalJob.queue.join(", ")}] ` +
  `completed=${completed.length} failed=${failed.length} ` +
+ `stuckFixed=${stuckFixedCount} ` +           // NEW: Count of chunks fixed by watchdog
+ `reconciled=${reconciledCount} ` +            // NEW: Count of chunks moved by reconciliation
  `interrupted=${interrupted.length}`
);
```

**In `reconcileJobState`:**
```typescript
+ const reconciledChunks = {
+   addedToQueue: [] as number[],
+   addedToActive: [] as number[],
+   reason: "" as string,
+ };

// ... after rebuilding queue/active ...

+ if (queueChanged || activeChanged) {
+   console.log(
+     `[reconcileJobState] RECONCILED: ` +
+     `incompleteChunks=[${incompleteChunkIndices.join(", ")}] ` +
+     `newQueue=[${newQueue.join(", ")}] newActive=[${newActive.join(", ")}] ` +
+     `reason=${reconciledChunks.reason || "drift_correction"}`
+   );
+ }
```

**In `markJobCompletedIfDone`:**
```typescript
if (hasPendingChunks || hasIncompleteLines || hasActiveWork) {
  console.log(
    `[markJobCompletedIfDone] Job NOT complete: ` +
    `hasPendingChunks=${hasPendingChunks} ` +
    `hasIncompleteLines=${hasIncompleteLines} ` +
    `hasActiveWork=${hasActiveWork} ` +
+   `chunkStatuses=${JSON.stringify(Object.entries(chunkOrStanzaStates).map(([i, c]) => `${i}:${c.status}`))}`
  );
}
```

---

## Summary

| Issue | Severity | Fix Complexity | Patch Location |
|-------|----------|----------------|----------------|
| Chunk never marked "completed" in processStanza | HIGH | Low | processStanza.ts |
| isIncomplete check uses linesProcessed | MEDIUM | Low | runTranslationTick.ts |
| hasActiveWork misses queued/pending | MEDIUM | Low | jobState.ts |
| No watchdog for stuck chunks | LOW | Medium | runTranslationTick.ts |

**Recommended Fix Order:**
1. Patch 2 (hasActiveWorkFromChunks) - Prevents premature job completion
2. Patch 1 (isIncomplete) - Ensures stuck chunks are reprocessed
3. Patch 3 (processStanza completion) - Defense in depth
4. Patch 4 (Watchdog) - Handles edge cases
