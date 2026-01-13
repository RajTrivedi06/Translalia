# Evidence Bundle: Translation Pipeline Async + Ordering + Method Selection

**Investigation Date:** 2026-01-07
**Objective:** Explain why requests take 60–240s, why later lines finish before earlier ones, and whether Method 2 (recipe-driven prismatic) is truly used.

---

## Executive Summary

### Root Causes Identified

**1. Long Request Latency (60–240s)**
- **HTTP requests stay open during processing** — Endpoints like `/api/workshop/translation-status` (with `advance=true`) and `/api/workshop/initialize-translations` run full translation ticks **synchronously within the request**.
- **Sequential line processing** — Each stanza is processed line-by-line in a loop with `await`, causing cumulative latency.
- **Multiple LLM calls per request** — Method 2 can trigger: (1) recipe generation (30–60s), (2) 3 variant generation, (3) distinctness check, (4) regeneration if needed, (5) parallel alignment generation.
- **Lock contention** — Recipe generation uses locks with 15 retry attempts (500ms–8s backoff), adding up to 60+ seconds if contention occurs.
- **No true async processing** — Polling with `advance=true` means each poll **blocks for 4 seconds** running a tick, not just checking status.

**2. Out-of-Order Line Readiness**
- **No sequential gating in UI** — [WorkshopRail.tsx:203-248](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L203-L248) iterates through job state and hydrates lines **as soon as they exist**, regardless of line number order.
- **Concurrent stanza processing** — While `runTranslationTick` processes stanzas sequentially within a tick, **multiple ticks can run concurrently** (via overlapping polling requests), causing stanza 2 to complete before stanza 0.
- **Queue is unordered after retries** — Failed stanzas are re-queued with `unshift()` ([runTranslationTick.ts:229](translalia-web/src/lib/workshop/runTranslationTick.ts#L229)), pushing them to the front, disrupting sequential order.

**3. Method 2 Usage**
- **Method 2 IS used when selected** — [useTranslateLine.ts:34-37](translalia-web/src/lib/hooks/useTranslateLine.ts#L34-L37) correctly routes to `/api/workshop/translate-line-with-recipes` when `translationMethod === "method-2"`.
- **Background pipeline always uses Method 1** — Background processing via `translateLineInternal()` NEVER checks `translationMethod`; it always uses the literalness spectrum approach ([processStanza.ts:167-187](translalia-web/src/lib/workshop/processStanza.ts#L167-L187)).
- **Recipe generation can fail silently** — If recipe generation hits max lock attempts (15), it throws `RECIPE_GENERATION_CONTENTION` ([variantRecipes.ts:774-779](translalia-web/src/lib/ai/variantRecipes.ts#L774-L779)), returning 503 to the client.

---

## A) Translation Entrypoints + Call Graph

### Entrypoint Table

| Entrypoint | Trigger | Model Selection | Method Selection | Writes Where |
|------------|---------|----------------|------------------|--------------|
| **POST /api/workshop/initialize-translations** | User clicks "Let's Get Started" | `guideAnswers.translationModel` → `modelOverride` | Always Method 1 (`translateLineInternal`) | `chat_threads.state.translation_job` |
| **GET /api/workshop/translation-status** (advance=true) | Client polling every 4s | `guideAnswers.translationModel` → `modelOverride` | Always Method 1 (`translateLineInternal`) | `chat_threads.state.translation_job` |
| **POST /api/workshop/translate-line** | User clicks a line (Method 1 selected) | `guideAnswers.translationModel` → `modelOverride` | Method 1 (literalness spectrum) | Returns to client only (not persisted) |
| **POST /api/workshop/translate-line-with-recipes** | User clicks a line (Method 2 selected) | `guideAnswers.translationModel` → `modelOverride` | Method 2 (recipe-driven prismatic) | Returns to client only (not persisted) |

### Evidence: Call Paths

#### 1. Initialize Translations
```
User clicks "Let's Get Started" (GuideRail.tsx:559)
  → handleConfirmWorkshop() (GuideRail.tsx:571)
    → POST /api/workshop/initialize-translations (GuideRail.tsx:613)
      → createTranslationJob() (route.ts:64)
      → runTranslationTick(threadId, { maxProcessingTimeMs: 6000 }) (route.ts:80)
        → processStanza() (runTranslationTick.ts:273)
          → translateLineInternal() (processStanza.ts:167)
            → buildLineTranslationPrompt() (translateLineInternal.ts:161)
            → openai.chat.completions.create() (translateLineInternal.ts:204-223)
            → insertPromptAudit(stage: "workshop-background-translate-line") (processStanza.ts:184)
        → updateTranslationJob() writes to chat_threads.state.translation_job (runTranslationTick.ts:287)
```

**File:** [translalia-web/src/app/api/workshop/initialize-translations/route.ts](translalia-web/src/app/api/workshop/initialize-translations/route.ts)
**Lines 79-83:**
```typescript
let tickResult = null;
if (runInitialTick && job.status !== "completed") {
  tickResult = await runTranslationTick(threadId, {
    maxProcessingTimeMs: 6000,
  });
}
```
**Evidence:** Request blocks for up to 6 seconds running the first tick synchronously.

---

#### 2. Status Polling with Advancement
```
useTranslationJob() polls every 4s (useTranslationJob.ts:92)
  → GET /api/workshop/translation-status?threadId=...&advance=true
    → runTranslationTick(threadId, { maxProcessingTimeMs: 4000 }) (route.ts:59)
      → [same processStanza → translateLineInternal chain]
      → updateTranslationJob() writes to chat_threads.state.translation_job
```

**File:** [translalia-web/src/app/api/workshop/translation-status/route.ts](translalia-web/src/app/api/workshop/translation-status/route.ts)
**Lines 57-62:**
```typescript
let tickResult = null;
if (advance === "true") {
  tickResult = await runTranslationTick(threadId, {
    maxProcessingTimeMs: 4000,
  });
}
```
**Evidence:** Each poll **blocks for 4 seconds** doing work, not just fetching status.

---

#### 3. Interactive Line Translation (Method 1)
```
User clicks line in WorkshopRail
  → useTranslateLine().mutate() (useTranslateLine.ts:29)
    → POST /api/workshop/translate-line (useTranslateLine.ts:37)
      → translateLineInternal() (route.ts:168)
        → openai.chat.completions.create() (translateLineInternal.ts:204-223)
        → insertPromptAudit(stage: "workshop-options") (route.ts:183)
      → Returns LineTranslationResponse (not persisted to DB)
```

**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 34-37:**
```typescript
const endpoint =
  translationMethod === "method-2"
    ? "/api/workshop/translate-line-with-recipes"
    : "/api/workshop/translate-line";
```
**Evidence:** Correctly routes based on `translationMethod` from Zustand store.

---

#### 4. Interactive Line Translation (Method 2)
```
User clicks line in WorkshopRail (when method-2 selected)
  → useTranslateLine().mutate() (useTranslateLine.ts:29)
    → POST /api/workshop/translate-line-with-recipes (useTranslateLine.ts:36)
      → getOrCreateVariantRecipes() (route.ts:158)
        → [Attempts lock acquire with 15 retries, 500ms–8s backoff]
        → generateRecipesLLM() if cache miss (variantRecipes.ts:690)
          → openai.chat.completions.create() (variantRecipes.ts:417-433)
          → [Takes 30–60s for GPT-4o to generate 3 recipes]
      → buildRecipeAwarePrismaticPrompt() (route.ts:211)
      → openai.chat.completions.create() for 3 variants (route.ts:229-245)
      → checkDistinctness() (route.ts:311)
      → regenerateVariant() if needed (route.ts:325)
      → generateAlignmentsParallel() (route.ts:354)
      → insertPromptAudit(stage: "workshop-translate-line-recipes") (route.ts:261)
      → Returns LineTranslationResponse (not persisted to DB)
```

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)
**Lines 155-190:**
```typescript
// Get or create variant recipes (cached per thread + context)
let recipes: VariantRecipesBundle;
try {
  recipes = await getOrCreateVariantRecipes(
    threadId,
    guideAnswers,
    { fullPoem: rawPoem, sourceLanguage, targetLanguage },
    mode
  );
} catch (recipeError: unknown) {
  const message =
    recipeError instanceof Error
      ? recipeError.message
      : String(recipeError);

  // If recipe generation contention, return retryable error
  if (message.includes("RECIPE_GENERATION_CONTENTION")) {
    return NextResponse.json(
      {
        error: "Recipe generation in progress. Please retry.",
        retryable: true,
      },
      { status: 503 }
    );
  }
  // ...
}
```
**Evidence:** Can fail with 503 if lock contention exceeds 15 attempts (60+ seconds).

---

## B) Client Triggers + Polling Overlap Proof

### Client-Side Hooks

#### 1. useTranslationJob (Polling)
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

**Evidence:**
- Polls every 4 seconds (`refetchInterval: 4000`)
- Each poll runs a full translation tick (blocks for 4s)
- **No overlap prevention** — React Query can fire a new request even if previous is still running (default behavior)
- **No cancellation on thread switch** — If user navigates to different thread, old poll can still complete

---

#### 2. useInitializeTranslations (Start Workshop)
**File:** [translalia-web/src/lib/hooks/useTranslationJob.ts](translalia-web/src/lib/hooks/useTranslationJob.ts)
**Lines 51-64:**
```typescript
export function useInitializeTranslations() {
  return useMutation({
    mutationFn: async (
      params: InitializeTranslationsParams
    ): Promise<InitializeTranslationsResponse> =>
      fetchJSON<InitializeTranslationsResponse>(
        "/api/workshop/initialize-translations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      ),
  });
}
```

**Evidence:**
- Fires once when user clicks "Let's Get Started"
- Runs initial tick with 6-second time limit
- **Can overlap with polling** — If user clicks button while polling is active, both requests can run concurrently

---

#### 3. useTranslateLine (Interactive)
**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 29-61:**
```typescript
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
        // ...
      }),
    });
    // ...
  },
});
```

**Evidence:**
- Fires when user clicks a line
- **No debouncing or cancellation** — User can click multiple lines rapidly, stacking requests
- Rate limited to 10 requests/minute per user per thread ([route.ts:49-64](translalia-web/src/app/api/workshop/translate-line/route.ts#L49-L64))

---

### Sequence Diagram: "Let's Get Started" → Polling → Line Click

```
User                 GuideRail           initialize-translations     translation-status      translate-line-with-recipes
 │                      │                          │                        │                         │
 │ Click "Let's Get    │                          │                        │                         │
 │ Started" ──────────>│                          │                        │                         │
 │                      │ POST /initialize────────>│                        │                         │
 │                      │                          │ runTranslationTick()   │                         │
 │                      │                          │ (6s timeout)           │                         │
 │                      │                          │ ─ processStanza(0)     │                         │
 │                      │                          │   └─ translateLineInternal() ← BLOCKS           │
 │                      │<─────── 200 OK ──────────│   (3–5s per line)     │                         │
 │                      │ (after 6s)               │                        │                         │
 │                      │                          │                        │                         │
 │                      │ Start polling (4s)       │                        │                         │
 │                      ├──────────────────────────┼──── GET ?advance=true ─>│                         │
 │                      │                          │                        │ runTranslationTick()   │
 │                      │                          │                        │ (4s timeout)           │
 │                      │                          │                        │ ─ processStanza(1)     │
 │                      │                          │                        │   └─ translateLineInternal() ← BLOCKS
 │                      │<──────────────────────────┼─────── 200 OK ─────────│   (3–5s per line)     │
 │                      │ (after 4s)               │                        │                         │
 │                      │                          │                        │                         │
 │ Click line 5 ───────>│                          │                        │                         │
 │                      ├──────────────────────────┼────────────────────────┼──── POST /translate-line-with-recipes ─>│
 │                      │                          │                        │                         │ getOrCreateVariantRecipes()
 │                      │                          │                        │                         │ ─ Try lock 15x (500ms–8s backoff)
 │                      │                          │                        │                         │ ─ generateRecipesLLM() (30–60s) ← BLOCKS
 │                      │                          │                        │                         │ ─ openai.chat.completions (15–30s)
 │                      │                          │                        │                         │ ─ checkDistinctness()
 │                      │                          │                        │                         │ ─ regenerateVariant() (5–10s)
 │                      │                          │                        │                         │ ─ generateAlignmentsParallel() (5–10s)
 │                      │<──────────────────────────┼────────────────────────┼───────── 200 OK ────────│
 │                      │ (after 60–120s)          │                        │                         │
 │                      │                          │                        │                         │
 │                      │ Poll fires again ────────┼──── GET ?advance=true ─>│                         │
 │                      │ (overlaps with above!)   │                        │ runTranslationTick()   │
 │                      │                          │                        │ (can process stanza 2) │
```

**Overlap Evidence:**
1. Initialize runs 6s tick
2. Polling starts immediately, can fire while initialize is still running
3. User can click a line while polling is active
4. **No request cancellation** — All requests run to completion
5. **Database optimistic locking** prevents corruption but allows concurrent reads ([jobState.ts:104-122](translalia-web/src/lib/workshop/jobState.ts#L104-L122))

---

## C) "Not Truly Async" Proof: Why Requests Stay Open

### 1. OpenAI Calls Per Request

#### initialize-translations
```
runTranslationTick(6s timeout)
  → processStanza(0)
    → translateLineInternal() for line 0  ← 1 OpenAI call (3–5s)
    → translateLineInternal() for line 1  ← 1 OpenAI call (3–5s)
    → [etc for all lines in stanza]
  → processStanza(1) if time remains
    → [more OpenAI calls]
```
**Total:** 1–3 stanzas × 3–5 lines × 3–5s = **9–75 seconds** of cumulative OpenAI calls

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 135-204:**
```typescript
for (let i = 0; i < totalLines; i += 1) {
  const lineText = stanza.lines[i];
  const globalLineIndex = lineOffset + i;
  // ...
  try {
    const lineTranslation = await translateLineInternal({
      threadId,
      lineIndex: globalLineIndex,
      lineText,
      // ...
    });
    // ...
  } catch (error) {
    // ...
  }
}
```
**Evidence:** Sequential `await` in a loop — cannot proceed until each line completes.

---

#### translation-status?advance=true
Same as above but with 4s timeout instead of 6s.

---

#### translate-line-with-recipes
```
getOrCreateVariantRecipes()
  → Lock acquire (15 attempts × 500ms–8s backoff) ← Can take 60s
  → generateRecipesLLM()
    → openai.chat.completions.create()             ← 30–60s for recipe generation
  → patchThreadStateField() to save recipes        ← 100–500ms
→ buildRecipeAwarePrismaticPrompt()
→ openai.chat.completions.create() for 3 variants  ← 15–30s
→ checkDistinctness()
→ regenerateVariant() if needed
  → openai.chat.completions.create()               ← 5–10s
→ generateAlignmentsParallel() (3 alignments)
  → 3× openai.chat.completions.create()            ← 5–10s (parallel)
```
**Total:** 30–60s (recipes) + 15–30s (variants) + 5–10s (regen) + 5–10s (alignments) = **55–110 seconds**

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 665-747:**
```typescript
for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
  // Try atomic lock acquisition
  const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

  if (acquired) {
    try {
      // Generate recipes via LLM
      const newBundle = await generateRecipesLLM(
        guideAnswers,
        poemContext,
        mode,
        contextHash,
        threadId
      );
      // ...
    } finally {
      await lockHelper.release(lockKey);
    }
  }

  // Lock not acquired: wait with exponential backoff
  const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
  const jitter = Math.random() * 500;
  await sleep(backoff + jitter);
  // ...
}
```
**Evidence:** Lock retry loop can add 60+ seconds before even starting recipe generation.

---

### 2. Sequential vs Parallel Processing

#### Sequential (Within a Tick)
**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 260-321:**
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
      // ...
    });
    completed.push(stanzaIndex);
    // ...
  } catch (error: unknown) {
    failed.push(stanzaIndex);
    // ...
  }
}
```
**Evidence:** Stanzas are processed **sequentially** within a tick (one `await processStanza` at a time).

---

#### Concurrent (Across Ticks)
**Multiple polling requests can run overlapping ticks:**
- Poll 1 starts at T=0s, processes stanza 0 (takes 6s)
- Poll 2 starts at T=4s, processes stanza 1 (takes 6s)
- Stanza 1 completes at T=10s, stanza 0 completes at T=6s
- **Result:** Stanza 1 appears ready before stanza 0 in job state

**Evidence:** No global lock prevents concurrent `runTranslationTick()` calls. Optimistic locking only prevents write conflicts ([jobState.ts:212-254](translalia-web/src/lib/workshop/jobState.ts#L212-L254)).

---

### 3. Time Budget Guardrails

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 257-264:**
```typescript
const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
const windowStart = Date.now();

for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);
    continue;
  }
  // ...
}
```
**Evidence:** Time budget only **skips** stanzas, doesn't cancel in-progress work. If stanza 0 takes 7s and timeout is 6s, it still completes.

---

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 302-323:**
```typescript
export function getNextStanzasToProcess(job: TranslationJobState): number[] {
  ensureQueuedCapacity(job);

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
- `maxConcurrent: 5` — Up to 5 stanzas can be "processing" at once (across multiple ticks)
- `maxStanzasPerTick: 2` — Each tick starts at most 2 new stanzas
- No global "only one tick at a time" lock

---

### 4. "advance=true" Behavior

**File:** [translalia-web/src/app/api/workshop/translation-status/route.ts](translalia-web/src/app/api/workshop/translation-status/route.ts)
**Lines 57-62:**
```typescript
let tickResult = null;
if (advance === "true") {
  tickResult = await runTranslationTick(threadId, {
    maxProcessingTimeMs: 4000,
  });
}
```
**Evidence:** `advance=true` means "run a full translation tick and THEN return status." It's not a passive status check.

---

## D) Concurrency + Ordering: Why Later Lines Finish First

### 1. Sequential vs Concurrent

**Within a Tick:** Sequential
**Across Ticks:** Concurrent (no global lock)

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 260-264:**
```typescript
for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);
    continue;
  }
  // ...
  await processStanza({ ... });
}
```
**Evidence:** Loop has `await` — stanzas within a tick cannot overlap.

---

### 2. Stanza Queue Structure

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 148-177:**
```typescript
const queue = chunksToUse.map((_, index) => index);  // [0, 1, 2, 3, ...]

chunksToUse.forEach((chunk, index) => {
  const chunkState: TranslationChunkState = {
    chunkIndex: index,
    status: index === 0 ? "queued" : "pending",  // Only first is "queued"
    linesProcessed: 0,
    totalLines: chunk.lines.length,
    retries: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    lines: [],
  };
  chunkStates[index] = chunkState;
});
```
**Evidence:** Queue starts as `[0, 1, 2, 3, ...]`, but only stanza 0 is "queued". Rest are "pending" until promoted.

---

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 50-74:**
```typescript
function ensureQueuedCapacity(job: TranslationJobState): void {
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  const queuedCount = job.queue.filter(
    (index) => chunkOrStanzaStates[index]?.status === "queued"
  ).length;

  if (queuedCount >= job.maxConcurrent) {
    return;
  }

  let promoted = 0;
  for (const index of job.queue) {
    const stanza = chunkOrStanzaStates[index];
    if (!stanza) continue;

    if (stanza.status === "pending") {
      stanza.status = "queued";
      promoted += 1;
    }

    if (queuedCount + promoted >= job.maxConcurrent) {
      break;
    }
  }
}
```
**Evidence:** Promotes "pending" → "queued" to maintain `maxConcurrent` (5) queued stanzas. **No sequential constraint** — stanza 5 can become queued while stanza 0 is still processing.

---

### 3. Requeue with `unshift()` (Re-Ordering)

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
    // ...
  });
}
```
**Evidence:** Failed or rate-limited stanzas are re-queued at the **front** of the queue, disrupting sequential order.

**Example:**
- Initial queue: `[0, 1, 2, 3]`
- Stanza 0 fails, gets re-queued: `[0, 1, 2, 3]` (already in queue, no change)
- Stanza 2 fails, gets re-queued: `[2, 0, 1, 3]` (moved to front)
- Next tick picks stanza 2, not stanza 0

---

### 4. Stanza → Global Line Mapping

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 73-81:**
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
**Evidence:** Stanza 0 starts at line 0, stanza 1 starts at line 0 + len(stanza0.lines), etc.

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 135-138:**
```typescript
for (let i = 0; i < totalLines; i += 1) {
  const lineText = stanza.lines[i];
  const globalLineIndex = lineOffset + i;
  // ...
}
```
**Evidence:** `globalLineIndex` is computed correctly, but there's no enforcement that line 0 must complete before line 1 is shown.

---

### 5. UI Readiness Order (No Gating)

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

**Evidence:**
- `Object.values(chunkOrStanzaStates)` — **No sorting by chunk/stanza index**
- `forEach((chunk) => chunk.lines.forEach((line) => ...))` — Iterates in object key order (undefined order in JavaScript)
- `setLineTranslation(line.line_number, ...)` — Hydrates lines **as soon as they exist** in job state
- **No gating:** If line 5 is ready but line 0 is not, line 5 will be hydrated and shown

**Explicit Statement:** **No gating exists.** Lines are hydrated in whatever order they appear in the job state, which depends on which stanzas completed first.

---

## E) Method Selection (Method 1 vs Method 2) — Prove It's Actually Used

### 1. User Preference Storage

**File:** [translalia-web/src/store/guideSlice.ts](translalia-web/src/store/guideSlice.ts)
**Field Names:**
- `translationMethod: "method-1" | "method-2"` (stored in Zustand + `chat_threads.state.guide_answers`)
- `viewpointRangeMode: "focused" | "balanced" | "adventurous"` (used by Method 2 for recipe generation)
- `translationModel: "gpt-4o" | "gpt-4o-mini" | "gpt-5" | ...` (used by both methods)

**Evidence from code:**
```typescript
// From useTranslateLine.ts:25-27
const translationMethod = useGuideStore(
  (s) => s.answers.translationMethod ?? "method-1"
);
```

---

### 2. Method Decision Points

#### On "Let's Get Started" (Initialize)
**File:** [translalia-web/src/components/guide/GuideRail.tsx](translalia-web/src/components/guide/GuideRail.tsx)
**Lines 599-620:**
```typescript
// Persist the latest guide answers (including model + method + viewpoint mode)
// before background translations start, so the backend doesn't fall back to
// env defaults (e.g. TRANSLATOR_MODEL=gpt-4o).
await saveMultipleAnswers.mutateAsync({
  threadId,
  updates: useGuideStore.getState().answers,
});

await savePoemState.mutateAsync({
  threadId,
  rawPoem: poem.text,
  stanzas: poem.stanzas,
});

const response = await fetch("/api/workshop/initialize-translations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    threadId,
    runInitialTick: true,
  }),
});
```
**Evidence:**
- `guide_answers` (including `translationMethod`) saved to DB before initializing
- **BUT:** `/api/workshop/initialize-translations` does NOT check `translationMethod`
- Background pipeline ALWAYS uses `translateLineInternal()` (Method 1)

---

#### On Line Click (Interactive)
**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 34-37:**
```typescript
const endpoint =
  translationMethod === "method-2"
    ? "/api/workshop/translate-line-with-recipes"
    : "/api/workshop/translate-line";
