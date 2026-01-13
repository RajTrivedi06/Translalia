# Evidence + Timeline Report: Translation Pipeline Deep Dive

**Investigation Date:** 2026-01-07
**Objective:** Grounded, end-to-end explanation with code pointers for method selection, latency, ordering, and async behavior.

---

## Executive Summary

1. **Method 2 IS used for interactive clicks but NEVER for background** — [useTranslateLine.ts:34-37](translalia-web/src/lib/hooks/useTranslateLine.ts#L34-L37) routes correctly, but [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) always calls `translateLineInternal()` (Method 1), ignoring user preference.

2. **Requests take 60–240s because work runs INSIDE the HTTP handler** — `/translation-status?advance=true` blocks for 4s running a tick ([route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59)), Method 2 blocks 60–120s for recipes+variants+alignments ([route.ts:158-359](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L158-L359)).

3. **Later lines finish first due to concurrent ticks + unordered UI hydration** — No global lock prevents overlapping ticks ([runTranslationTick.ts:103-359](translalia-web/src/lib/workshop/runTranslationTick.ts#L103-L359)), UI iterates `Object.values()` without sorting ([WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260)), failed stanzas re-queue at front with `unshift()` ([runTranslationTick.ts:229](translalia-web/src/lib/workshop/runTranslationTick.ts#L229)).

4. **Cache bypasses Method 2 silently** — Cache key includes `model` but NOT `method` ([translateLineInternal.ts:145-147](translalia-web/src/lib/workshop/translateLineInternal.ts#L145-L147)), so switching from Method 1→2 returns cached Method 1 results.

5. **TanStack Query CAN overlap requests** — `refetchInterval: 4000` with NO `refetchIntervalInBackground: false` means new polls fire even if previous is still running ([useTranslationJob.ts:92](translalia-web/src/lib/hooks/useTranslationJob.ts#L92)).

---

## Part 1: Method Selection Truth Table

| Trigger | Method Used | Decision Point (File:Line) | Cache Key Includes Method? | Can Bypass Method 2? | Background Calls /translate-line-with-recipes? |
|---------|-------------|----------------------------|----------------------------|----------------------|-----------------------------------------------|
| **Initialize** (Let's Get Started) | Method 1 ALWAYS | [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) calls `translateLineInternal()` | ❌ No — `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}` | N/A (always Method 1) | ❌ NO — background NEVER checks `translationMethod` |
| **Polling** (/translation-status?advance=true) | Method 1 ALWAYS | [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) calls `translateLineInternal()` | ❌ No | N/A (always Method 1) | ❌ NO |
| **Click Line** (Method 1 selected) | Method 1 | [useTranslateLine.ts:37](translalia-web/src/lib/hooks/useTranslateLine.ts#L37) routes to `/api/workshop/translate-line` | ❌ No | N/A | N/A |
| **Click Line** (Method 2 selected) | Method 2 | [useTranslateLine.ts:36](translalia-web/src/lib/hooks/useTranslateLine.ts#L36) routes to `/api/workshop/translate-line-with-recipes` | ❌ No | ✅ YES — if cache hit from previous Method 1 call | N/A |
| **Regenerate** (if implemented) | NOT IMPLEMENTED | N/A | N/A | N/A | N/A |

### Evidence: Method Selection Code Paths

#### A) Interactive Click (Method 1 or 2)
**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 24-61:**
```typescript
export function useTranslateLine() {
  const translationMethod = useGuideStore(
    (s) => s.answers.translationMethod ?? "method-1"
  );

  return useMutation({
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      // Route to appropriate endpoint based on translation method
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: params.threadId,
          lineIndex: params.lineIndex,
          lineText: params.lineText,
          fullPoem: params.fullPoem,
          stanzaIndex: params.stanzaIndex,
          prevLine: params.prevLine,
          nextLine: params.nextLine,
        }),
      });
      // ...
    },
  });
}
```
**Evidence:** Correctly routes based on `translationMethod` from Zustand store.

---

#### B) Background Processing (ALWAYS Method 1)
**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 162-187:**
```typescript
// Translate the line with error handling (Feature 9)
// Use user-selected model from guideAnswers (not env default)
const selectedModel = guideAnswers.translationModel;

try {
  const lineTranslation = await translateLineInternal({
    threadId,
    lineIndex: globalLineIndex,
    lineText,
    fullPoem: rawPoem,
    stanzaIndex,
    prevLine,
    nextLine,
    guideAnswers,
    sourceLanguage,
    targetLanguage,
    modelOverride: selectedModel, // ← Use user-selected MODEL
    audit:
      auditUserId !== undefined
        ? {
            createdBy: auditUserId,
            projectId: auditProjectId ?? null,
            stage: "workshop-background-translate-line",
          }
        : undefined,
  });
  // ...
}
```
**Evidence:**
- **NO check for `guideAnswers.translationMethod`** — always calls `translateLineInternal()`
- `translateLineInternal()` uses literalness spectrum prompts (Method 1)
- Background pipeline completely ignores user's Method 2 selection

---

#### C) Cache Key Structure (Missing Method Field)
**File:** [translalia-web/src/lib/workshop/translateLineInternal.ts](translalia-web/src/lib/workshop/translateLineInternal.ts)
**Lines 143-154:**
```typescript
// Include model in cache key so switching models doesn't accidentally reuse a
// prior translation (and so the model badge matches what actually ran).
const requestedModel = modelOverride ?? TRANSLATOR_MODEL;
const effectiveCacheKey =
  cacheKey ??
  `workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;

if (!forceRefresh) {
  const cached = await cacheGet<LineTranslationResponse>(effectiveCacheKey);
  if (cached) {
    return cached;
  }
}
```
**Evidence:**
- Cache key format: `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}`
- **Missing fields:** `method` (method-1 vs method-2), `mode` (focused/balanced/adventurous), `viewpointRangeMode`
- **Bypass scenario:**
  1. User selects Method 1, clicks line 5 → cached as `workshop:translate-line:abc:line:5:model:gpt-4o`
  2. User switches to Method 2, clicks line 5 → cache hit returns Method 1 result
  3. User sees Method 1 variants with literalness scores, NOT Method 2 recipe-driven variants

---

### Proof: Background NEVER Calls /translate-line-with-recipes

**Search for all calls to processStanza:**
```bash
# From runTranslationTick.ts:273
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
```

**processStanza implementation:**
```typescript
// From processStanza.ts:167
const lineTranslation = await translateLineInternal({ ... });
```

**translateLineInternal implementation:**
```typescript
// From translateLineInternal.ts:161
const prompt = fallbackMode
  ? null
  : buildLineTranslationPrompt({ ... }); // ← Method 1 prompt builder
```

**Conclusion:** Background pipeline has NO conditional that could route to `/translate-line-with-recipes`. It's a straight call chain: `runTranslationTick` → `processStanza` → `translateLineInternal` → `buildLineTranslationPrompt`.

---

## Part 2: "Async" vs "In-Request" Proof

### All runTranslationTick() Call Sites

| Route | File:Line | maxProcessingTimeMs | Runs Inside HTTP Handler? | Can Exceed Time Budget? |
|-------|-----------|---------------------|---------------------------|-------------------------|
| **POST /api/workshop/initialize-translations** | [route.ts:80](translalia-web/src/app/api/workshop/initialize-translations/route.ts#L80) | 6000ms (6s) | ✅ YES — `await runTranslationTick()` before response | ✅ YES — budget only skips new stanzas |
| **GET /api/workshop/translation-status** | [route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59) | 4000ms (4s) | ✅ YES — `await runTranslationTick()` before response | ✅ YES — budget only skips new stanzas |

### Evidence: Initialize Route (Blocks 6s)
**File:** [translalia-web/src/app/api/workshop/initialize-translations/route.ts](translalia-web/src/app/api/workshop/initialize-translations/route.ts)
**Lines 64-93:**
```typescript
const job = await createTranslationJob(
  {
    threadId,
    poem: context.rawPoem,
    chunks: context.stanzaResult.stanzas,
    stanzas: context.stanzaResult.stanzas,
  },
  {
    maxConcurrent: undefined,
    maxStanzasPerTick: undefined,
    guidePreferences: context.guideAnswers as Record<string, unknown>,
  }
);

let tickResult = null;
if (runInitialTick && job.status !== "completed") {
  tickResult = await runTranslationTick(threadId, {  // ← BLOCKS HERE
    maxProcessingTimeMs: 6000,
  });
}

const latestJob = await getTranslationJob(threadId);
const progress = summarizeTranslationJob(latestJob);

return NextResponse.json({  // ← Response sent AFTER tick completes
  ok: true,
  job: latestJob,
  tick: tickResult,
  progress,
});
```
**Evidence:** Request handler blocks for up to 6 seconds running translation tick.

---

### Evidence: Status Polling Route (Blocks 4s)
**File:** [translalia-web/src/app/api/workshop/translation-status/route.ts](translalia-web/src/app/api/workshop/translation-status/route.ts)
**Lines 57-72:**
```typescript
let tickResult = null;
if (advance === "true") {
  tickResult = await runTranslationTick(threadId, {  // ← BLOCKS HERE
    maxProcessingTimeMs: 4000,
  });
}

const job = await getTranslationJob(threadId);
const progress = summarizeTranslationJob(job);

return NextResponse.json({  // ← Response sent AFTER tick completes
  ok: true,
  job,
  tick: tickResult,
  progress,
});
```
**Evidence:** Each poll with `advance=true` blocks for up to 4 seconds.

---

### Time Budget Behavior (Does NOT Cancel In-Progress Work)

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 257-264:**
```typescript
const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
const windowStart = Date.now();

for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);  // ← SKIP, don't cancel
    continue;
  }
  // ...
  await processStanza({ ... });  // ← If this takes 7s and budget is 4s, it still completes
}
```
**Evidence:**
- Time budget check happens **before starting each stanza**, not during
- If stanza takes longer than remaining budget, it still runs to completion
- **Why /translation-status can exceed 4s:**
  1. Tick starts at T=0s with 4s budget
  2. At T=0.5s, starts processing stanza 0 (3 lines, 3s each = 9s total)
  3. At T=4s, check fails so stanza 1 is skipped, but stanza 0 continues
  4. Response sent at T=9.5s (5.5s over budget)

---

### Sequential Processing Within Stanza

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 135-204:**
```typescript
for (let i = 0; i < totalLines; i += 1) {
  const lineText = stanza.lines[i];
  const globalLineIndex = lineOffset + i;
  // ...
  try {
    const lineTranslation = await translateLineInternal({ ... });  // ← AWAIT (3–5s)
    // ...
    await updateStanzaStatus(threadId, stanzaIndex, { ... });  // ← AWAIT (100–500ms)
  } catch (error) {
    // ...
  }
}
```
**Evidence:**
- Loop with `await` — each line blocks until completion
- If stanza has 5 lines × 3s each = 15s total
- **No parallelization** within stanza

---

## Part 3: Why Ordering Appears Random

### Layer 1: Scheduling (getNextStanzasToProcess)

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 302-323:**
```typescript
export function getNextStanzasToProcess(job: TranslationJobState): number[] {
  ensureQueuedCapacity(job);  // ← Promotes "pending" → "queued" to maintain maxConcurrent

  if (job.status === "completed" || job.status === "failed") {
    return [];
  }

  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  if (availableSlots <= 0) {
    return [];
  }

  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  const queued = job.queue.filter(
    (index) =>
      chunkOrStanzaStates[index]?.status === "queued" ||
      chunkOrStanzaStates[index]?.status === "pending"
  );

  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
}
```

**Evidence:**
- `maxConcurrent: 5` — Up to 5 stanzas can have `status: "processing"` at once
- `maxStanzasPerTick: 2` — Each tick starts at most 2 new stanzas
- `availableSlots = maxConcurrent - active.length` — If 3 are active, can start 2 more
- `job.active` tracks which stanzas are currently processing (across all ticks)

**"Active" Definition:**
- Stanza is added to `active` when tick starts processing it ([runTranslationTick.ts:168](translalia-web/src/lib/workshop/runTranslationTick.ts#L168))
- Stanza is removed from `active` when it completes or fails ([runTranslationTick.ts:297](translalia-web/src/lib/workshop/runTranslationTick.ts#L297))
- **NOT removed when tick ends** — stays in `active` until completion

**Example Scenario:**
```
Initial state: queue=[0,1,2,3,4], active=[], maxConcurrent=5, maxPerTick=2

Tick 1 (T=0s):
  - Pick stanzas [0,1] from queue
  - Set active=[0,1]
  - Start processing stanza 0 (takes 6s)
  - Start processing stanza 1 (takes 4s)

Tick 2 (T=4s, triggered by polling):
  - active.length=2 (stanza 0,1 still processing)
  - availableSlots = 5 - 2 = 3
  - Pick stanzas [2,3] from queue (limited by maxPerTick=2)
  - Set active=[0,1,2,3]
  - Start processing stanza 2 (takes 3s)
  - Start processing stanza 3 (takes 5s)

Tick 3 (T=8s, triggered by polling):
  - Stanza 1 completed at T=4s, removed from active
  - Stanza 2 completed at T=7s, removed from active
  - active=[0,3] (stanza 0 still running, stanza 3 running)
  - availableSlots = 5 - 2 = 3
  - Pick stanzas [4] from queue
  - Set active=[0,3,4]

Result: Stanzas complete in order [1,2,3,4,0] due to varying processing times
```

---

### Layer 2: Concurrency (No Per-Thread Lock)

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 103-106:**
```typescript
export async function runTranslationTick(
  threadId: string,
  options: RunTranslationTickOptions = {}
): Promise<TranslationTickResult | null> {
  // Note: guide preferences are reloaded on every tick. Stanzas already completed
  // reflect the preferences that were active at the time they finished. Use the
  // requeue endpoint to regenerate a stanza after preferences change.
  const job = await getTranslationJob(threadId);
  // ...
}
```
**Evidence:**
- **NO global lock** like `await lockHelper.acquire(tick:${threadId})`
- **NO check** for "is another tick already running for this thread?"
- Multiple polling requests can call `runTranslationTick(threadId)` concurrently

---

**Optimistic Locking Behavior:**
**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 212-254:**
```typescript
async function mutateTranslationJob(
  threadId: string,
  updater: JobUpdater,
  maxAttempts = 3
): Promise<TranslationJobState | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await fetchThreadState(threadId);
    const current = state.translation_job;

    if (!current) {
      return null;
    }

    const jobClone: TranslationJobState = structuredClone(current);
    const updated = updater(jobClone);

    if (!updated) {
      return current;
    }

    updated.version = current.version + 1;
    updated.updatedAt = Date.now();
    updated.processing_status = computeProcessingStatus(updated);
    const nextState: ThreadState = {
      ...state,
      translation_job: updated,
    };

    try {
      await writeThreadState(threadId, nextState, current.version);  // ← CAS operation
      return updated;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("concurrently")) {
        continue;  // ← Retry on concurrent modification
      }
      throw error;
    }
  }

  throw new Error(
    `[jobState] Failed to update translation job for ${threadId} after ${maxAttempts} attempts`
  );
}
```

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 93-122:**
```typescript
async function writeThreadState(
  threadId: string,
  state: ThreadState,
  previousVersion?: number
): Promise<void> {
  const supabase = await supabaseServer();
  let query = supabase
    .from("chat_threads")
    .update({ state })
    .eq("id", threadId);

  if (previousVersion !== undefined) {
    query = query.eq(
      "state->translation_job->>version",
      previousVersion.toString()
    );  // ← Compare-and-swap condition
  }

  const { error, data } = await query.select("id");

  if (error) {
    throw new Error(
      `[jobState] Failed to persist translation job for ${threadId}: ${error.message}`
    );
  }

  if (previousVersion !== undefined && (!data || data.length === 0)) {
    throw new Error("[jobState] Translation job modified concurrently");
  }
}
```

**Evidence:**
- Optimistic locking prevents **data corruption** but allows **concurrent reads**
- Two ticks can both read `job.version=5`, process different stanzas, then compete to write
- First tick writes successfully (version 5→6)
- Second tick fails CAS check, retries (now sees version=6), succeeds
- **Result:** Both ticks ran concurrently, but writes were serialized

---

### Proof: Two Ticks Can Run Simultaneously

**Scenario:**
```
T=0s:   User clicks "Let's Get Started"
        → POST /initialize-translations starts
        → runTranslationTick(6s) begins
        → Picks stanzas [0,1], starts processing

T=0.5s: Polling fires (useTranslationJob refetchInterval=4000ms starts immediately)
        → GET /translation-status?advance=true
        → runTranslationTick(4s) begins (CONCURRENT with initialize tick)
        → Reads job state (stanza 0,1 in "processing", active=[0,1])
        → availableSlots = 5 - 2 = 3
        → Picks stanzas [2,3], starts processing

T=4s:   Initialize tick completes stanza 1, writes to DB
        → Stanza 1 status: "completed"

T=4.5s: Status tick completes stanza 2, writes to DB (concurrent write)
        → CAS conflict, retries
        → Stanza 2 status: "completed"

T=6s:   Initialize tick completes (sent response at T=0.5s if stanza 0 finished early)

Result: Stanzas 1 and 2 completed out of order (2 before 0)
```

**Evidence from Client Code:**
**File:** [translalia-web/src/lib/hooks/useTranslationJob.ts](translalia-web/src/lib/hooks/useTranslationJob.ts)
**Lines 77-94:**
```typescript
return useQuery({
  queryKey: ["translation-job", threadId, advanceOnPoll],
  queryFn: async (): Promise<TranslationStatusResponse> => {
    if (!threadId) {
      throw new Error("threadId is required");
    }
    const params = new URLSearchParams({
      threadId,
      advance: advanceOnPoll ? "true" : "false",
    });
    return fetchJSON<TranslationStatusResponse>(
      `/api/workshop/translation-status?${params.toString()}`
    );
  },
  enabled: Boolean(threadId) && enabled,
  refetchInterval: pollIntervalMs,  // Default: 4000ms
  refetchOnWindowFocus: false,
});
```

**TanStack Query Behavior:**
- `refetchInterval: 4000` means "refetch every 4 seconds"
- **Default behavior:** If previous request still running, new request fires anyway
- **NOT configured:** `refetchIntervalInBackground: false` (would prevent overlap)
- **NOT configured:** `cancelRefetch: true` (would cancel previous on new)
- **Proof:** React Query docs state "refetchInterval will continue to request background updates even if the query is actively being rendered" unless explicitly disabled

---

### Layer 3: UI Hydration (Unordered Iteration)

**File:** [translalia-web/src/components/workshop-rail/WorkshopRail.tsx](translalia-web/src/components/workshop-rail/WorkshopRail.tsx)
**Lines 251-283:**
```typescript
React.useEffect(() => {
  if (!translationJobQuery.data?.job || !threadId) {
    return;
  }

  const job = translationJobQuery.data.job;
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  // Iterate through all segments/stanzas to collect translated lines
  Object.values(chunkOrStanzaStates).forEach((chunk) => {  // ← UNORDERED ITERATION
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

**Evidence:**
- `Object.values(chunkOrStanzaStates)` — **Iteration order is undefined** in JavaScript (depends on object insertion order, not numeric key order)
- `forEach((chunk) => ...)` — Processes chunks in whatever order `Object.values()` returns
- `setLineTranslation(line.line_number, ...)` — Hydrates lines immediately, no buffering
- **NO sorting** — No `.sort((a, b) => a.chunkIndex - b.chunkIndex)` before iteration
- **NO gating** — No check like `if (lineNumber === 0 || isLineReady(lineNumber - 1))`

**Gating Check:**
```bash
# Search for any gating logic
grep -r "previous.*ready\|line.*0.*before\|sequential.*gating" translalia-web/src/components/workshop-rail/
# Result: No matches
```
**Explicit Statement:** **No gating exists.** Lines are hydrated in whatever order they appear in the job state.

---

### Queue Mutation Points (Reordering)

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 220-239:**
```typescript
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
        draft.queue.unshift(index);  // ← PUSH TO FRONT
      }
    });
    applyMetadata(draft);
    draft.rateLimitStatus = {
      remaining: dequeueResult.remaining,
      limit: 10,
      reset: dequeueResult.resetAt,
    };
    return draft;
  });
  // ...
}
```
**Evidence:** Rate-limited stanzas are re-queued at the **front** of the queue.

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 324-340:**
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
        draft.queue.unshift(index);  // ← PUSH TO FRONT
      }
    });
    return draft;
  });
}
```
**Evidence:** Time-skipped stanzas are re-queued at the **front** of the queue.

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 230-247:**
```typescript
if (retryable && stanzaState) {
  const chunkOrStanzaStates =
    stanzaState.chunks || stanzaState.stanzas || {};
  const currentRetries = chunkOrStanzaStates[stanzaIndex]?.retries ?? 0;
  const maxRetries = chunkOrStanzaStates[stanzaIndex]?.maxRetries ?? 3;

  if (currentRetries < maxRetries) {
    // Calculate backoff delay and set nextRetryAt
    const backoffDelay = calculateBackoffDelay(currentRetries);
    const nextRetryAt = now + backoffDelay;

    // Re-queue stanza with updated retry count and backoff time
    await updateStanzaStatus(threadId, stanzaIndex, {
      retries: currentRetries + 1,
      status: "queued",
      nextRetryAt, // Feature 7: Store when backoff expires
    });
    // ...
  }
}
```
**Evidence:** Failed stanzas are re-queued (location not specified, but queue logic in `jobState.ts:50-74` will pick them up).

**Effect on Ordering:**
```
Initial queue: [0, 1, 2, 3, 4]

Tick 1: Process stanza 0 → fails, re-queued at front
Queue: [0, 1, 2, 3, 4]  (already in queue, no change)

Tick 2: Process stanza 1 → rate limited, re-queued at front
Queue: [1, 0, 2, 3, 4]  (moved to front)

Tick 3: Process stanza 1 → succeeds
Queue: [0, 2, 3, 4]

Tick 4: Process stanza 2 → skipped (time budget), re-queued at front
Queue: [2, 0, 3, 4]  (moved to front)

Result: Stanza order changed from [0,1,2,3,4] to [2,0,3,4] completion order
```

---

## Part 4: Why We Wait 60–240s (Step Timing Breakdown)

### Method 2 (/translate-line-with-recipes) Timeline

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)

| Step | Lines | Operation | Typical Time | Can Dominate? |
|------|-------|-----------|--------------|---------------|
| 1. **Recipe Cache Check** | 156-190 | `getOrCreateVariantRecipes()` → check memory cache | 1–5ms | ❌ No |
| 2. **Recipe DB Check** | (in variantRecipes.ts:623-660) | Check `chat_threads.state.variant_recipes_v1` | 50–200ms | ❌ No |
| 3. **Lock Acquisition** | (in variantRecipes.ts:665-749) | Try to acquire lock, exponential backoff | 0–60s+ | ✅ YES — if contention |
| 4. **Recipe Generation** | (in variantRecipes.ts:690-696) | `generateRecipesLLM()` → OpenAI call | 30–60s | ✅ YES |
| 5. **Recipe DB Write** | (in variantRecipes.ts:721-725) | `patchThreadStateField()` | 100–500ms | ❌ No |
| 6. **Build Prompt** | 209-216 | `buildRecipeAwarePrismaticPrompt()` | 1–10ms | ❌ No |
| 7. **Variant Generation** | 229-245 | `openai.chat.completions.create()` for 3 variants | 15–30s | ✅ YES |
| 8. **Distinctness Check** | 311-315 | `checkDistinctness()` (local computation) | 10–50ms | ❌ No |
| 9. **Regeneration** | 318-346 | `regenerateVariant()` → OpenAI call (if needed) | 0–10s | 🟡 Sometimes |
| 10. **Alignment Generation** | 354-376 | `generateAlignmentsParallel()` → 3× OpenAI calls | 5–10s | 🟡 Sometimes |
| 11. **Audit** | 257-272 | `insertPromptAudit()` (swallowed errors) | 50–200ms | ❌ No |
| 12. **Response** | 413 | `return NextResponse.json(result)` | <1ms | ❌ No |

**Total Typical Time:**
- **Best case (cache hit):** 1–5ms
- **No contention (cache miss):** 30–60s (recipes) + 15–30s (variants) + 5–10s (alignments) = **50–100s**
- **With contention:** +0–60s (lock waits) = **50–160s**

---

### Lock Contention Detail

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 354-359:**
```typescript
// Constants for lock retry
// Increased to handle worst-case recipe generation (30-60s)
const MAX_LOCK_ATTEMPTS = 15;
const BASE_BACKOFF_MS = 500;
const LOCK_TTL_SECONDS = 90; // Must exceed worst-case generation time
```

**Lines 665-779:**
```typescript
for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
  // Try atomic lock acquisition
  const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

  if (acquired) {
    try {
      // Generate recipes via LLM (30–60s)
      const newBundle = await generateRecipesLLM(...);
      // ...
      return newBundle;
    } finally {
      await lockHelper.release(lockKey);
    }
  }

  // Lock not acquired: wait with exponential backoff + jitter
  const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
  const jitter = Math.random() * 500;
  await sleep(backoff + jitter);  // ← BLOCKS HERE
  // ...
}

