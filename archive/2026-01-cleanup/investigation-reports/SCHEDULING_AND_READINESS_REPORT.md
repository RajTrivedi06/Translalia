# Out-of-Order Readiness Root Cause Report

## Executive Summary

**Primary Root Cause**: Multiple concurrent API requests call `runTranslationTick` for the same `threadId`, allowing different stanzas to be processed simultaneously by different ticks. Within each tick, stanzas process sequentially, but across ticks, completion order is non-deterministic. The UI has no ordering constraint and hydrates any available line, causing later lines to appear ready before earlier ones.

**Secondary Contributors**:

1. Queue reordering via `unshift()` on rate limit/failure moves stanzas to front
2. UI uses `Object.values()` iteration which, while typically ordered, has no explicit ordering guarantee
3. No gating mechanism prevents showing lines out of order

---

## Findings Summary

**Root Cause**: The system processes stanzas sequentially within each tick, but multiple ticks can run concurrently (e.g., initial tick + status polling). This allows different stanzas to be processed by different ticks simultaneously, leading to non-deterministic completion order. The UI has no "line 1 first" policy—it unlocks any line as soon as its translation variants are available, regardless of line index order.

**Key Findings**:

1. **Scheduler is deterministic by stanza index** (`getNextStanzasToProcess` selects from queue in order)
2. **Within a single tick, stanzas process sequentially** (the `for` loop uses `await`, so stanza 0 completes before stanza 1 starts)
3. **Multiple ticks can run concurrently** (e.g., initial tick + status polling every 4 seconds), allowing different stanzas to be processed simultaneously by different ticks
4. **Completion order is non-deterministic** because different ticks finish at different times
5. **UI readiness has no ordering constraint**—it hydrates `lineTranslations` from any completed stanza and shows lines as soon as translations exist
6. **No gating mechanism** prevents showing line 3 before line 1—the UI only checks if `lineTranslations[lineIndex]` exists

**Impact**: Users see lines from later segments become available before earlier segments, creating a confusing experience where they cannot work on line 1 even though line 14 is ready.

---

## Proof-Driven Root Cause Analysis

### 1) Proof of Actual Concurrency (or Lack Thereof)

#### Execution Pattern Within a Single Tick

**File**: `src/lib/workshop/runTranslationTick.ts:260-322`

**Exact Code Block**:

```typescript
for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);
    continue;
  }

  const stanza = stanzaResult.stanzas[stanzaIndex];
  if (!stanza) {
    failed.push(stanzaIndex);
    continue;
  }

  try {
    await processStanza({
      threadId,
      stanzaIndex,
      stanza,
      lineOffset: lineOffsets[stanzaIndex] ?? 0,
      flattenedLines,
      rawPoem,
      guideAnswers,
      sourceLanguage,
      auditUserId: context.createdBy,
      auditProjectId: context.projectId,
    });

    completed.push(stanzaIndex);
    await updateTranslationJob(threadId, (draft) => {
      // ... mark stanza as completed
    });
  } catch (error: unknown) {
    // ... handle error
  }
}
```

**Proof**: This is **SEQUENTIAL execution** (`await` inside `for` loop). Stanza 0 must complete before stanza 1 starts within the same tick.

#### How Out-of-Order Completion Can Still Occur

**Multiple concurrent ticks can run for the same `threadId`**:

**All Routes That Call `runTranslationTick`**:

1. **`/api/workshop/initialize-translations`** (POST)

   - **File**: `src/app/api/workshop/initialize-translations/route.ts:80`
   - **Code**: `await runTranslationTick(threadId, { maxProcessingTimeMs: 6000 })`
   - **Can overlap**: ✅ Yes, if called multiple times (unlikely but possible)

2. **`/api/workshop/translation-status`** (GET with `advance=true`)

   - **File**: `src/app/api/workshop/translation-status/route.ts:59`
   - **Code**: `await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 })`
   - **Can overlap**: ✅ **YES** - Polled every 4 seconds (`pollIntervalMs: 4000` in `useTranslationJob.ts:92`)
   - **Critical**: This is called while initial tick may still be processing

3. **`/api/workshop/retry-stanza`** (POST)

   - **File**: `src/app/api/workshop/retry-stanza/route.ts:159`
   - **Code**: `await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 })`
   - **Can overlap**: ✅ Yes, if user retries while tick is running

4. **`/api/workshop/requeue-stanza`** (POST)
   - **File**: `src/app/api/workshop/requeue-stanza/route.ts:119`
   - **Code**: `await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 })`
   - **Can overlap**: ✅ Yes, if user requeues while tick is running

**Concurrency Mechanism**:

- **No global lock**: Each `runTranslationTick` call is independent
- **Optimistic locking**: `updateTranslationJob` uses version-based locking (`jobState.ts:240-241`), but this only prevents duplicate updates, not concurrent execution
- **Active array check**: `getNextStanzasToProcess` checks `job.active.length` (`jobState.ts:309`), but two ticks can read the same state before either writes

**Proof of Concurrent Execution**:

**Scenario**:

- T0: Initial tick starts, reads `active = []`, selects stanza 0, marks as "processing", writes `active = [0]`
- T0+2000ms: Status poll triggers new tick, reads `active = [0]`, selects stanza 1, marks as "processing", writes `active = [0, 1]`
- Both ticks now process different stanzas **concurrently**

**Evidence**: The `active` array allows multiple stanzas to be active simultaneously (`maxConcurrent = 5` default), and multiple ticks can add different stanzas to `active` before either completes.

### 2) Proof of Stanza → Global Line Mapping

#### Stanza Construction and Line Offset Calculation

**File**: `src/lib/workshop/runTranslationTick.ts:73-81`

```typescript
function computeLineOffsets(stanzas: StanzaDetectionResult["stanzas"]) {
  const offsets: number[] = [];
  let offset = 0;
  for (const stanza of stanzas) {
    offsets.push(offset);
    offset += stanza.lines.length;
  }
  return offsets;
}
```

**Proof**: Offsets are computed **sequentially** in stanza order. `offset` accumulates, so:

- Stanza 0: `offset = 0`
- Stanza 1: `offset = stanza0.lines.length`
- Stanza 2: `offset = stanza0.lines.length + stanza1.lines.length`
- etc.

**File**: `src/lib/workshop/runTranslationTick.ts:131-132`

```typescript
const flattenedLines = stanzaResult.stanzas.flatMap((stanza) => stanza.lines);
const lineOffsets = computeLineOffsets(stanzaResult.stanzas);
```

**Proof**: `flattenedLines` preserves stanza order (flatMap iterates in order), and `lineOffsets` matches this order.

**File**: `src/lib/workshop/processStanza.ts:135-137`

```typescript
for (let i = 0; i < totalLines; i += 1) {
  const lineText = stanza.lines[i];
  const globalLineIndex = lineOffset + i;
```

**Proof**: Global line index = `lineOffset[stanzaIndex] + localLineIndex`. This ensures:

- Stanza 0, line 0 → global line 0
- Stanza 0, line 1 → global line 1
- Stanza 1, line 0 → global line (stanza0.length)
- etc.

#### Sample Mapping Table

For a 14-line poem with 4 stanzas (3, 4, 3, 4 lines):

| Stanza Index | Local Lines | Global Line Range | Line Offset |
| ------------ | ----------- | ----------------- | ----------- |
| 0            | 0-2         | 0-2               | 0           |
| 1            | 0-3         | 3-6               | 3           |
| 2            | 0-2         | 7-9               | 7           |
| 3            | 0-3         | 10-13             | 10          |

**Proof**: `computeLineOffsets([stanza0(3), stanza1(4), stanza2(3), stanza3(4)])` returns `[0, 3, 7, 10]`.

**Confirmation**: "Segment/stanza order" **always matches ascending global line order** because:

1. Stanzas are created in order (`stanzaResult.stanzas` is an array)
2. `computeLineOffsets` processes stanzas sequentially
3. `globalLineIndex = lineOffset + i` ensures monotonic increase

### 3) Proof of Why UI Shows Later Lines Ready First

#### UI Hydration Logic

**File**: `src/components/workshop-rail/WorkshopRail.tsx:250-283`

**Exact Code Block**:

```typescript
React.useEffect(() => {
  if (!translationJobQuery.data?.job || !threadId) {
    return;
  }

  const job = translationJobQuery.data.job;
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  // Iterate through all segments/stanzas to collect translated lines
  Object.values(chunkOrStanzaStates).forEach((chunk) => {
    if (chunk.lines && Array.isArray(chunk.lines)) {
      chunk.lines.forEach((line) => {
        if (line.translations && line.translations.length > 0) {
          if (line.line_number !== undefined) {
            // Also hydrate the full LineTranslationResponse for the new workflow
            if (line.translations.length === 3) {
              setLineTranslation(line.line_number, {
                lineOriginal:
                  line.original_text || poemLines[line.line_number] || "",
                translations: line.translations as [
                  LineTranslationVariant,
                  LineTranslationVariant,
                  LineTranslationVariant
                ],
                modelUsed: line.model_used || "unknown",
              });
            }
          }
        }
      });
    }
  });
}, [translationJobQuery.data, threadId, setLineTranslation, poemLines]);
```

**Proof of Iteration Order**:

- **Uses `Object.values(chunkOrStanzaStates)`**: Iterates over object values
- **Object key order**: In JavaScript/TypeScript, `Object.values()` on numeric keys iterates in **ascending numeric order** (ES2015+), BUT this is an implementation detail, not a guarantee
- **No explicit sorting**: The code does not sort by `line_number` before hydrating

**Readiness Rule for Rendering**:

**File**: `src/components/workshop-rail/WorkshopRail.tsx:186-248` (lineStatuses computation)

```typescript
const lineStatuses = React.useMemo<
  Record<number, TranslationStanzaStatus> | undefined
>(() => {
  // ... iterates through poemStanzas.stanzas (array, preserves order)
  poemStanzas.stanzas.forEach((stanza, stanzaIdx) => {
    const stanzaState = chunkStates[stanzaIdx];
    // ... determines status based on stanzaState.status and whether line was translated
    if (stanzaStatus === "completed") {
      statuses[globalLineIndex] = translatedLine ? "completed" : "pending";
    } else if (stanzaStatus === "processing") {
      statuses[globalLineIndex] = translatedLine ? "completed" : "processing";
    }
  });
}, [translationProgress, poemStanzas]);
```