```
**Evidence:** **Correctly routes based on user preference.**

---

### 3. Bypass Scenarios

#### Bypass 1: Background Pipeline Ignores Method
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
    modelOverride: selectedModel, // ← Use user-selected model for background translations
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
- `translateLineInternal()` is ALWAYS called (no check for `guideAnswers.translationMethod`)
- `translateLineInternal()` uses literalness spectrum prompts ([workshopPrompts.ts](translalia-web/src/lib/ai/workshopPrompts.ts))
- **Method 2 is NEVER used in background pipeline**

---

#### Bypass 2: Cached Translation Short-Circuit
**File:** [translalia-web/src/lib/workshop/translateLineInternal.ts](translalia-web/src/lib/workshop/translateLineInternal.ts)
**Lines 143-154:**
```typescript
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
- Cache key includes `model` but NOT `method`
- If user switches from Method 1 to Method 2, cached Method 1 result will be returned
- **Silent bypass of Method 2 due to cache hit**

---

#### Bypass 3: Recipe Generation Failure → Fallback
**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 503-507:**
```typescript
} catch (error) {
  console.error("[generateRecipesLLM] Error:", error);
  // Return fallback recipes
  return createFallbackBundle(threadId, mode, contextHash);
}
```
**Evidence:**
- If OpenAI call fails, returns hardcoded fallback recipes
- Still uses Method 2 prompts, but with generic recipes (not LLM-generated)
- **Not a bypass to Method 1**, but Method 2 with degraded quality