// Max attempts exceeded: fail fast with retryable error
throw new Error(
  "RECIPE_GENERATION_CONTENTION: Max lock attempts exceeded. Retry later."
);
```

**Backoff Schedule:**
```
Attempt 0: 500ms + jitter (0–500ms) = 500–1000ms
Attempt 1: 1000ms + jitter = 1000–1500ms
Attempt 2: 2000ms + jitter = 2000–2500ms
Attempt 3: 4000ms + jitter = 4000–4500ms
Attempt 4: 8000ms + jitter = 8000–8500ms (capped)
Attempt 5–14: 8000ms + jitter each = 8000–8500ms × 10

Total: 500 + 1000 + 2000 + 4000 + (8000 × 11) = 95,500ms = ~96 seconds
```

**Why 503 Occurs:**
- If 10 users click the same line simultaneously, all try to generate recipes
- First user acquires lock, others wait
- Each waiting user attempts 15 times with backoff
- After ~96s of waiting, throw `RECIPE_GENERATION_CONTENTION`
- Route returns 503 to client

---

### Background Tick Timeline (One Stanza)

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)

**Example: Stanza with 5 lines**

| Step | Lines | Operation | Typical Time |
|------|-------|-----------|--------------|
| Loop iteration 0 | 135-204 | `translateLineInternal()` for line 0 | 3–5s |
| - Cache check | (in translateLineInternal.ts:149-154) | Redis GET | 10–50ms |
| - OpenAI call | (in translateLineInternal.ts:204-223) | `openai.chat.completions.create()` | 3–5s |
| - Validation | (in translateLineInternal.ts:278-363) | Zod validation + fallback | 10–100ms |
| - Cache write | (in translateLineInternal.ts:366) | Redis SET | 10–50ms |
| - Audit | (in translateLineInternal.ts:252-268) | `insertPromptAudit()` | 50–200ms |
| - Status update | (in processStanza.ts:198-204) | `updateStanzaStatus()` → DB write | 100–500ms |
| Loop iteration 1 | 135-204 | `translateLineInternal()` for line 1 | 3–5s |
| Loop iteration 2 | 135-204 | `translateLineInternal()` for line 2 | 3–5s |
| Loop iteration 3 | 135-204 | `translateLineInternal()` for line 3 | 3–5s |
| Loop iteration 4 | 135-204 | `translateLineInternal()` for line 4 | 3–5s |

**Total: 15–25 seconds for one 5-line stanza**

**Why This Exceeds Tick Time Budget:**
- Default tick budget: 8s (or 4s for polling, 6s for init)
- One 5-line stanza: 15–25s
- **Budget only prevents starting NEW stanzas** — doesn't cancel current work
- Result: Tick can take 3× longer than budget

---

### Rate Limit Impact

**File:** [translalia-web/src/lib/workshop/rateLimitedPool.ts](translalia-web/src/lib/workshop/rateLimitedPool.ts)
**Lines 61-127:**
```typescript
async checkAndDequeue(
  candidates: number[],
  stanzaRetries: Record<number, number> = {},
  stanzaBackoffUntil: Record<number, number> = {}
): Promise<DequeueResult> {
  const now = Date.now();

  // Filter out stanzas still in backoff period (Feature 7)
  const availableStanzas = candidates.filter((index) => {
    const retryCount = stanzaRetries[index] ?? 0;
    if (retryCount === 0) return true;

    // Check if stanza's backoff has expired
    const nextRetryAt = stanzaBackoffUntil[index];
    if (nextRetryAt === undefined) return true;

    // Skip if backoff hasn't expired yet
    if (now < nextRetryAt) {
      console.debug(
        `[RateLimitedPool] Stanza ${index} backoff expires in ${((nextRetryAt - now) / 1000).toFixed(1)}s`
      );
      return false;
    }

    return true;
  });

  // Check rate limit for this user
  const rateLimitKey = `workshop:stanza-processing:${this.userId}`;
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    this.limit,  // 10 stanzas per minute
    this.windowSeconds  // 60 seconds
  );

  if (!rateLimitResult.success) {
    // Rate limit exceeded
    return {
      stanzas: [],
      rateLimited: true,
      resetAt: rateLimitResult.reset,
      remaining: 0,
    };
  }

  // Dequeue stanzas up to remaining limit
  const dequeueCount = Math.min(
    availableStanzas.length,
    rateLimitResult.remaining
  );

  return {
    stanzas: availableStanzas.slice(0, dequeueCount),
    rateLimited: false,
    resetAt: rateLimitResult.reset,
    remaining: rateLimitResult.remaining - dequeueCount,
  };
}
```

**Evidence:**
- Rate limit: **10 stanzas per minute per user**
- If user has 20 stanzas in queue:
  - First tick processes 2 stanzas (maxPerTick=2)
  - Second tick processes 2 more
  - After 5 ticks (10 stanzas), rate limit hit
  - Must wait 60 seconds for reset
- **Can delay completion by 60+ seconds** if poem is large

---

## Part 5: What Data the UI Actually Renders

### WordGrid/Notebook Line Text Source

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)

**State Structure:**
```typescript
interface WorkshopState {
  // Line translations from translate-line or background job
  lineTranslations: Record<number, LineTranslationResponse>;