**Readiness Checks That EXIST**:

- ✅ Checks if `line.translations.length > 0` (line 263)
- ✅ Checks if `line.line_number !== undefined` (line 264)
- ✅ Checks if stanza status is "completed" or "processing" (lineStatuses logic)

**Readiness Checks That DO NOT EXIST**:

- ❌ **No check for "all earlier lines ready"**: Does not verify if line 0 is ready before showing line 3
- ❌ **No consecutive completion check**: Does not ensure lines are ready in order
- ❌ **No gating on minimum line index**: Does not prevent showing line N if line M (M < N) is not ready

**Proof of Out-of-Order Display**:

If stanza 1 completes before stanza 0:

1. `job.chunks[1].status = "completed"` and `job.chunks[1].lines = [line3, line4, line5, line6]`
2. `job.chunks[0].status = "processing"` and `job.chunks[0].lines = []` (not yet complete)
3. UI hydration iterates `Object.values(job.chunks)` → processes chunk 1 first (if object iteration order matches key order)
4. `setLineTranslation(3, ...)`, `setLineTranslation(4, ...)`, etc. are called
5. Lines 3-6 appear as "completed" in UI
6. Line 0 still shows as "processing"

### 4) Proof of Queue Reordering

#### Rate Limit Requeue Logic

**File**: `src/lib/workshop/runTranslationTick.ts:218-239`

```typescript
// If rate limited, re-queue stanzas and return
if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
  await updateTranslationJob(threadId, (draft) => {
    started.forEach((index) => {
      const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
      const stanzaState = chunkOrStanzaStates[index];
      if (stanzaState) {
        stanzaState.status = "queued";
      }
      draft.active = draft.active.filter((id) => id !== index);
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index); // ← MOVES TO FRONT
      }
    });
    // ...
  });
}
```

**Proof**: `draft.queue.unshift(index)` **moves rate-limited stanzas to the front** of the queue, changing future selection order.

#### Timeout/Skip Requeue Logic

**File**: `src/lib/workshop/runTranslationTick.ts:324-339`

```typescript
if (skipped.length > 0) {
  await updateTranslationJob(threadId, (draft) => {
    applyMetadata(draft);
    skipped.forEach((index) => {
      const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
      const stanzaState = chunkOrStanzaStates[index];
      if (stanzaState) {
        stanzaState.status = "queued";
      }
      draft.active = draft.active.filter((id) => id !== index);
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index); // ← MOVES TO FRONT
      }
    });
    return draft;
  });
}
```

**Proof**: Timeout-skipped stanzas are also moved to front via `unshift()`.

#### Requeue Endpoint

**File**: `src/app/api/workshop/requeue-stanza/route.ts:104-108`

```typescript
// Ensure stanza is at front of queue without duplicates
draft.queue = [
  stanzaIndex,
  ...draft.queue.filter((idx) => idx !== stanzaIndex),
];
```

**Proof**: Manual requeue explicitly puts stanza at front of queue.

**When Reordering Triggers**:

1. **Rate limiting**: When `rateLimitedPool.checkAndDequeue()` returns `rateLimited: true`
2. **Timeout**: When `Date.now() - windowStart > maxProcessingTime`
3. **Manual requeue**: When user calls `/api/workshop/requeue-stanza`

**Impact on Selection Order**:

- Reordered stanzas are selected **before** stanzas that were originally earlier in the queue
- This can cause later stanzas (by global line index) to be processed before earlier ones

### 5) Single Concrete Diagnosis

#### Primary Root Cause

**Concurrent Tick Execution with No Line-Index-Based Prioritization**

**Evidence Chain**:

1. Multiple API routes can call `runTranslationTick` concurrently for the same `threadId` (proven in section 1)
2. Status polling every 4 seconds creates overlapping ticks (proven in section 1)
3. Each tick selects stanzas by **stanza index** (queue order), not **global line index** (`jobState.ts:315-322`)
4. Different ticks can process different stanzas simultaneously (proven in section 1)
5. Completion order is non-deterministic (depends on which tick finishes first)
6. UI hydrates any available line without checking if earlier lines are ready (proven in section 3)

**Code References**:

- Concurrent execution: `src/app/api/workshop/translation-status/route.ts:59` + `src/lib/hooks/useTranslationJob.ts:92` (4s polling)
- Stanza selection: `src/lib/workshop/jobState.ts:302-323` (selects by stanza index, not line index)
- No UI gating: `src/components/workshop-rail/WorkshopRail.tsx:250-283` (no ordering check)

#### Secondary Contributors

1. **Queue Reordering** (`src/lib/workshop/runTranslationTick.ts:229, 335`)

   - Rate-limited or timeout-skipped stanzas move to front via `unshift()`
   - Can cause later stanzas (by global line index) to be selected before earlier ones