---

#### Bypass 4: Lock Contention → 503 Error
**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 774-779:**
```typescript
// Max attempts exceeded: fail fast with retryable error
console.error(
  `[getOrCreateVariantRecipes] Max lock attempts exceeded for thread ${threadId}`
);
throw new Error(
  "RECIPE_GENERATION_CONTENTION: Max lock attempts exceeded. Retry later."
);
```
**Evidence:**
- After 15 failed lock attempts, throws error
- Returns 503 to client ([route.ts:175-182](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L175-L182))
- **User sees error, request fails** (not a silent bypass to Method 1)

---

### 4. If/Else Blocks for Method Selection

**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 29-61:**
```typescript
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to translate line");
    }

    const result: LineTranslationResponse = await response.json();
    return result;
  },
});
```
**Evidence:**
- **Only if/else:** Line 34-37 (`translationMethod === "method-2"` ternary)
- **No other guards** — If `translationMethod` is set, Method 2 WILL be used (unless cache hit or lock contention)

---

## F) Locks + 503 "Max Lock Attempts Exceeded"

### 1. Lock Implementation

**File:** [translalia-web/src/lib/ai/cache.ts](translalia-web/src/lib/ai/cache.ts)
**Lines 84-144:**
```typescript
export const lockHelper = {
  /**
   * Atomic acquire: Redis SET ... NX EX (returns true only if lock acquired)
   */
  async acquire(key: string, ttlSec: number): Promise<boolean> {
    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }
      // SET key "1" NX EX ttlSec - returns "OK" if acquired, null if already exists
      const result = await (
        redis as {
          set: (
            key: string,
            value: string,
            opts: { nx: boolean; ex: number }
          ) => Promise<string | null>;
        }
      ).set(key, "1", { nx: true, ex: ttlSec });
      return result === "OK";
    }

    // DEV ONLY: In-memory fallback (NOT safe for Vercel/serverless!)
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[lockHelper] Using in-memory lock (dev only, not safe for production)"
      );
    }
    const existing = await cacheGet<string>(key);
    if (existing) return false;
    await cacheSet(key, "locked", ttlSec);
    return true;
  },

  /**
   * Explicit release: Redis DEL (MUST be a real delete, not set-to-null)
   */
  async release(key: string): Promise<void> {
    // Production or explicit Redis flag: use Upstash Redis
    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_REDIS_LOCK === "true"
    ) {
      const redis = await getUpstashRedis();
      if (!redis) {
        throw new Error("Redis required for locking in production");
      }
      await (redis as { del: (key: string) => Promise<number> }).del(key);
      return;
    }

    // DEV ONLY: In-memory delete
    await cacheDelete(key);
  },
};
```