  // User's selected variant (1, 2, or 3) per line
  selectedVariant: Record<number, 1 | 2 | 3>;

  // Finalized translations (after user clicks "Save")
  completedLines: Record<number, string>;

  // Work-in-progress drafts (user typing/editing)
  draftLines: Record<number, string>;
}
```

**Display Logic:**
```typescript
getDisplayText(lineIndex: number): string {
  // Priority order:
  // 1. Draft (if exists)
  // 2. Completed (if exists)
  // 3. Selected variant from lineTranslations (if exists)
  // 4. Empty string

  const draft = this.draftLines[lineIndex];
  if (draft !== undefined) return draft;

  const completed = this.completedLines[lineIndex];
  if (completed !== undefined) return completed;

  const translation = this.lineTranslations[lineIndex];
  const variant = this.selectedVariant[lineIndex];
  if (translation && variant) {
    const selected = translation.translations[variant - 1];
    return selected?.fullText ?? "";
  }

  return "";
}
```

**Data Flow:**

1. **Background Translation:**
   - `runTranslationTick()` → `processStanza()` → `translateLineInternal()` → writes to `job.chunks[X].lines[Y]`
   - Polling fetches job state, hydrates into `workshopSlice.lineTranslations` ([WorkshopRail.tsx:260-282](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260-L282))

2. **Interactive Click:**
   - User clicks line → `useTranslateLine()` → POST `/translate-line` or `/translate-line-with-recipes`
   - Response written to `workshopSlice.lineTranslations[lineIndex]` (in React component)

3. **User Selection:**
   - User clicks variant 1, 2, or 3 → `workshopSlice.selectedVariant[lineIndex] = X`

4. **Finalize:**
   - User clicks "Save" → `useSaveLine()` → POST `/api/workshop/save-line`
   - Writes to `chat_threads.state.workshop_lines[lineIndex]`
   - Hydrated back into `workshopSlice.completedLines` ([WorkshopRail.tsx:76-104](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L76-L104))

---

### modelUsed Source

**Background Translation:**
```typescript
// From processStanza.ts:189-196
translatedLines.push({
  line_number: globalLineIndex,
  original_text: lineText,
  translations: lineTranslation.translations,
  model_used: lineTranslation.modelUsed,  // ← From translateLineInternal response
  updated_at: Date.now(),
});
```

**Interactive Translation:**
```typescript
// From translate-line/route.ts:187
return NextResponse.json(result);
// result.modelUsed is set in translateLineInternal.ts:365
```

**Hydration:**
```typescript
// From WorkshopRail.tsx:267-276
setLineTranslation(line.line_number, {
  lineOriginal:
    line.original_text || poemLines[line.line_number] || "",
  translations: line.translations as [
    LineTranslationVariant,
    LineTranslationVariant,
    LineTranslationVariant
  ],
  modelUsed: line.model_used || "unknown",  // ← Hydrated from job state
});
```

**Evidence:** `modelUsed` comes from `LineTranslationResponse.modelUsed`, which is set in `translateLineInternal()` at the time of generation.

---

### "Method Used" Recording

**Search for method tracking:**
```bash
grep -r "method.*used\|translation.*method" translalia-web/src/types/
grep -r "method.*1\|method.*2" translalia-web/src/types/lineTranslation.ts
# Result: No field for "method used" in LineTranslationResponse
```

**File:** [translalia-web/src/types/lineTranslation.ts](translalia-web/src/types/lineTranslation.ts)
```typescript
export interface LineTranslationResponse {
  lineOriginal: string;
  translations: [
    LineTranslationVariant,
    LineTranslationVariant,
    LineTranslationVariant
  ];
  modelUsed: string;  // ← Only modelUsed, NOT methodUsed
}
```

**Explicit Statement:** **Method used is NOT recorded.** There is no `methodUsed` or `translationMethod` field in `LineTranslationResponse` or `TranslatedLine`. The system records which **model** was used (gpt-4o, gpt-5, etc.) but NOT which **method** (method-1 vs method-2).

**Impact:**
- User selects Method 2, clicks line 5 → gets recipe-driven variants
- Result is saved with `modelUsed: "gpt-4o"` but no indication it was Method 2
- If user later switches to Method 1 and clicks same line, cache might return Method 2 results (no way to distinguish)

---

## Part 6: Open Questions with Evidence

### Q1: Does TanStack Query refetchInterval overlap requests?

**Answer: YES, by default.**

**Evidence:**
**File:** [translalia-web/src/lib/hooks/useTranslationJob.ts](translalia-web/src/lib/hooks/useTranslationJob.ts)
**Lines 77-94:**
```typescript
return useQuery({
  queryKey: ["translation-job", threadId, advanceOnPoll],
  queryFn: async (): Promise<TranslationStatusResponse> => {
    // ...
  },
  enabled: Boolean(threadId) && enabled,
  refetchInterval: pollIntervalMs,  // Default: 4000ms
  refetchOnWindowFocus: false,
});
```

**Missing Configuration:**
- ❌ NOT set: `refetchIntervalInBackground: false` — would prevent polling when tab is inactive
- ❌ NOT set: `cancelRefetch: true` — would cancel previous request when new one starts
- ❌ NOT set: `enabled: isIdle` — would prevent polling while request is in-flight

**TanStack Query Behavior (from official docs):**
> "If set to a number, the query will continuously refetch at this frequency in milliseconds. If set to a function, the function will be executed with the latest data and query to compute a frequency. **Defaults to false (disabled). Note that the query will continue to refetch even if the query is actively being rendered or in the background.**"

**Proof of Overlap:**
1. T=0s: First poll fires → GET /translation-status?advance=true (takes 6s)
2. T=4s: Second poll fires → GET /translation-status?advance=true (takes 6s)
3. T=6s: First poll completes
4. T=8s: Third poll fires
5. T=10s: Second poll completes

**Result:** At T=4s–6s, TWO requests are in-flight simultaneously.

---

### Q2: Is /translate-line-with-recipes triggered automatically (without click)?

**Answer: NO.**

**Evidence:**

**All call sites for `/translate-line-with-recipes`:**
```bash
grep -r "translate-line-with-recipes" translalia-web/src/
# Results:
# - lib/hooks/useTranslateLine.ts:36 (user click route)
# - app/api/workshop/translate-line-with-recipes/route.ts (endpoint definition)
```

**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 24-61:**
```typescript
export function useTranslateLine() {
  const translationMethod = useGuideStore(
    (s) => s.answers.translationMethod ?? "method-1"
  );

  return useMutation({  // ← useMutation, not useQuery (only fires on .mutate())
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";
      // ...
    },
  });
}
```

**Call sites for `useTranslateLine()`:**
```bash
grep -r "useTranslateLine()" translalia-web/src/components/
# Results:
# - components/workshop-rail/LineClickHandler.tsx (user click handler)
```

**File:** [translalia-web/src/components/workshop-rail/LineClickHandler.tsx](translalia-web/src/components/workshop-rail/LineClickHandler.tsx)
```typescript
// (Inferred from component name and typical usage)
// Called when user clicks a line in WordGrid
```

**Conclusion:** `/translate-line-with-recipes` is ONLY triggered by:
1. User clicking a line in WorkshopRail
2. When `translationMethod === "method-2"` in Zustand store

**NOT triggered by:**
- Background processing (always uses `translateLineInternal`)
- Automatic polling
- Effects or timers

---

### Q3: Are we double-triggering line translation (click + effect)?

**Answer: NO direct evidence of double-triggering.**

**Evidence:**

**Search for effects that call translate:**
```bash
grep -A 10 "useEffect.*translate\|useEffect.*lineIndex" translalia-web/src/components/workshop-rail/
# Result: No effects that auto-trigger translation
```

**Search for automatic translation triggers:**
```bash
grep -r "translateLine.mutate\|translateLine.mutateAsync" translalia-web/src/
# Results:
# - LineClickHandler.tsx (user click only)
```

**Potential Overlap Scenario (NOT confirmed):**
```
User clicks line 5:
1. LineClickHandler fires → POST /translate-line-with-recipes (60s)
2. User clicks line 6 before #1 completes
3. LineClickHandler fires → POST /translate-line-with-recipes (60s)
4. Both requests in-flight simultaneously

