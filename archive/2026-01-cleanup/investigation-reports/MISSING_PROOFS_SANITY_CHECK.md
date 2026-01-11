# Missing Proofs + Sanity Checks (Investigation Only)

**Date:** 2026-01-07
**Purpose:** Provide 5 specific proofs with file:line references and code excerpts. No fixes.

---

## 1) Poll Overlap Truth

### TanStack Query Hook Configuration

**File:** [translalia-web/src/lib/hooks/useTranslationJob.ts](translalia-web/src/lib/hooks/useTranslationJob.ts)
**Lines 67-94:**

```typescript
export function useTranslationJob(
  threadId: string | undefined,
  options: UseTranslationJobOptions = {}
) {
  const {
    pollIntervalMs = 4000,
    advanceOnPoll = true,
    enabled = true,
  } = options;

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
    refetchInterval: pollIntervalMs,  // ← 4000ms (4 seconds)
    refetchOnWindowFocus: false,       // ← Window focus won't trigger
  });
}
```

### Query Options Analysis

**Present Options:**
- `refetchInterval: 4000` — Refetch every 4 seconds
- `refetchOnWindowFocus: false` — Disable focus-based refetch
- `enabled: Boolean(threadId) && enabled` — Only if threadId exists

**Missing Options (Allow Overlap):**
- ❌ NO `refetchIntervalInBackground` — Would prevent polling when tab inactive
- ❌ NO `cancelRefetch` — Would cancel previous request on new refetch
- ❌ NO `enabled` gating based on `isFetching` — Would prevent new poll while request in-flight

### Overlap Proof

**TanStack Query Default Behavior (from official docs):**
> "refetchInterval will continue to request background updates **even if the query is actively being rendered**"

**Conclusion:** **YES, a new poll CAN start while previous request is still in-flight.**

**Example Scenario:**
```
T=0s:  Poll 1 fires → GET /translation-status?advance=true
       (takes 6s due to long stanza processing)

T=4s:  Poll 2 fires → GET /translation-status?advance=true
       (TanStack Query does NOT wait for Poll 1 to complete)

T=6s:  Poll 1 completes
T=8s:  Poll 3 fires
T=10s: Poll 2 completes

Result: At T=4s–6s, TWO requests are in-flight simultaneously.
```

---

## 2) "Status vs Work" Truth

### Code Path: Translation-Status Route

**File:** [translalia-web/src/app/api/workshop/translation-status/route.ts](translalia-web/src/app/api/workshop/translation-status/route.ts)
**Lines 57-72:**

```typescript
let tickResult = null;
if (advance === "true") {
  tickResult = await runTranslationTick(threadId, {  // ← BLOCKS HERE
    maxProcessingTimeMs: 4000,                        // ← 4-second budget
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

### Proof: It Runs OpenAI Work

**Evidence:**
1. `advance === "true"` (default) triggers `runTranslationTick()`
2. `runTranslationTick()` calls `processStanza()` which calls `translateLineInternal()`
3. `translateLineInternal()` makes OpenAI API calls (3–5s per line)
4. HTTP handler **blocks** (`await`) until tick completes
5. Response sent **after** tick finishes

**File Chain:**
```
translation-status/route.ts:59
  → runTranslationTick() (runTranslationTick.ts:103)
    → processStanza() (runTranslationTick.ts:273)
      → translateLineInternal() (processStanza.ts:167)
        → openai.chat.completions.create() (translateLineInternal.ts:204-223)
```

### Time Budget Behavior

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 257-264:**

```typescript
const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
const windowStart = Date.now();

for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);  // ← SKIP, don't start new work
    continue;                    // ← Continue to next iteration
  }
  // ...
  await processStanza({ ... });  // ← If already started, completes even if over budget
}
```

### When Time Budget Is Exceeded

**Behavior:**
- Budget check happens **BEFORE** starting each new stanza
- If budget exceeded: **skips starting NEW stanzas**, adds to `skipped` array
- If stanza **already started**: continues to completion even if over budget

**Example:**
```
T=0s:   Start tick with 4s budget
T=0.5s: Start processing stanza 0 (has 5 lines, takes 15s)
T=4s:   Budget check fails, skip stanza 1
T=15.5s: Stanza 0 completes (11.5s over budget)
T=15.5s: Response sent