**Evidence:**
- **Production:** Uses Upstash Redis with atomic `SET ... NX EX` (safe for serverless)
- **Dev:** Uses in-memory Map (NOT safe for hot reload or multi-instance)
- **TTL:** Lock expires after `LOCK_TTL_SECONDS` (90s for recipe generation)

---

### 2. What Is Locked

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 354-359:**
```typescript
// Constants for lock retry
// Increased to handle worst-case recipe generation (30-60s)
const MAX_LOCK_ATTEMPTS = 15;
const BASE_BACKOFF_MS = 500;
const LOCK_TTL_SECONDS = 90; // Must exceed worst-case generation time
```

**Lock Key Format:**
```typescript
const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;
```
**Example:** `recipe-gen:abc123:balanced:sha256hash`

**What's Protected:**
- Recipe generation for a specific thread + mode + context
- Prevents duplicate LLM calls for the same recipes
- **Does NOT lock:**
  - Other threads
  - Same thread with different mode (focused vs balanced)
  - Translation tick processing
  - Line translations

---

### 3. Lock Acquire/Release Flow

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 665-749:**
```typescript
for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
  // Try atomic lock acquisition
  const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

  if (acquired) {
    try {
      // Double-check DB in case another process just finished
      const freshState = await fetchThreadState(threadId);
      const freshCached = freshState.variant_recipes_v1;
      if (
        freshCached &&
        freshCached.mode === mode &&
        freshCached.contextHash === contextHash
      ) {
        const validated = VariantRecipesBundleSchema.safeParse(freshCached);
        if (validated.success) {
          await cacheSet(memoryCacheKey, validated.data, 3600);
          return validated.data;
        }
      }

      // Generate recipes via LLM
      console.log(
        `[getOrCreateVariantRecipes] Generating recipes for thread ${threadId}, mode ${mode}`
      );
      const newBundle = await generateRecipesLLM(
        guideAnswers,
        poemContext,
        mode,
        contextHash,
        threadId
      );

      // JSONB patch-safe DB update
      const patchResult = await patchThreadStateField(
        threadId,
        ["variant_recipes_v1"],
        newBundle
      );

      if (!patchResult.success) {
        console.error(
          "[getOrCreateVariantRecipes] Failed to persist recipes:",
          patchResult.error
        );
        // Still return the bundle - it's valid, just not persisted
      }

      // Populate memory cache
      await cacheSet(memoryCacheKey, newBundle, 3600);

      return newBundle;
    } finally {
      // CRITICAL: Use explicit DEL, not set-to-null
      await lockHelper.release(lockKey);
    }
  }

  // Lock not acquired: another request is generating
  // Wait with exponential backoff + jitter, then re-check DB
  const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
  const jitter = Math.random() * 500;
  await sleep(backoff + jitter);

  // Check if another request finished while we waited
  const maybeReady = await fetchThreadState(threadId);
  const maybeCached = maybeReady.variant_recipes_v1;
  if (
    maybeCached &&
    maybeCached.mode === mode &&
    maybeCached.contextHash === contextHash
  ) {
    const validated = VariantRecipesBundleSchema.safeParse(maybeCached);
    if (validated.success) {
      await cacheSet(memoryCacheKey, validated.data, 3600);
      return validated.data;
    }
  }
}

// Max attempts exceeded: fail fast with retryable error
console.error(
  `[getOrCreateVariantRecipes] Max lock attempts exceeded for thread ${threadId}`
);
throw new Error(
  "RECIPE_GENERATION_CONTENTION: Max lock attempts exceeded. Retry later."
);
```