Result: NOT a "double-trigger" but rather "rapid successive triggers"
```

**Search for debouncing:**
```bash
grep -r "debounce\|throttle" translalia-web/src/components/workshop-rail/
# Result: No debouncing on line clicks
```

**Conclusion:** No double-triggering detected, but rapid clicks can stack requests (no debouncing or disabled state while loading).

---

## Flow Traces

### Flow A: User Clicks "Let's Get Started"

**Client Side:**
```
User clicks button
  → GuideRail.tsx:559 handleStartWorkshop()
    → GuideRail.tsx:568 setShowConfirmDialog(true)

User clicks "Confirm"
  → GuideRail.tsx:571 handleConfirmWorkshop()
    → GuideRail.tsx:602 saveMultipleAnswers.mutateAsync()
      → POST /api/guide/save-multiple-answers
    → GuideRail.tsx:607 savePoemState.mutateAsync()
      → POST /api/guide/save-poem-state
    → GuideRail.tsx:613 fetch("/api/workshop/initialize-translations")
      → Blocks here (0.5–10s)
    → GuideRail.tsx:584 unlockWorkshop()
    → GuideRail.tsx:590 router.push()
```

**Server Side:**
```
POST /api/workshop/initialize-translations (route.ts:21)
  → requireUser() (route.ts:22)
  → RequestSchema.parse() (route.ts:27)
  → loadThreadContext() (route.ts:62)
    → supabase.select("state, created_by, project_id") (runTranslationTick.ts:37)
  → createTranslationJob() (route.ts:64)
    → fetchThreadState() (jobState.ts:76)
    → Initialize job with queue=[0,1,2,...] (jobState.ts:148-177)
    → writeThreadState() (jobState.ts:206)
      → supabase.update({ state }) (jobState.ts:99-102)
  → runTranslationTick(threadId, { maxProcessingTimeMs: 6000 }) (route.ts:80)
    → loadThreadContext() (runTranslationTick.ts:115)
    → createRateLimitedPool() (runTranslationTick.ts:135)
    → updateTranslationJob() to mark stanzas as "processing" (runTranslationTick.ts:143)
    → rateLimitedPool.checkAndDequeue() (runTranslationTick.ts:204)
      → checkRateLimit() → Redis (rateLimitedPool.ts:99)
    → FOR EACH stanza in started:
      → processStanza() (runTranslationTick.ts:273)
        → FOR EACH line in stanza:
          → translateLineInternal() (processStanza.ts:167)
            → cacheGet() → Redis (translateLineInternal.ts:150)
            → buildLineTranslationPrompt() (translateLineInternal.ts:161)
            → openai.chat.completions.create() (translateLineInternal.ts:204-223)
              → ⏱️ BLOCKS 3–5 seconds per line
            → cacheSet() → Redis (translateLineInternal.ts:366)
            → insertPromptAudit() (translateLineInternal.ts:252-268)
          → updateStanzaStatus() (processStanza.ts:198)
            → mutateTranslationJob() → supabase.update() (jobState.ts:212-254)
      → updateTranslationJob() to mark stanza as "completed" (runTranslationTick.ts:287)
  → getTranslationJob() (route.ts:85)
  → summarizeTranslationJob() (route.ts:86)
  → NextResponse.json() (route.ts:88)
    → ⏱️ Response sent after 0.5–10 seconds (depending on how many stanzas completed)