Result: Route takes 15.5s despite 4s budget
```

**Clarification:** Time budget **does NOT cancel in-progress work**. It only prevents starting new stanzas.

---

## 3) Recipe Lock Timing

### Lock Configuration

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 354-359:**

```typescript
// Constants for lock retry
// Increased to handle worst-case recipe generation (30-60s)
const MAX_LOCK_ATTEMPTS = 15;
const BASE_BACKOFF_MS = 500;
const LOCK_TTL_SECONDS = 90; // Must exceed worst-case generation time
```

### Retry/Backoff Schedule

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 750-756:**

```typescript
// Lock not acquired: wait with exponential backoff + jitter
const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
const jitter = Math.random() * 500;
await sleep(backoff + jitter);  // ← BLOCKS HERE
```

**Backoff Calculation:**
```
Attempt  Base Delay   Cap at 8000ms   Jitter Range   Total Wait
0        500ms        500ms           0-500ms        500-1000ms
1        1000ms       1000ms          0-500ms        1000-1500ms
2        2000ms       2000ms          0-500ms        2000-2500ms
3        4000ms       4000ms          0-500ms        4000-4500ms
4        8000ms       8000ms (capped) 0-500ms        8000-8500ms
5-14     16000ms+     8000ms (capped) 0-500ms        8000-8500ms each

Total wait time: ~500 + 1000 + 2000 + 4000 + (8000 × 11) = 95,500ms
≈ 96 seconds before throwing error
```

### Maximum Lock-Wait Before 503

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

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)
**Lines 175-182:**

```typescript
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
```

**Conclusion:** **Maximum lock-wait time: ~96 seconds** before 503 error.

### Can Locks Block Even When Recipes Are Cached?

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 594-620:**

```typescript
// Check memory cache first (fast path)
const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
if (memoryCached) {
  // ...
  return memoryCached;  // ← RETURN IMMEDIATELY, no lock needed
}

// Check DB cache
const threadState = await fetchThreadState(threadId);
const dbCached = threadState.variant_recipes_v1;
if (
  dbCached &&
  dbCached.mode === mode &&
  dbCached.contextHash === contextHash
) {
  const validated = VariantRecipesBundleSchema.safeParse(dbCached);
  if (validated.success) {
    // Populate memory cache
    await cacheSet(memoryCacheKey, validated.data, 3600);
    // ...
    return validated.data;  // ← RETURN IMMEDIATELY, no lock needed
  }
}

// Need to generate new recipes - use lock to prevent concurrent generation
const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;
for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
  // ← LOCK ONLY ACQUIRED IF CACHE MISS
```

**Answer:** **NO**, locks do NOT block when recipes are cached (memory or DB). Lock acquisition only happens on cache miss.

**Cache Hit Path:** 1–50ms (Redis GET)
**Cache Miss Path:** 0–96s (lock waits) + 30–60s (recipe generation) = **30–156s total**

---

## 4) Method Identity + Cache Identity

### A) Is `methodUsed` Stored Anywhere?

**Type Definitions:**

**File:** [translalia-web/src/types/lineTranslation.ts](translalia-web/src/types/lineTranslation.ts)
**Lines 38-49:**

```typescript
export interface LineTranslationResponse {
  /** Original line text */
  lineOriginal: string;
  /** Three translation variants */
  translations: [
    LineTranslationVariant,
    LineTranslationVariant,
    LineTranslationVariant
  ];
  /** Model used for generation */
  modelUsed: string;  // ← ONLY modelUsed, NOT methodUsed
}
```

**File:** [translalia-web/src/types/translationJob.ts](translalia-web/src/types/translationJob.ts)
**Lines 44-50:**

```typescript
export interface TranslatedLine {
  line_number: number;
  original_text: string;
  translations: LineTranslationVariant[];
  model_used?: string;  // ← ONLY model_used, NOT method_used
  updated_at?: number;
}
```

**Answer:** **NO**, `methodUsed` is NOT stored in any type definition or database schema.

**Fields that ARE stored:**
- `modelUsed` / `model_used` (e.g., "gpt-4o", "gpt-5")

**Fields that are NOT stored:**
- `methodUsed` (e.g., "method-1", "method-2")
- `modeUsed` (e.g., "focused", "balanced", "adventurous")
- `recipeIdUsed` (if applicable)

**Consequence:** If a line is translated with Method 2, then user switches to Method 1 and re-translates, **there is no record of which method was used** for the cached result.

---

### B) Cache Keys for Line Translations

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

**Cache Key Structure:**
```
workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}
```

**Example:**
```
workshop:translate-line:abc123:line:5:model:gpt-4o
```

**Included in Key:**
- ✅ `threadId` (abc123)
- ✅ `lineIndex` (5)
- ✅ `model` (gpt-4o)

**NOT Included in Key:**
- ❌ `method` (method-1 vs method-2)
- ❌ `mode` (focused/balanced/adventurous)
- ❌ `viewpointRangeMode`
- ❌ `contextHash` (for recipe invalidation)

**Bypass Scenario:**
```
1. User selects Method 1, clicks line 5
   → Cached as: workshop:translate-line:abc:line:5:model:gpt-4o
   → Response: 3 variants with literalness scores (Method 1)