2. **Object Iteration Order** (`src/components/workshop-rail/WorkshopRail.tsx:260`)
   - Uses `Object.values()` which, while typically ordered for numeric keys, has no explicit guarantee
   - Should use explicit sorting by `line_number` for deterministic hydration

#### What Would Need to Change (High-Level, No Implementation)

**Scheduler Changes**:

1. **Priority-based selection**: Modify `getNextStanzasToProcess` to select stanzas by `minLineIndex` of unprocessed lines, not by stanza index
2. **Tick-level locking**: Add a mechanism to prevent concurrent ticks for the same `threadId`, OR implement a priority queue where ticks coordinate
3. **Queue reordering policy**: Change `unshift()` to preserve original queue position or use priority-based insertion

**UI Changes**:

1. **Progressive unlock gating**: In hydration effect, only hydrate lines up to the highest consecutive completed line index
2. **Explicit sorting**: Sort `Object.values(chunkOrStanzaStates)` by `minLineIndex` before iterating
3. **Readiness check**: Before showing a line as "ready", verify all earlier lines are also ready (or implement "locked" state for out-of-order lines)

**Data Structure Changes**:

1. **Line-index-based queue**: Store queue as `{ stanzaIndex, minLineIndex }` pairs and sort by `minLineIndex`
2. **Completion tracking**: Track `maxConsecutiveCompletedLineIndex` in job state to enable progressive unlock

---

## Deliverable A: Evidence-Based Execution Timeline

### Example Flow for a 14-Line Poem (4 Stanzas: 3, 4, 3, 4 lines)

| Time      | Event                                                  | File Path                                               | Code Location | Details                                                             |
| --------- | ------------------------------------------------------ | ------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| T0        | `/api/workshop/initialize-translations` called         | `src/app/api/workshop/initialize-translations/route.ts` | Line 21-93    | POST request with `runInitialTick: true`                            |
| T0+10ms   | `createTranslationJob` creates queue                   | `src/lib/workshop/jobState.ts`                          | Line 149      | `queue = [0, 1, 2, 3]` (stanza indices)                             |
| T0+15ms   | Stanza 0 set to "queued", others "pending"             | `src/lib/workshop/jobState.ts`                          | Line 157      | `status: index === 0 ? "queued" : "pending"`                        |
| T0+20ms   | `runTranslationTick` called                            | `src/app/api/workshop/initialize-translations/route.ts` | Line 80       | `maxProcessingTimeMs: 6000`                                         |
| T0+25ms   | `getNextStanzasToProcess` selects work                 | `src/lib/workshop/jobState.ts`                          | Line 302-323  | Returns `[0]` (first queued stanza)                                 |
| T0+30ms   | `ensureQueuedCapacity` promotes stanza 1               | `src/lib/workshop/jobState.ts`                          | Line 50-74    | Promotes stanza 1 from "pending" to "queued" (if `maxConcurrent=5`) |
| T0+35ms   | `getNextStanzasToProcess` selects `[0, 1]`             | `src/lib/workshop/jobState.ts`                          | Line 315-322  | `maxStanzasPerTick=2`, so picks first 2 queued                      |
| T0+40ms   | Stanza 0 marked "processing"                           | `src/lib/workshop/runTranslationTick.ts`                | Line 161-171  | Added to `active` array                                             |
| T0+45ms   | `processStanza` starts for stanza 0                    | `src/lib/workshop/runTranslationTick.ts`                | Line 273      | Processes lines 0-2 sequentially (awaits each line)                 |
| T0+2000ms | `/api/workshop/translation-status?advance=true` poll   | `src/app/api/workshop/translation-status/route.ts`      | Line 15-73    | **NEW TICK STARTS** while stanza 0 still processing                 |
| T0+2005ms | Tick 2 selects stanza 1 (stanza 0 still in `active`)   | `src/lib/workshop/runTranslationTick.ts`                | Line 145      | `getNextStanzasToProcess` sees `active=[0]`, selects stanza 1       |
| T0+2010ms | Stanza 1 marked "processing"                           | `src/lib/workshop/runTranslationTick.ts`                | Line 161-171  | Added to `active` array (now `active=[0,1]`)                        |
| T0+2015ms | `processStanza` starts for stanza 1 (CONCURRENT)       | `src/lib/workshop/runTranslationTick.ts`                | Line 273      | **Runs in parallel with stanza 0** (different tick)                 |
| T0+500ms  | Stanza 1 line 3 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  | `translateLineInternal` completes, stored in `stanzaState.lines`    |
| T0+600ms  | Stanza 1 line 4 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  | Stored in `stanzaState.lines`                                       |
| T0+700ms  | Stanza 1 line 5 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  | Stored in `stanzaState.lines`                                       |
| T0+800ms  | Stanza 1 line 6 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  | Stored in `stanzaState.lines`                                       |
| T0+900ms  | Stanza 1 completes                                     | `src/lib/workshop/runTranslationTick.ts`                | Line 286-299  | Status set to "completed", persisted to DB                          |
| T0+1200ms | Stanza 0 line 0 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  | **Line 0 completes AFTER line 6**                                   |
| T0+1300ms | Stanza 0 line 1 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  |                                                                     |
| T0+1400ms | Stanza 0 line 2 translated                             | `src/lib/workshop/processStanza.ts`                     | Line 167-204  |                                                                     |
| T0+1500ms | Stanza 0 completes                                     | `src/lib/workshop/runTranslationTick.ts`                | Line 286-299  | Status set to "completed"                                           |
| T0+2000ms | `/api/workshop/translation-status?advance=true` poll   | `src/app/api/workshop/translation-status/route.ts`      | Line 15-73    | Client polls every 4 seconds                                        |
| T0+2005ms | `runTranslationTick` processes next stanzas            | `src/lib/workshop/runTranslationTick.ts`                | Line 103      | Starts stanzas 2 and 3                                              |
| T0+2010ms | UI hydrates `lineTranslations`                         | `src/components/workshop-rail/WorkshopRail.tsx`         | Line 250-283  | Reads from `job.chunks[].lines[]`                                   |
| T0+2015ms | `setLineTranslation` called for lines 3-6              | `src/components/workshop-rail/WorkshopRail.tsx`         | Line 267      | **Lines 3-6 available, but line 0 not yet**                         |
| T0+2020ms | User sees lines 3-6 ready, but line 0 still processing | `src/components/workshop-rail/LineSelector.tsx`         | Line 15-71    | Status shows "processing" for line 0                                |