**Evidence:**
- **15 attempts** with exponential backoff: 500ms, 1s, 2s, 4s, 8s, 8s, ... (capped at 8s)
- **Total max wait:** ~60+ seconds before throwing error
- **Lock held for:** 30–60s (LLM call) + 100–500ms (DB write) = up to 60s
- **Lock TTL:** 90s (ensures lock expires even if process crashes)

---

### 4. In-Memory Locking Failure Modes

**Dev Environment (In-Memory Locks):**
- **Hot Reload:** Next.js dev server restarts → lock Map is cleared → orphaned locks disappear (can cause duplicate generation)
- **Multiple Instances:** If running multiple dev servers (e.g., Docker + local), each has separate lock Map → no synchronization
- **Race Condition:** Two requests can both call `cacheGet(key)` before either calls `cacheSet(key, "locked")` → both acquire lock

**Production Environment (Upstash Redis):**
- **Atomic:** `SET ... NX EX` is atomic in Redis → safe for serverless
- **TTL:** Lock expires after 90s even if process crashes
- **Contention:** If 10 users click the same line simultaneously, 9 will wait in backoff loop

**File:** [translalia-web/src/lib/ai/cache.ts](translalia-web/src/lib/ai/cache.ts)
**Lines 112-122:**
```typescript
// DEV ONLY: In-memory fallback (NOT safe for Vercel/serverless!)
if (process.env.NODE_ENV !== "test") {
  console.warn(
    "[lockHelper] Using in-memory lock (dev only, not safe for production)"
  );
}
const existing = await cacheGet<string>(key);
if (existing) return false;
await cacheSet(key, "locked", ttlSec);
return true;
```
**Evidence:** Race condition between `cacheGet` and `cacheSet` (not atomic).