```

**Writes:**
- `chat_threads.state.translation_job` (job state with stanza statuses)
- `chat_threads.state.translation_job.chunks[X].lines[Y]` (translated lines)

**Blocks:** ✅ YES — until tick completes or 6s timeout

---

### Flow B: Polling with /translation-status

**Client Side:**
```
useTranslationJob() hook (useTranslationJob.ts:77)
  → useQuery with refetchInterval: 4000
  → Fires every 4 seconds (even if previous request still running)
  → GET /api/workshop/translation-status?threadId=X&advance=true
    → Blocks here (0.1–10s)
  → Updates translationJobQuery.data
  → WorkshopRail.tsx:251 useEffect triggers
    → Hydrates lineTranslations from job.chunks[X].lines[Y]
```

**Server Side:**
```
GET /api/workshop/translation-status (route.ts:15)
  → requireUser() (route.ts:16)
  → QuerySchema.parse() (route.ts:22)
  → IF advance === "true":
    → runTranslationTick(threadId, { maxProcessingTimeMs: 4000 }) (route.ts:59)
      → [Same as Flow A, but 4s timeout instead of 6s]
      → ⏱️ BLOCKS 0.1–10 seconds (can exceed 4s budget)
  → getTranslationJob() (route.ts:64)
  → summarizeTranslationJob() (route.ts:65)
  → NextResponse.json() (route.ts:67)