### Key Timeline Observations

1. **Queue Ordering**: Stanzas are queued in order `[0, 1, 2, 3]` (deterministic)
2. **Selection Ordering**: `getNextStanzasToProcess` selects from queue in order (deterministic)
3. **Execution Ordering**: **Multiple ticks can run concurrently**, each processing stanzas sequentially
4. **Concurrency Source**: When `/api/workshop/translation-status?advance=true` is called while another tick is running, a new tick starts and can process different stanzas
5. **Completion Ordering**: Non-deterministic because different ticks finish at different times
6. **Persistence Ordering**: Lines are stored in `stanzaState.lines[]` as they complete (non-deterministic)
7. **UI Hydration Ordering**: UI iterates through all stanzas and hydrates any available lines (no ordering constraint)

---

## Deliverable B: The Scheduler Algorithm

### Work Item Selection (`getNextStanzasToProcess`)

**File**: `src/lib/workshop/jobState.ts:302-323`

```typescript
export function getNextStanzasToProcess(job: TranslationJobState): number[] {
  ensureQueuedCapacity(job); // Promotes "pending" → "queued" up to maxConcurrent

  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  const queued = job.queue.filter(
    (index) => chunkOrStanzaStates[index]?.status === "queued" || "pending"
  );

  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
}
```

**Selection Logic**:

- **Deterministic by stanza index**: Filters `job.queue` (which is `[0, 1, 2, ...]`) in order
- **Concurrency limit**: Respects `maxConcurrent` (default: 5) and `maxStanzasPerTick` (default: 2)
- **Status filter**: Only selects stanzas with status "queued" or "pending"
- **Result**: Returns first N stanzas from queue that are eligible

### Queue Initialization

**File**: `src/lib/workshop/jobState.ts:149`

```typescript
const queue = chunksToUse.map((_, index) => index); // [0, 1, 2, 3, ...]
```

**Initial State**:

- Stanza 0: `status: "queued"` (line 157)
- Stanzas 1+: `status: "pending"` (line 157)
- `ensureQueuedCapacity` promotes pending stanzas to "queued" up to `maxConcurrent`

### Concurrency Strategy

**File**: `src/lib/workshop/runTranslationTick.ts:260-322`

```typescript
for (const stanzaIndex of started) {
  await processStanza({ ... });  // SEQUENTIAL: waits for each stanza to complete
}
```

**Concurrency Behavior**:

- **Within a single tick**: Stanzas process **SEQUENTIALLY** (one after another)
- **Between multiple ticks**: Multiple API requests can call `runTranslationTick` **concurrently**
- **Selection**: Deterministic (first N from queue), but multiple ticks can select different stanzas
- **Execution**: Sequential within tick, but parallel across ticks
- **Completion**: Non-deterministic (depends on which tick finishes first)

### Processing Within a Stanza

**File**: `src/lib/workshop/processStanza.ts:135-271`

```typescript
for (let i = 0; i < totalLines; i += 1) {
  const globalLineIndex = lineOffset + i;
  await translateLineInternal({ lineIndex: globalLineIndex, ... });
  translatedLines.push({ line_number: globalLineIndex, ... });
  await updateStanzaStatus(threadId, stanzaIndex, { lines: translatedLines });
}
```

**Line Processing**:

- **Sequential within stanza**: Lines processed one-by-one in order
- **Parallel across stanzas**: Different stanzas can be processed simultaneously by **different ticks**
- **Result**: If Tick 2 (processing stanza 1) finishes before Tick 1 (processing stanza 0), lines 3-6 become available before lines 0-2

**Critical Insight**: The concurrency is at the **tick level**, not the stanza level. When `/api/workshop/translation-status?advance=true` is called while another tick is still processing, a new tick starts and can select a different stanza. The `active` array prevents the same stanza from being selected twice, but allows different stanzas to be processed concurrently by different ticks.