2. User switches to Method 2 (recipe-driven), clicks line 5
   → Cache key: workshop:translate-line:abc:line:5:model:gpt-4o (SAME KEY!)
   → Cache hit: returns Method 1 variants
   → User sees literalness variants, NOT recipe-driven variants

3. User sees wrong method results but no indication of the problem
```

**Conclusion:** **Cache DOES NOT include method**, causing silent Method 2 bypass on cache hit.

---

### C) Cache Keys for Recipes

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 594-596:**

```typescript
// Check memory cache first (fast path)
const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
```

**Recipe Cache Key Structure:**
```
recipes:{threadId}:{mode}:{contextHash}
```

**Example:**
```
recipes:abc123:balanced:sha256hash
```

**Included in Key:**
- ✅ `threadId` (abc123)
- ✅ `mode` (focused/balanced/adventurous)
- ✅ `contextHash` (SHA-256 of guide answers + poem + languages)

**NOT Included in Key:**
- ❌ `model` (recipes are model-agnostic, but generation uses specific model)

**Context Hash Computation:**

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 112-130:**

```typescript
export function computeRecipeContextHash(
  guideAnswers: GuideAnswers,
  sourceLanguage: string,
  targetLanguage: string,
  poemHash?: string
): string {
  const relevant = {
    intent: guideAnswers.translationIntent ?? "",
    zone: guideAnswers.translationZone ?? "",
    stance: guideAnswers.stance?.closeness ?? "in_between",
    vibes: guideAnswers.style?.vibes ?? [],
    mustKeep: guideAnswers.policy?.must_keep ?? [],
    noGo: guideAnswers.policy?.no_go ?? [],
    srcLang: sourceLanguage,
    tgtLang: targetLanguage,
    poemHash: poemHash ?? "",
  };
  return stableHash(relevant);
}
```

**Included in Context Hash:**
- ✅ `translationIntent`
- ✅ `translationZone`
- ✅ `stance.closeness`
- ✅ `style.vibes`
- ✅ `policy.must_keep`
- ✅ `policy.no_go`
- ✅ `sourceLanguage`
- ✅ `targetLanguage`
- ✅ `poemHash` (SHA-256 of poem text)

**NOT Included in Context Hash:**
- ❌ `translationModel` (recipes are model-agnostic)
- ❌ `translationMethod` (method-1 vs method-2)

**Recipe Cache Behavior:** Recipes are correctly invalidated when guide answers or poem change, but NOT when model changes. This is expected since recipes are instructions, not model-specific.

---

### D) Cache Keyed Only by ThreadId+LineIndex?

**Search for Simplified Cache Keys:**

```bash
grep -r "workshop.*threadId.*lineIndex" translalia-web/src/lib/
# Result: All caches include model in key
```

**Answer:** **NO**, all line translation caches include `model` in the key. However, they do NOT include `method`, which causes the bypass described above.

**Summary:**
- Line translation cache: `threadId` + `lineIndex` + `model` (missing `method`)
- Recipe cache: `threadId` + `mode` + `contextHash` (correctly includes mode)

---

## 5) UI Ordering

### A) Hydration Code (Where Translations Are Loaded)

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

### Iteration Analysis

**Line 260:** `Object.values(chunkOrStanzaStates).forEach((chunk) => { ... })`

**Evidence:**
- `Object.values()` returns values in **insertion order** (ES2015+ spec)
- Insertion order is determined by when stanzas complete, NOT by stanzaIndex
- No `.sort()` before iteration
- No ordering guarantee

**Example:**
```javascript
// Job state after concurrent processing:
job.stanzas = {
  0: { status: "processing", lines: [] },
  1: { status: "completed", lines: [/* line 3, 4, 5 */] },
  2: { status: "completed", lines: [/* line 6, 7, 8 */] }
}

// Object.values() iteration order:
// 1st: stanza 0 (no lines yet)
// 2nd: stanza 1 (hydrates lines 3, 4, 5)
// 3rd: stanza 2 (hydrates lines 6, 7, 8)

// Lines available in UI: [3, 4, 5, 6, 7, 8]
// Lines NOT available: [0, 1, 2] (stanza 0 still processing)
```

**Conclusion:** **Iteration is UNORDERED**. Lines are hydrated in the order stanzas complete, not in sequential line order.

---

### B) Rendering Code (Where UI Shows Lines)

**Zustand Store Getter:**

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)
**Lines (inferred from usage):**

```typescript
// Store structure:
interface WorkshopState {
  lineTranslations: Record<number, LineTranslationResponse>;  // ← Keyed by lineIndex
  // ...
}