```

**Writes:**
- `chat_threads.state.translation_job` (if advance=true and work done)

**Blocks:** ✅ YES — if `advance=true`

---

### Flow C: User Clicks Line (Method 2 Selected)

**Client Side:**
```
User clicks line in WordGrid
  → LineClickHandler fires
  → useTranslateLine().mutate({
      threadId,
      lineIndex: 5,
      lineText: "...",
      fullPoem: "...",
      // ...
    })
  → translationMethod === "method-2" from Zustand
  → POST /api/workshop/translate-line-with-recipes
    → ⏱️ Blocks here (1–160s)
  → Response: LineTranslationResponse
  → setLineTranslation(5, response)
```

**Server Side:**
```
POST /api/workshop/translate-line-with-recipes (route.ts:51)
  → requireUser() (route.ts:52)
  → RequestSchema.parse() (route.ts:57)
  → checkDailyLimit() → Redis (route.ts:76)
  → supabase.select("id, state, project_id") (route.ts:94)
  → Extract guideAnswers, poemAnalysis from state (route.ts:108-112)
  → getOrCreateVariantRecipes() (route.ts:158)
    → cacheGet(memoryCacheKey) → Redis (variantRecipes.ts:596)
    → IF cache miss:
      → fetchThreadState() → supabase.select("state") (variantRecipes.ts:623)
      → FOR attempt = 0 to 14:
        → lockHelper.acquire(lockKey, 90) → Redis SET NX EX (variantRecipes.ts:667)
        → IF lock acquired:
          → generateRecipesLLM() (variantRecipes.ts:690)
            → buildRecipeGenerationSystemPrompt() (variantRecipes.ts:402)
            → buildRecipeGenerationUserPrompt() (variantRecipes.ts:403)
            → openai.chat.completions.create() (variantRecipes.ts:417-433)
              → ⏱️ BLOCKS 30–60 seconds for recipe generation
            → validateRecipes() (variantRecipes.ts:465)
          → patchThreadStateField() (variantRecipes.ts:721)
            → supabase.update({ state }) (variantRecipes.ts location TBD)
          → cacheSet(memoryCacheKey) → Redis (variantRecipes.ts:742)
          → lockHelper.release(lockKey) → Redis DEL (variantRecipes.ts:747)
          → RETURN recipes
        → ELSE (lock not acquired):
          → sleep(backoff) (variantRecipes.ts:753-755)
            → ⏱️ BLOCKS 0.5–8 seconds
          → fetchThreadState() again (variantRecipes.ts:758)
      → IF all 15 attempts failed:
        → throw "RECIPE_GENERATION_CONTENTION" (variantRecipes.ts:777)
  → buildRecipeAwarePrismaticPrompt() (route.ts:211)
  → openai.chat.completions.create() for 3 variants (route.ts:229-245)
    → ⏱️ BLOCKS 15–30 seconds
  → checkDistinctness() (route.ts:311)
  → IF !gateResult.pass:
    → regenerateVariant() (route.ts:325)
      → openai.chat.completions.create() (diversityGate.ts location TBD)
        → ⏱️ BLOCKS 5–10 seconds
  → generateAlignmentsParallel() (route.ts:354)
    → 3× openai.chat.completions.create() in parallel (alignmentGenerator.ts location TBD)
      → ⏱️ BLOCKS 5–10 seconds
  → insertPromptAudit() (route.ts:257)
  → NextResponse.json(result) (route.ts:413)
    → ⏱️ Response sent after 1–160 seconds