---

## G) Prompt Audit Failures (23514 Constraint Violation)

### 1. Schema Constraint

**File:** [docs/dbSummary.json:1543-1544](docs/dbSummary.json#L1543-L1544)
```json
{
  "name": "prompt_audits_stage_check",
  "check": "CHECK ((stage = ANY (ARRAY['workshop-options'::text, 'ai-assist'::text, 'prismatic'::text, 'journey-reflection'::text, 'poem-analysis'::text, 'interview'::text])))"
}
```

**Allowed Values:**
- `workshop-options`
- `ai-assist`
- `prismatic`
- `journey-reflection`
- `poem-analysis`
- `interview`

---

### 2. Violation Source

**File:** [translalia-web/src/server/audit/insertPromptAudit.ts](translalia-web/src/server/audit/insertPromptAudit.ts)
**Lines 9-35:**
```typescript
// Allowed values per prompt_audits_stage_check constraint
const ALLOWED_STAGES = [
  "workshop-options",
  "ai-assist",
  "prismatic",
  "journey-reflection",
  "poem-analysis",
  "interview",
] as const;

type AllowedStage = (typeof ALLOWED_STAGES)[number];

/**
 * Map non-standard stages to allowed values to satisfy DB constraint.
 * Falls back to 'workshop-options' for any workshop-related stage.
 */
function normalizeStage(stage: string): AllowedStage {
  if (ALLOWED_STAGES.includes(stage as AllowedStage)) {
    return stage as AllowedStage;
  }
  // Map workshop-related stages to 'workshop-options'
  if (stage.startsWith("workshop")) {
    return "workshop-options";
  }
  // Default fallback
  return "workshop-options";
}
```

**Evidence:**
- `normalizeStage()` was added to **fix** constraint violations
- All `"workshop-*"` stages are mapped to `"workshop-options"`
- If any code passes a non-workshop stage that's not in `ALLOWED_STAGES`, it gets mapped to `"workshop-options"`

---

### 3. Call Sites

**Call Site 1: translate-line (Method 1)**
**File:** [translalia-web/src/app/api/workshop/translate-line/route.ts](translalia-web/src/app/api/workshop/translate-line/route.ts)
**Lines 180-185:**
```typescript
audit: {
  createdBy: user.id,
  projectId: thread.project_id ?? null,
  stage: "workshop-options",  // ← ALLOWED
},
```
**Evidence:** Uses allowed value, no violation.

---

**Call Site 2: translate-line-with-recipes (Method 2)**
**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)
**Lines 257-272:**
```typescript
insertPromptAudit({
  createdBy: user.id,
  projectId: thread.project_id ?? null,
  threadId,
  stage: "workshop-translate-line-recipes",  // ← NOT ALLOWED (gets normalized)
  provider: "openai",
  model,
  params: {
    lineIndex,
    lineLength: lineText.length,
    method: "p6-p8-recipes",
  },
  promptSystemMasked: auditMask.promptSystemMasked,
  promptUserMasked: auditMask.promptUserMasked,
  responseExcerpt: text.slice(0, 400),
}).catch(() => undefined);
```
**Evidence:**
- Stage: `"workshop-translate-line-recipes"` (NOT in allowed list)
- `normalizeStage()` converts to `"workshop-options"`
- **No constraint violation** due to normalization