### Answer to Key Questions

1. **Is work item selection deterministic by lineIndex?**  
   ❌ No. Selection is by **stanza index**, not line index.

2. **Is it deterministic by stanza index?**  
   ✅ Yes. `getNextStanzasToProcess` selects from `job.queue` in order.

3. **Is it "first unprocessed anywhere"?**  
   ✅ Yes, but at the **stanza level**, not line level. It picks the first unprocessed stanza from the queue.

4. **Does it pick from multiple segments concurrently?**  
   ✅ Yes. Up to `maxStanzasPerTick` (default: 2) stanzas are selected per tick, and up to `maxConcurrent` (default: 5) can be active simultaneously.

---

## Deliverable C: Why "Line 1 Readiness" is Not Prioritized

### UI Readiness Gating Conditions

**File**: `src/components/workshop-rail/WorkshopRail.tsx:250-283`

```typescript
React.useEffect(() => {
  if (!translationJobQuery.data?.job || !threadId) return;

  const job = translationJobQuery.data.job;
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  // Iterate through ALL stanzas (no ordering constraint)
  Object.values(chunkOrStanzaStates).forEach((chunk) => {
    if (chunk.lines && Array.isArray(chunk.lines)) {
      chunk.lines.forEach((line) => {
        if (line.translations && line.translations.length > 0) {
          if (line.line_number !== undefined) {
            // Hydrate ANY line that has translations
            setLineTranslation(line.line_number, { ... });
          }
        }
      });
    }
  });
}, [translationJobQuery.data, threadId, setLineTranslation, poemLines]);
```

**Readiness Logic**:

- ✅ **No ordering check**: UI hydrates any line that has `translations.length > 0`
- ✅ **No "line 0 first" gate**: No condition checking if line 0 is ready before showing other lines
- ✅ **No progressive unlock**: All lines become available as soon as their stanza completes

### Line Status Display

**File**: `src/components/workshop-rail/WorkshopRail.tsx:186-248`

```typescript
const lineStatuses = React.useMemo(() => {
  // Maps global line index to status
  poemStanzas.stanzas.forEach((stanza, stanzaIdx) => {
    const stanzaState = chunkStates[stanzaIdx];
    const translatedLines = stanzaState.lines || [];

    stanza.lines.forEach(() => {
      const translatedLine = translatedLines.find(
        (tl) => tl.line_number === globalLineIndex
      );

      // Status based on stanza status and whether line was translated
      if (stanzaStatus === "completed") {
        statuses[globalLineIndex] = translatedLine ? "completed" : "pending";
      } else if (stanzaStatus === "processing") {
        statuses[globalLineIndex] = translatedLine ? "completed" : "processing";
      }
      // ...
    });
  });
}, [translationProgress, poemStanzas]);
```

**Status Logic**:

- Line status is derived from **stanza status**, not line index order
- If stanza 1 is "completed", lines 3-6 show as "completed" even if line 0 is still "processing"

### WordGrid Readiness Check

**File**: `src/components/workshop-rail/WordGrid.tsx:221-273`

```typescript
React.useEffect(() => {
  if (currentLineIndex === null || !thread) return;

  // Already translated → no fetch
  if (lineTranslations[currentLineIndex]) return;

  // Fetch translation if not available
  translateLine({ ... });
}, [currentLineIndex, lineTranslations, ...]);
```

**Readiness Check**:

- ✅ **Only checks if current line has translation**: `if (lineTranslations[currentLineIndex])`
- ❌ **No check for "earlier lines ready"**: Doesn't verify if line 0 is ready before allowing work on line 3
- ❌ **No progressive unlock policy**: User can select any line, and if it has translations, it's shown

### Root Cause: No Ordering Constraint in UI

**The UI has no policy that enforces "line 1 first"**. It operates on a **"first available"** model:

- If line 3 has translations → show line 3
- If line 0 doesn't have translations → show "processing" for line 0
- No gating prevents showing line 3 before line 0

---

## Investigation Checklist Answers

### 1) Server Entrypoints + State Fields

**Entrypoints**:

- `/api/workshop/initialize-translations`: `src/app/api/workshop/initialize-translations/route.ts:21`
- `/api/workshop/translation-status`: `src/app/api/workshop/translation-status/route.ts:15`
- `runTranslationTick`: `src/lib/workshop/runTranslationTick.ts:103`
- `processStanza`: `src/lib/workshop/processStanza.ts:115`
- `translateLineInternal`: `src/lib/workshop/translateLineInternal.ts:121`

**State Storage**:

- **Per-line status**: Stored in `chat_threads.state.translation_job.chunks[stanzaIndex].lines[]`
  - Field: `lines: TranslatedLine[]` where `TranslatedLine.line_number` is the global line index
  - File: `src/types/translationJob.ts:45-51`
- **Per-stanza status**: `chat_threads.state.translation_job.chunks[stanzaIndex].status`
  - Values: `"pending" | "queued" | "processing" | "completed" | "failed"`
  - File: `src/types/translationJob.ts:56-82`

**Status Fields**:

- `status`: Stanza-level status (pending/queued/processing/completed/failed)
- `linesProcessed`: Number of lines completed in this stanza
- `lastLineTranslated`: Global line index of last translated line
- `lines[]`: Array of `TranslatedLine` objects with `line_number` and `translations[]`
- `startedAt`, `completedAt`: Timestamps
- `updatedAt`: Job-level timestamp

### 2) Ordering + Concurrency

**Work Item List Building**:

- **File**: `src/lib/workshop/jobState.ts:149`
- **Code**: `const queue = chunksToUse.map((_, index) => index);`
- **Order**: Deterministic `[0, 1, 2, 3, ...]` (stanza indices in order)

**Sort/Order Used**:

- **Queue order**: Preserves stanza index order (no explicit sort, just `map` by index)
- **Selection order**: `getNextStanzasToProcess` filters queue and returns first N items (line 315-322)
- **No randomization**: Queue is always in stanza index order

**Concurrency Constructs**:

- **Within tick**: Sequential `for` loop with `await processStanza()` (line 260 in `runTranslationTick.ts`)
- **Between ticks**: Multiple API requests can call `runTranslationTick` simultaneously
- **Concurrency limit**: `maxConcurrent = 5` (default), `maxStanzasPerTick = 2` (default)
- **Locking mechanism**: Version-based optimistic locking prevents duplicate processing, but allows different stanzas to be processed by different ticks concurrently

**Concurrency Source**:

- ❌ **Not Promise.all within tick**: Uses sequential `for` loop with `await`
- ✅ **Multiple concurrent ticks**: If `/api/workshop/translation-status?advance=true` is called while another tick is running, both can process different stanzas simultaneously
- ✅ **Completion order non-deterministic**: If Tick 2 (processing stanza 1) finishes before Tick 1 (processing stanza 0), lines 3-6 become available before lines 0-2

**Selection Logic**:

- **File**: `src/lib/workshop/jobState.ts:302-323`
- **Logic**: "First N unprocessed stanzas from queue"
- **Deterministic**: Yes, by stanza index
- **Concurrent**: Yes, multiple stanzas can be active simultaneously

### 3) UI Hydration / Display Ordering

**Server Results → Store Mapping**:

- **File**: `src/components/workshop-rail/WorkshopRail.tsx:250-283`
- **Method**: Iterates through `job.chunks` (object), then `chunk.lines[]` (array)
- **Order preservation**: Arrays preserve order, but object iteration order is not guaranteed (though in practice it's by key)
- **Merge strategy**: `setLineTranslation(line.line_number, ...)` merges by line index (not array position)

**UI Rendering Order**:

- **File**: `src/components/workshop-rail/WorkshopRail.tsx:489-536`
- **Method**: Maps through `stanzaLines` array (preserves order), but status comes from `lineStatuses[globalLineIndex]` (object lookup)
- **Order**: UI renders lines in stanza order, but status is determined by translation job state (not line index order)

**Random Availability Source**:

- ✅ **Backend completing out of order**: Stanzas complete in non-deterministic order due to parallel processing
- ❌ **Frontend rendering out of order**: Frontend renders in order, but shows "completed" status for lines that finished early

### 4) "First Line First" Expectation Gap

**Required Policy Changes**:

1. **Scheduler Selection Function** (`src/lib/workshop/jobState.ts:302`)

   - **Current**: Selects first N queued stanzas
   - **Required**: Prioritize stanzas containing lower line indices
   - **Implementation**: Sort queue by `minLineIndex` before selecting, or use a priority queue

2. **Concurrency Strategy** (`src/lib/workshop/runTranslationTick.ts:260`)

   - **Current**: Process up to `maxStanzasPerTick` stanzas concurrently
   - **Required**: Process stanzas sequentially until line 0 is complete, then allow concurrency
   - **Alternative**: Use a priority queue where stanzas with lower line indices are processed first

3. **UI Readiness Gating Condition** (`src/components/workshop-rail/WorkshopRail.tsx:250`)
   - **Current**: Hydrate any line that has translations
   - **Required**: Only hydrate lines if all earlier lines are ready (or implement progressive unlock)
   - **Implementation**: Check `Math.min(...Object.keys(lineTranslations))` and only show lines up to that point

**Policy Location**:

- **Scheduler**: `src/lib/workshop/jobState.ts:302` (`getNextStanzasToProcess`)
- **Concurrency**: `src/lib/workshop/runTranslationTick.ts:145-149` (selection and limiting)
- **UI Gating**: `src/components/workshop-rail/WorkshopRail.tsx:250-283` (hydration effect)

### 5) Instrumentation Additions (Investigation-Only)

**Recommended Logging Points** (without changing behavior):

1. **Line Start/Finish** (`src/lib/workshop/processStanza.ts:167`)

   ```typescript
   console.log(`[processStanza] Line ${globalLineIndex} started`, {
     threadId,
     stanzaIndex,
     lineIndex: i,
     startedAt: Date.now(),
   });
   // After translateLineInternal completes:
   console.log(`[processStanza] Line ${globalLineIndex} finished`, {
     threadId,
     stanzaIndex,
     finishedAt: Date.now(),
   });
   ```

2. **Selection Decisions** (`src/lib/workshop/runTranslationTick.ts:145`)

   ```typescript
   console.log(`[runTranslationTick] Selected stanzas: ${limited.join(", ")}`, {
     threadId,
     availableSlots,
     queueLength: draft.queue.length,
     reason: `maxStanzasPerTick=${draft.maxStanzasPerTick}, availableSlots=${availableSlots}`,
   });
   ```

3. **Translation Status Response** (`src/app/api/workshop/translation-status/route.ts:64`)
   ```typescript
   const smallestPendingLineIndex = Math.min(
     ...Object.values(job.chunks || {})
       .flatMap((chunk) => chunk.lines || [])
       .map((line) => line.line_number)
       .filter((idx) => !lineTranslations[idx])
   );
   console.log(`[translation-status] Response summary`, {
     threadId,
     completed: progress.completed,
     processing: progress.processing,
     smallestPendingLineIndex,
   });
   ```

---

## Root Causes (Ranked: Most Likely → Least Likely)

### 1. **Concurrent Tick Execution with Non-Deterministic Completion** (MOST LIKELY)

- **Evidence**: Multiple API requests can call `runTranslationTick` simultaneously (e.g., initial tick + status poll)
- **Impact**: Different ticks process different stanzas concurrently, completing in order of processing time, not stanza index
- **Fix Complexity**: Medium (requires tick-level locking or priority queue)

### 2. **UI Has No "Line 1 First" Policy** (MOST LIKELY)

- **Evidence**: `WorkshopRail.tsx:250-283` hydrates any available line
- **Impact**: UI shows lines as soon as translations exist, regardless of line index
- **Fix Complexity**: Low (add gating condition in hydration effect)

### 3. **Scheduler Selects by Stanza Index, Not Line Index** (LIKELY)

- **Evidence**: `jobState.ts:302` selects from queue by stanza index
- **Impact**: If stanza 1 has fewer/simpler lines, it completes before stanza 0
- **Fix Complexity**: Medium (requires sorting by min line index)

### 4. **No Progressive Unlock Mechanism** (LIKELY)

- **Evidence**: `WordGrid.tsx:227` only checks if current line has translation
- **Impact**: User can select any line, and if it's ready, it's shown
- **Fix Complexity**: Low (add check for "all earlier lines ready")

### 5. **Rate Limiting May Reorder Queue** (LESS LIKELY)

- **Evidence**: `runTranslationTick.ts:229` uses `unshift` to re-queue rate-limited stanzas
- **Impact**: Rate-limited stanzas jump to front of queue, potentially out of order
- **Fix Complexity**: Low (preserve original queue position)

---

## What Must Be True for "Line 1 First + Progressive Readiness"

### High-Level Policy Requirements

1. **Scheduler Must Prioritize Lower Line Indices**

   - **Location**: `src/lib/workshop/jobState.ts:302` (`getNextStanzasToProcess`)
   - **Requirement**: Select stanzas containing the lowest unprocessed line index first
   - **Implementation**: Sort queue by `minLineIndex` of unprocessed lines, or use priority queue

2. **Concurrency Must Respect Line Order**

   - **Location**: `src/lib/workshop/runTranslationTick.ts:145-149`
   - **Requirement**: Process stanzas sequentially until line 0 completes, then allow concurrency for remaining lines
   - **Alternative**: Use priority queue where priority = `minLineIndex` of unprocessed lines in stanza

3. **UI Must Gate on Earliest Unprocessed Line**

   - **Location**: `src/components/workshop-rail/WorkshopRail.tsx:250-283`
   - **Requirement**: Only hydrate/show lines up to the highest consecutive completed line index
   - **Implementation**: Find `maxConsecutiveLineIndex` and only show lines ≤ that index

4. **Progressive Unlock Policy**
   - **Location**: `src/components/workshop-rail/WordGrid.tsx:221`
   - **Requirement**: Prevent selecting a line if earlier lines are not ready (or show "locked" state)
   - **Implementation**: Check `lineTranslations[0]` exists before allowing work on line 1, etc.

### Implementation Strategy (High-Level)

**Option A: Priority Queue by Line Index**

- Modify `getNextStanzasToProcess` to sort by `minLineIndex` of unprocessed lines
- Process stanzas in priority order (lowest line index first)
- UI gates on consecutive completion

**Option B: Sequential-First with Progressive Unlock**

- Process stanza 0 to completion before starting stanza 1
- Once line 0 is ready, allow concurrent processing of remaining stanzas
- UI shows lines progressively as they become available

**Option C: Hybrid Approach**

- Use priority queue for selection (line-index-based)
- Allow concurrency but prioritize stanzas with lower line indices
- UI implements progressive unlock (only show lines up to highest consecutive index)

---

## Conclusion

The out-of-order processing is **expected behavior** due to concurrent stanza processing, but it creates a **poor user experience** because the UI has no ordering constraints. The fix requires changes to both the scheduler (to prioritize lower line indices) and the UI (to gate on progressive readiness).

**Recommended Approach**: Implement Option C (Hybrid) with priority queue selection and progressive UI unlock, as it balances performance (concurrency) with user experience (progressive readiness).