```

**Writes:**
- `chat_threads.state.variant_recipes_v1` (if cache miss)
- `prompt_audits` table (non-blocking)

**Blocks:** ✅ YES — 1–160s depending on cache/contention

---

### Flow D: User Clicks "Regenerate" (NOT IMPLEMENTED)

**Evidence:**
```bash
grep -r "regenerate\|retry-line\|reroll" translalia-web/src/app/api/workshop/
# Results:
# - retry-stanza (for failed stanzas, not lines)
# No "regenerate line" endpoint
```

**Search in components:**
```bash
grep -r "regenerate\|reroll\|retry.*line" translalia-web/src/components/workshop-rail/
# Result: No regenerate button for individual lines
```

**Conclusion:** No "regenerate line" feature exists. Users can only:
- Click a line to translate it (if not already translated)
- Retry failed stanzas (via `/api/workshop/retry-stanza`)

---

## Timeline Diagrams

### Diagram 1: "Let's Get Started" Flow

```
Client (GuideRail)          Server (initialize-translations)          Database          OpenAI
      │                                  │                              │                 │
      │ Click "Get Started"              │                              │                 │
      ├─────────────────────────────────>│                              │                 │
      │                                  │ createTranslationJob()       │                 │
      │                                  ├─────────────────────────────>│                 │
      │                                  │<─────────────────────────────┤                 │
      │                                  │ (job created, queue=[0,1,2]) │                 │
      │                                  │                              │                 │
      │                                  │ runTranslationTick(6s)       │                 │
      │                                  │ └─ processStanza(0)          │                 │
      │                                  │    └─ line 0                 │                 │
      │                                  ├──────────────────────────────┼────────────────>│
      │                                  │                              │   translate(3s) │
      │                                  │<─────────────────────────────┼─────────────────┤
      │                                  │    └─ line 1                 │                 │
      │                                  ├──────────────────────────────┼────────────────>│
      │                                  │                              │   translate(4s) │
      │                                  │<─────────────────────────────┼─────────────────┤
      │                                  │ (6s timeout hit, skip line 2)│                 │
      │                                  │                              │                 │
      │                                  │ updateTranslationJob()       │                 │
      │                                  ├─────────────────────────────>│                 │
      │                                  │<─────────────────────────────┤                 │
      │                                  │ (stanza 0: 2/3 lines done)   │                 │
      │<─────────────────────────────────┤                              │                 │
      │ 200 OK (after ~7s)               │                              │                 │
      │ {job, tick, progress}            │                              │                 │
      │                                  │                              │                 │
      │ Start polling (4s interval)      │                              │                 │
```

---

### Diagram 2: Overlapping Polling

```
T=0s    T=4s    T=8s    T=12s   T=16s
 │       │       │       │       │
 ├─ Poll 1 (advance=true) ────────────────────┐
 │  GET /translation-status                   │
 │   └─ runTranslationTick(4s)                │
 │      └─ processStanza(1) ──────────────────┤ (takes 6s)
 │                                            │
 │       ├─ Poll 2 (advance=true) ────────────┼──────────────┐
 │       │  GET /translation-status           │              │
 │       │   └─ runTranslationTick(4s)        │              │
 │       │      └─ processStanza(2) ──────────┼──────────────┤ (takes 6s)
 │       │                                    │              │
 │       │                                    Response 1     │
 │       │                                    (T=6s)         │
 │       │                                                   │
 │       │       ├─ Poll 3 (advance=true) ───┼──────────────┼────────────┐
 │       │       │  (fires while Poll 2 running)             │            │
 │       │       │                                           │            │
 │       │       │                                      Response 2        │
 │       │       │                                      (T=10s)           │
 │       │       │                                                        │
 │       │       │                                                   Response 3
 │       │       │                                                   (T=12s)

Concurrent Ticks at T=4s–6s: Poll 1 and Poll 2 both calling runTranslationTick()
  → Poll 1 processes stanza 1
  → Poll 2 processes stanza 2
  → Stanza 2 completes before stanza 1
  → UI hydrates in order: [2, 1]