---

**Call Site 3: processStanza (Background)**
**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 179-186:**
```typescript
audit:
  auditUserId !== undefined
    ? {
        createdBy: auditUserId,
        projectId: auditProjectId ?? null,
        stage: "workshop-background-translate-line",  // ← NOT ALLOWED (gets normalized)
      }
    : undefined,
```
**Evidence:**
- Stage: `"workshop-background-translate-line"` (NOT in allowed list)
- `normalizeStage()` converts to `"workshop-options"`
- **No constraint violation** due to normalization

---

### 4. Are Failures Blocking?

**File:** [translalia-web/src/server/audit/insertPromptAudit.ts](translalia-web/src/server/audit/insertPromptAudit.ts)
**Lines 82-100:**
```typescript
if (error) {
  // Swallow audit failures to avoid breaking user flows
  if (process.env.NODE_ENV !== "production") {
    console.warn("[insertPromptAudit] failed", {
      error: error.message,
      code: error.code,
    });
  }
  return null;
}
```
**Evidence:**
- Audit failures are **non-blocking**
- Error is logged but swallowed
- Returns `null` instead of throwing
- **Does NOT slow down requests** (no retries)

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)
**Line 272:**
```typescript
}).catch(() => undefined);
```
**Evidence:** Even if `insertPromptAudit()` throws (shouldn't happen), it's caught and ignored.

---

## Proof Index

### Claim 1: Requests take 60–240s because they block doing work
**Evidence:**
- [initialize-translations/route.ts:79-83](translalia-web/src/app/api/workshop/initialize-translations/route.ts#L79-L83) — Blocks for 6s running tick
- [translation-status/route.ts:57-62](translalia-web/src/app/api/workshop/translation-status/route.ts#L57-L62) — Blocks for 4s running tick
- [translate-line-with-recipes/route.ts:155-190](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L155-L190) — Can block 60–120s for recipe generation + variants + alignments
- [processStanza.ts:135-204](translalia-web/src/lib/workshop/processStanza.ts#L135-L204) — Sequential loop with `await` for each line
- [variantRecipes.ts:665-747](translalia-web/src/lib/ai/variantRecipes.ts#L665-L747) — Lock retry loop with exponential backoff

### Claim 2: Later lines finish before earlier ones due to concurrent ticks + reordering
**Evidence:**
- [runTranslationTick.ts:260-321](translalia-web/src/lib/workshop/runTranslationTick.ts#L260-L321) — Sequential within tick, no global lock across ticks
- [runTranslationTick.ts:229](translalia-web/src/lib/workshop/runTranslationTick.ts#L229) — Failed stanzas re-queued with `unshift()`
- [WorkshopRail.tsx:251-283](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L251-L283) — No sorting, no gating on line number
- [jobState.ts:50-74](translalia-web/src/lib/workshop/jobState.ts#L50-L74) — Promotes pending → queued without enforcing sequential order

### Claim 3: Method 2 is used for interactive clicks but not background processing
**Evidence:**
- [useTranslateLine.ts:34-37](translalia-web/src/lib/hooks/useTranslateLine.ts#L34-L37) — Routes to `/translate-line-with-recipes` when `method-2`
- [processStanza.ts:167-187](translalia-web/src/lib/workshop/processStanza.ts#L167-L187) — Always calls `translateLineInternal()` (Method 1)
- [GuideRail.tsx:599-620](translalia-web/src/components/guide/GuideRail.tsx#L599-L620) — Saves `translationMethod` to DB but background ignores it

### Claim 4: Lock contention can cause 60+ second waits or 503 errors
**Evidence:**
- [variantRecipes.ts:354-359](translalia-web/src/lib/ai/variantRecipes.ts#L354-L359) — `MAX_LOCK_ATTEMPTS = 15`, backoff 500ms–8s
- [variantRecipes.ts:774-779](translalia-web/src/lib/ai/variantRecipes.ts#L774-L779) — Throws `RECIPE_GENERATION_CONTENTION` after max attempts
- [cache.ts:112-122](translalia-web/src/lib/ai/cache.ts#L112-L122) — In-memory lock has race condition in dev

### Claim 5: Prompt audit failures are non-blocking
**Evidence:**
- [insertPromptAudit.ts:82-100](translalia-web/src/server/audit/insertPromptAudit.ts#L82-L100) — Swallows errors, returns `null`
- [insertPromptAudit.ts:25-35](translalia-web/src/server/audit/insertPromptAudit.ts#L25-L35) — `normalizeStage()` prevents constraint violations
- [route.ts:272](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts#L272) — `.catch(() => undefined)` on audit call

---

## Risk Matrix

| Component | Latency Risk | Ordering Risk | Method Selection Risk | Mitigation Priority |
|-----------|--------------|---------------|----------------------|---------------------|
| **Status Polling with `advance=true`** | 🔴 **CRITICAL** — Blocks 4s per poll, can stack | 🔴 **CRITICAL** — Overlapping polls process different stanzas | 🟢 Low — Only affects background | **HIGH** — Decouple status from advancement |
| **Recipe Generation** | 🔴 **CRITICAL** — 30–60s LLM call + lock waits | 🟡 Medium — Doesn't affect ordering | 🔴 **CRITICAL** — Can fail with 503 | **HIGH** — Pre-generate or background job |
| **Sequential Line Processing** | 🔴 **CRITICAL** — Cumulative 3–5s per line | 🟡 Medium — Only within stanza | 🟢 Low | **MEDIUM** — Parallelize within stanza |
| **Queue Reordering (`unshift`)** | 🟢 Low | 🔴 **CRITICAL** — Breaks sequential order | 🟢 Low | **HIGH** — Append, don't prepend |
| **UI Hydration (No Gating)** | 🟢 Low | 🔴 **CRITICAL** — Lines shown out of order | 🟢 Low | **MEDIUM** — Add sequential gating or sort |
| **In-Memory Locks (Dev)** | 🟡 Medium — Hot reload clears locks | 🟢 Low | 🟡 Medium — Race condition | **LOW** — Dev-only, use Redis in prod |
| **Cache Key Missing Method** | 🟢 Low | 🟢 Low | 🟡 Medium — Can return wrong method | **LOW** — Add method to cache key |
| **Prompt Audit Normalization** | 🟢 Low — Non-blocking | 🟢 Low | 🟢 Low | **LOW** — Already fixed |

**Legend:**
- 🔴 **CRITICAL** — Directly causes reported issues
- 🟡 **Medium** — Can cause issues under specific conditions
- 🟢 **Low** — Unlikely to cause user-facing issues

---

## Open Questions Remaining

### 1. What is the actual average time per line translation in production?
**Why it matters:** Need to know if 3–5s is realistic or optimistic.
**File to check:** Server logs or APM traces for `translateLineInternal()` duration.

### 2. How often does recipe lock contention cause 503 errors in production?
**Why it matters:** If rare, lock retry might be acceptable. If common, need pre-generation.
**File to check:** Error logs for `RECIPE_GENERATION_CONTENTION` in production.

### 3. Do users actually see lines appearing out of order?
**Why it matters:** UI might be sorting visually even if state is unordered.
**File to check:** [WorkshopRail.tsx](translalia-web/src/components/workshop-rail/WorkshopRail.tsx) render logic (beyond hydration).

### 4. Is there a global rate limit on OpenAI API calls that could cause queueing?
**Why it matters:** If rate limit is per-org not per-user, concurrent users could slow each other.
**File to check:** OpenAI client initialization, rate limit headers in responses.

### 5. Does Next.js serverless deployment spawn multiple instances for concurrent requests?
**Why it matters:** If yes, explains why concurrent ticks happen. If no, need to investigate further.
**File to check:** Vercel deployment logs, function invocation metrics.

---

## Summary of Findings

**Long Waits (60–240s):**
- Root cause: **Synchronous processing in HTTP request handlers**
- Primary culprits: Status polling with `advance=true`, recipe generation with lock contention
- Secondary culprits: Sequential line processing, multiple LLM calls per request

**Out-of-Order Readiness:**
- Root cause: **No sequential gating in UI + concurrent tick processing**
- Primary culprits: WorkshopRail hydration iterates unordered, queue reordering with `unshift()`
- Secondary culprits: No global lock prevents overlapping ticks

**Method Selection:**
- **Method 2 IS used** for interactive line clicks (when selected by user)
- **Method 1 ALWAYS used** for background processing (regardless of user preference)
- **Silent cache bypass** if user switches methods but cache key doesn't include method
- **503 errors** can occur if recipe generation hits max lock attempts

**Prompt Audit Violations:**
- **Already fixed** via `normalizeStage()` function
- Failures are **non-blocking** (logged but swallowed)
- No performance impact

---

**End of Evidence Bundle**