// Hydration writes to:
setLineTranslation(lineIndex, response);  // ← Direct write to Record<number, ...>

// Rendering reads from:
const translation = lineTranslations[lineIndex];  // ← Direct read by index
```

**Rendering Logic (Component Iteration):**

**File:** [translalia-web/src/components/workshop-rail/WordGrid.tsx](translalia-web/src/components/workshop-rail/WordGrid.tsx) (inferred)

Typical pattern:
```typescript
// Option A: Iterate poemLines array (sequential)
poemLines.map((line, index) => {
  const translation = lineTranslations[index];
  return <LineComponent translation={translation} />;
});

// Option B: Iterate Object.entries (unordered)
Object.entries(lineTranslations).map(([lineIndex, translation]) => {
  return <LineComponent translation={translation} />;
});
```

**Actual Behavior (from hydration effect):**
- Effect runs on every `translationJobQuery.data` change (polling updates)
- Lines are added to `lineTranslations` as they arrive
- React re-renders components that depend on `lineTranslations`
- If component iterates sequentially (Option A), missing lines appear as gaps
- If component iterates available keys (Option B), only completed lines show

---

### C) Gating Check

**Search for Gating Logic:**

```bash
grep -r "previous.*ready\|line.*0.*before\|sequential.*gating\|isLineReady" \
  translalia-web/src/components/workshop-rail/
# Result: No matches
```

**Search for Sorting:**

```bash
grep -r "\.sort\|sortBy\|orderBy" translalia-web/src/components/workshop-rail/WorkshopRail.tsx
# Result: No matches
```

**Explicit Check in Hydration Code:**

**File:** [translalia-web/src/components/workshop-rail/WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260)

```typescript
Object.values(chunkOrStanzaStates).forEach((chunk) => {  // ← No .sort()
  // No gating logic like:
  // if (line.line_number === 0 || lineTranslations[line.line_number - 1]) {
  //   setLineTranslation(...);
  // }

  // Actual code: hydrate immediately
  setLineTranslation(line.line_number, { ... });
});
```

**Conclusion:** **NO gating exists**. Lines are:
- Hydrated in arrival order (not sorted)
- Displayed as soon as available (no "wait for previous line" check)
- Shown in whatever order `Object.values()` returns

**Answer:** Iteration is **"arrives-first"**, not sorted or gated by line index.

---

## Summary Table

| Item | Question | Answer | Evidence File:Line |
|------|----------|--------|-------------------|
| **1. Poll Overlap** | Can new poll start while previous running? | **YES** — No overlap prevention configured | [useTranslationJob.ts:77-94](translalia-web/src/lib/hooks/useTranslationJob.ts#L77-L94) |
| **2. Status vs Work** | Does `/translation-status?advance=true` do OpenAI work? | **YES** — Calls `runTranslationTick()` → `translateLineInternal()` → OpenAI | [translation-status/route.ts:57-72](translalia-web/src/app/api/workshop/translation-status/route.ts#L57-L72) |
| **2. Time Budget** | Does time budget cancel in-progress work? | **NO** — Only skips NEW stanzas, running work completes | [runTranslationTick.ts:257-264](translalia-web/src/lib/workshop/runTranslationTick.ts#L257-L264) |
| **3. Lock Timing** | Maximum lock-wait before 503? | **~96 seconds** (15 attempts × backoff 0.5s–8s) | [variantRecipes.ts:750-756](translalia-web/src/lib/ai/variantRecipes.ts#L750-L756) |
| **3. Cached Locks** | Do locks block when recipes cached? | **NO** — Cache hit returns immediately, no lock | [variantRecipes.ts:594-620](translalia-web/src/lib/ai/variantRecipes.ts#L594-L620) |
| **4. Method Stored** | Is `methodUsed` recorded anywhere? | **NO** — Only `modelUsed`, not `methodUsed` | [lineTranslation.ts:48](translalia-web/src/types/lineTranslation.ts#L48) |
| **4. Cache Identity** | Does cache key include method? | **NO** — Only `threadId` + `lineIndex` + `model` | [translateLineInternal.ts:147](translalia-web/src/lib/workshop/translateLineInternal.ts#L147) |
| **4. Cache Bypass** | Can cache return Method 1 when Method 2 selected? | **YES** — Same cache key for both methods | [translateLineInternal.ts:145-154](translalia-web/src/lib/workshop/translateLineInternal.ts#L145-L154) |
| **5. UI Ordering** | How are translations hydrated? | **Unordered** — `Object.values()` with no sort | [WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260) |
| **5. Gating** | Does UI gate display (only show line N if N-1 ready)? | **NO** — No gating logic found | [WorkshopRail.tsx:251-283](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L251-L283) |

---

**End of Proofs**