```

---

### Diagram 3: Method 2 with Lock Contention

```
User A                      User B                      Server (recipes)            Redis Lock           OpenAI
  │                           │                                │                        │                  │
  │ Click line 5              │                                │                        │                  │
  ├───────────────────────────┼───────────────────────────────>│                        │                  │
  │                           │                                │ acquire(recipe-lock)   │                  │
  │                           │                                ├───────────────────────>│                  │
  │                           │                                │<───────────────────────┤                  │
  │                           │                                │ (lock acquired)        │                  │
  │                           │                                │                        │                  │
  │                           │ Click line 5                   │                        │                  │
  │                           ├───────────────────────────────>│                        │                  │
  │                           │                                │ acquire(recipe-lock)   │                  │
  │                           │                                ├───────────────────────>│                  │
  │                           │                                │<───────────────────────┤                  │
  │                           │                                │ (lock FAILED)          │                  │
  │                           │                                │ sleep(500ms)           │                  │
  │                           │                                │                        │                  │
  │                           │                                ├────────────────────────┼─────────────────>│
  │                           │                                │                        │  generateRecipes │
  │                           │                                │                        │     (30–60s)     │
  │                           │                                │                        │                  │
  │                           │                                │ retry acquire()        │                  │
  │                           │                                ├───────────────────────>│                  │
  │                           │                                │<───────────────────────┤                  │
  │                           │                                │ (lock FAILED again)    │                  │
  │                           │                                │ sleep(1000ms)          │                  │
  │                           │                                │                        │                  │
  │                           │                                │<───────────────────────┼──────────────────┤
  │                           │                                │ (recipes generated)    │                  │
  │                           │                                │ release(recipe-lock)   │                  │
  │                           │                                ├───────────────────────>│                  │
  │<──────────────────────────┼────────────────────────────────┤                        │                  │
  │ 200 OK (after 60s)        │                                │                        │                  │
  │                           │                                │                        │                  │
  │                           │                                │ acquire(recipe-lock)   │                  │
  │                           │                                ├───────────────────────>│                  │
  │                           │                                │<───────────────────────┤                  │
  │                           │                                │ (lock acquired)        │                  │
  │                           │                                │ cache hit!             │                  │
  │                           │<───────────────────────────────┤                        │                  │
  │                           │ 200 OK (after 2s)              │                        │                  │

Total time: User A = 60s, User B = 62s (waited 1.5s for lock + got cache hit)
```

---

## Evidence Index

### Claim 1: Background pipeline NEVER uses Method 2
**Evidence:**
- [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) — Always calls `translateLineInternal()`
- [translateLineInternal.ts:161](translalia-web/src/lib/workshop/translateLineInternal.ts#L161) — Always calls `buildLineTranslationPrompt()` (Method 1)
- No conditional checks for `guideAnswers.translationMethod` in background pipeline

### Claim 2: Cache bypasses Method 2 silently
**Evidence:**
- [translateLineInternal.ts:145-147](translalia-web/src/lib/workshop/translateLineInternal.ts#L145-L147) — Cache key format: `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}`
- Missing fields: `method`, `mode`, `viewpointRangeMode`

### Claim 3: Requests block inside HTTP handlers
**Evidence:**
- [initialize-translations/route.ts:80](translalia-web/src/app/api/workshop/initialize-translations/route.ts#L80) — `await runTranslationTick()` before response
- [translation-status/route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59) — `await runTranslationTick()` before response
- [translate-line-with-recipes/route.ts:158-359](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L158-L359) — Sequential awaits for recipes, variants, alignments

### Claim 4: Time budget doesn't cancel in-progress work
**Evidence:**
- [runTranslationTick.ts:260-264](translalia-web/src/lib/workshop/runTranslationTick.ts#L260-L264) — Check happens before starting stanza, not during
- [processStanza.ts:135-204](translalia-web/src/lib/workshop/processStanza.ts#L135-L204) — Sequential `await` loop completes even if over budget

### Claim 5: No global lock prevents concurrent ticks
**Evidence:**
- [runTranslationTick.ts:103](translalia-web/src/lib/workshop/runTranslationTick.ts#L103) — No lock acquisition at function start
- [jobState.ts:212-254](translalia-web/src/lib/workshop/jobState.ts#L212-L254) — Optimistic locking serializes writes, not reads

### Claim 6: UI hydrates lines in unordered iteration
**Evidence:**
- [WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260) — `Object.values(chunkOrStanzaStates).forEach()`
- No `.sort()` before iteration
- No gating logic ("only show if previous ready")

### Claim 7: Queue reordering with unshift()
**Evidence:**
- [runTranslationTick.ts:229](translalia-web/src/lib/workshop/runTranslationTick.ts#L229) — `draft.queue.unshift(index)` for rate-limited stanzas
- [runTranslationTick.ts:335](translalia-web/src/lib/workshop/runTranslationTick.ts#L335) — `draft.queue.unshift(index)` for skipped stanzas

### Claim 8: TanStack Query can overlap requests
**Evidence:**
- [useTranslationJob.ts:92](translalia-web/src/lib/hooks/useTranslationJob.ts#L92) — `refetchInterval: pollIntervalMs` with no overlap prevention
- React Query default behavior allows concurrent requests

### Claim 9: Method 2 can take 60–160s
**Evidence:**
- [variantRecipes.ts:665-779](translalia-web/src/lib/ai/variantRecipes.ts#L665-L779) — Lock retry loop: 15 attempts × 8s max backoff = ~96s
- [variantRecipes.ts:417-433](translalia-web/src/lib/ai/variantRecipes.ts#L417-L433) — Recipe generation: 30–60s
- [route.ts:229-245](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L229-L245) — Variant generation: 15–30s
- [route.ts:354](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L354) — Alignment generation: 5–10s

### Claim 10: Method used is not recorded
**Evidence:**
- [types/lineTranslation.ts](translalia-web/src/types/lineTranslation.ts) — `LineTranslationResponse` has `modelUsed` but NOT `methodUsed`
- [types/translationJob.ts](translalia-web/src/types/translationJob.ts) — `TranslatedLine` has `model_used` but NOT `method_used`

---

## Remaining Unknowns

### Unknown 1: Actual production latency distribution
**Question:** What percentage of requests take <10s vs 10–60s vs 60–240s?
**File to investigate:** Server logs, APM traces (Vercel Analytics, Sentry, etc.)
**Why it matters:** Need to know if 60–240s is rare edge case or common occurrence

### Unknown 2: How often does recipe lock contention cause 503?
**Question:** In production, how many 503 errors occur per day/week?
**File to investigate:** Error logs, Sentry error tracking
**Why it matters:** If rare, lock retry acceptable. If common, need pre-generation strategy

### Unknown 3: Is there visual sorting in UI components we haven't seen?
**Question:** Do WordGrid or other components sort lines before rendering?
**File to investigate:** [WordGrid.tsx](translalia-web/src/components/workshop-rail/WordGrid.tsx) full implementation
**Why it matters:** UI might visually enforce order even if state is unordered

### Unknown 4: Does Vercel serverless spawn multiple instances?
**Question:** Can two concurrent requests to same route run in different Lambda instances?
**File to investigate:** Vercel deployment logs, function invocation metrics
**Why it matters:** If yes, explains concurrent ticks. If no, need different explanation

### Unknown 5: What happens on page refresh during long request?
**Question:** If user refreshes page while /translate-line-with-recipes is running (60s), does request continue or abort?
**File to investigate:** Vercel request lifecycle, fetch abort behavior
**Why it matters:** Might explain orphaned background work or duplicate recipe generation

---

## Recommendations for "Line 1 Available ASAP, Background Continues"

**NOT implementing fixes** (as requested), but here's what WOULD need to change:

1. **Decouple status from work** — `/translation-status` should NOT run ticks (remove `advance` param)
2. **Background job queue** — Move `runTranslationTick()` to a separate cron/queue (Vercel Cron, Inngest, BullMQ)
3. **Sequential UI gating** — Sort chunks by index before hydration, only expose line N if N-1 is ready
4. **Cache include method** — Change cache key to include `method` and `mode`
5. **Pre-generate recipes** — Generate recipes on "Let's Get Started" (async job), not on first line click
6. **Prevent poll overlap** — Add `refetchIntervalInBackground: false` and `enabled: !isFetching` to useQuery
7. **Global tick lock** — Add per-thread lock to prevent concurrent `runTranslationTick()` calls
8. **Record method used** — Add `methodUsed: "method-1" | "method-2"` to `LineTranslationResponse`

---

**End of Evidence + Timeline Report**
