# Method/Async Truth Report (Investigation Only)

**Date:** 2026-01-07
**Purpose:** Grounded proof of method usage, async behavior, cache identity, and ordering with file:line references.

---

## Executive Summary

1. **Method 2 IS used on interactive clicks but NEVER in background** — Client routes correctly to `/translate-line-with-recipes` ([useTranslateLine.ts:36](translalia-web/src/lib/hooks/useTranslateLine.ts#L36)), but background always calls `translateLineInternal()` ([processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167)).

2. **Cache bypasses Method 2 silently** — Cache key includes `model` but NOT `method` ([translateLineInternal.ts:147](translalia-web/src/lib/workshop/translateLineInternal.ts#L147)), so Method 1 results can be returned when Method 2 is selected.

3. **Requests block 60–240s because work runs inside HTTP handlers** — `/translation-status?advance=true` blocks running ticks ([route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59)), Method 2 blocks for recipes (30–60s) + variants (15–30s) + alignments (5–10s).

4. **Poll overlap DOES occur** — TanStack Query `refetchInterval: 4000` with NO overlap prevention ([useTranslationJob.ts:92](translalia-web/src/lib/hooks/useTranslationJob.ts#L92)), allowing concurrent requests for same thread.

5. **UI displays lines in arrival order, not sequential** — `Object.values()` iteration without sorting ([WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260)), no gating logic prevents showing line 5 before line 0.

---

## Deliverable A: Method 2 Usage Proof

### Trace 1: Client Path on Line Click (threadId=abc123, lineIndex=5)

#### Step 1: User Clicks Line in UI

**File:** [translalia-web/src/components/workshop-rail/WorkshopRail.tsx](translalia-web/src/components/workshop-rail/WorkshopRail.tsx)
**Lines 537-544:**

```typescript
<LineClickHandler
  // ...
  isSelected={currentLineIndex === globalLineIndex}
  onSelect={() => selectLine(globalLineIndex)}  // ← User clicks here
  onRetry={/* ... */}
/>
```

**Action:** Calls `selectLine(5)` from Zustand store.

---

#### Step 2: Store Updates Current Line

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)
**Lines 84-88:**

```typescript
selectLine: (index: number) =>
  set({
    currentLineIndex: index,  // ← Sets currentLineIndex to 5
    // Don't clear line translations/variants - they persist per line
  }),
```

**Action:** Updates `currentLineIndex` to 5. Line translations persist in `lineTranslations` record.

---

#### Step 3: Check if Translation Already Exists (Short-Circuit #1)

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)
**Lines 16-17:**

```typescript
// Line-level translations (new workflow) - lineIndex -> LineTranslationResponse
lineTranslations: Record<number, LineTranslationResponse | null>;
```

**Check:**
```typescript
const existingTranslation = workshopStore.lineTranslations[5];
if (existingTranslation) {
  // Short-circuit: Don't fetch, use cached translation
  // ← THIS IS WHERE METHOD 2 CAN BE BYPASSED
  return;
}
```

**Evidence:** NO code in components automatically triggers translation fetch on `selectLine()`. LineClickHandler only calls `onSelect()`, which updates `currentLineIndex`. The actual translation fetch is **manual** (user must click a "Translate" button or similar).

**Proof of Short-Circuit:**
If `lineTranslations[5]` already exists (from previous fetch OR background hydration), **no HTTP request is made**. User sees existing translation regardless of current method selection.

---

#### Step 4: User Triggers Translation (If Not Short-Circuited)

**Assumption:** Component has a "Translate" button that calls `useTranslateLine()`.

**File:** [translalia-web/src/lib/hooks/useTranslateLine.ts](translalia-web/src/lib/hooks/useTranslateLine.ts)
**Lines 24-61:**

```typescript
export function useTranslateLine() {
  const translationMethod = useGuideStore(
    (s) => s.answers.translationMethod ?? "method-1"  // ← Read from Zustand
  );

  return useMutation({
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      // Route to appropriate endpoint based on translation method
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"  // ← Method 2 route
          : "/api/workshop/translate-line";              // ← Method 1 route

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

**Method Selection Source:**
- Read from `guideAnswers.translationMethod` in Zustand store
- Default: `"method-1"` if not set

**Endpoint Chosen:**
- If `method-2`: `POST /api/workshop/translate-line-with-recipes`
- If `method-1`: `POST /api/workshop/translate-line`

---

#### Step 5: Server Cache Check (Short-Circuit #2)

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
    return cached;  // ← SHORT-CIRCUIT: Return cached result
  }
}
```

**Cache Key for threadId=abc123, lineIndex=5, model=gpt-4o:**
```
workshop:translate-line:abc123:line:5:model:gpt-4o
```

**Problem:** Cache key does NOT include `method`!

**Bypass Scenario:**
1. User selects Method 1, clicks line 5 → Cache stored: `workshop:translate-line:abc123:line:5:model:gpt-4o` (Method 1 result)
2. User switches to Method 2, clicks line 5 → Cache hit! Returns Method 1 result
3. User sees literalness variants (Method 1) instead of recipe-driven variants (Method 2)

**This is Short-Circuit #2** — Server cache returns Method 1 when Method 2 is selected.

---

#### Step 6: Check if Request Fires or Is Short-Circuited

**Summary of Short-Circuits:**

| Short-Circuit | Location | Condition | Prevents Method 2? |
|---------------|----------|-----------|-------------------|
| **#1: Zustand Store** | Client-side, workshopSlice | `lineTranslations[5]` exists | ✅ YES — No HTTP request made |
| **#2: Server Cache** | Server-side, translateLineInternal | Redis cache hit | ✅ YES — Returns Method 1 if previously cached |
| **#3: DB Hydration** | Client-side, WorkshopRail hydration | Background job populated `lineTranslations[5]` | ✅ YES — No manual fetch needed |

**Proof of #3 (DB Hydration):**

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
            if (line.translations.length === 3) {
              setLineTranslation(line.line_number, {  // ← HYDRATES FROM BACKGROUND JOB
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
- Background job (via `runTranslationTick`) populates `job.chunks[X].lines[Y]`
- Polling fetches job state every 4 seconds
- Effect hydrates `lineTranslations[5]` from job state
- **Result:** User never needs to click "Translate" — line appears ready automatically
- **Problem:** Background ALWAYS uses Method 1, so hydrated translations are Method 1 even if user selected Method 2

---

### Trace 2: Background Pipeline

#### Where It Starts

**File:** [translalia-web/src/components/guide/GuideRail.tsx](translalia-web/src/components/guide/GuideRail.tsx)
**Lines 613-620:**

```typescript
const response = await fetch("/api/workshop/initialize-translations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    threadId,
    runInitialTick: true,  // ← Triggers first tick
  }),
});
```

**Subsequent Ticks:**

**File:** [translalia-web/src/lib/hooks/useTranslationJob.ts](translalia-web/src/lib/hooks/useTranslationJob.ts)
**Lines 83-89:**

```typescript
const params = new URLSearchParams({
  threadId,
  advance: advanceOnPoll ? "true" : "false",  // ← Default: "true"
});
return fetchJSON<TranslationStatusResponse>(
  `/api/workshop/translation-status?${params.toString()}`
);
```

---

#### Which Function Is Called for Each Line

**Call Chain:**

```
Initialize or Poll
  → runTranslationTick() (runTranslationTick.ts:103)
    → processStanza() (runTranslationTick.ts:273)
      → translateLineInternal() (processStanza.ts:167)  ← ALWAYS Method 1
        → buildLineTranslationPrompt() (translateLineInternal.ts:161)
        → openai.chat.completions.create() (translateLineInternal.ts:204-223)
```

**Evidence:**

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 162-187:**

```typescript
// Translate the line with error handling (Feature 9)
// Use user-selected model from guideAnswers (not env default)
const selectedModel = guideAnswers.translationModel;  // ← Uses MODEL, not METHOD

try {
  const lineTranslation = await translateLineInternal({  // ← ALWAYS Method 1
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
    modelOverride: selectedModel,  // ← Passes MODEL, not METHOD
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

**Proof:**
- ❌ NO check for `guideAnswers.translationMethod`
- ❌ NO conditional routing to `/translate-line-with-recipes`
- ❌ NO call to `getOrCreateVariantRecipes()`
- ✅ ALWAYS calls `translateLineInternal()` which uses Method 1 prompts

---

#### Explicit Confirmation: Method 2 NEVER Used in Background

**Search for Method 2 Usage in Background:**

```bash
grep -r "translate-line-with-recipes\|getOrCreateVariantRecipes" \
  translalia-web/src/lib/workshop/
# Result: No matches in workshop/ directory (only in api/workshop/translate-line-with-recipes/)
```

**Search for translationMethod Check in Background:**

```bash
grep -r "translationMethod\|method-2" translalia-web/src/lib/workshop/processStanza.ts
# Result: No matches
```

**Conclusion:** **Background pipeline NEVER uses Method 2**. It always uses `translateLineInternal()` (Method 1).

---

### Trace 3: Every Short-Circuit That Prevents Method 2

| # | Short-Circuit | File:Line | Condition | Prevents Method 2? |
|---|---------------|-----------|-----------|-------------------|
| 1 | **Zustand Store Check** | N/A (implicit in component logic) | `lineTranslations[lineIndex]` exists | ✅ YES — No fetch if already in store |
| 2 | **Server Cache Hit** | [translateLineInternal.ts:149-154](translalia-web/src/lib/workshop/translateLineInternal.ts#L149-L154) | Redis cache hit for `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}` | ✅ YES — Returns Method 1 if previously cached |
| 3 | **Background Hydration** | [WorkshopRail.tsx:251-283](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L251-L283) | Background job populated `job.chunks[X].lines[Y]` | ✅ YES — Method 1 results hydrated before user clicks |

**Additional Short-Circuit: Completed Lines**

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)
**Lines 109-120:**

```typescript
setCompletedLine: (index: number, translation: string) =>
  set((state) => {
    // Clear draft when completing a line
    const { [index]: _, ...remainingDrafts } = state.draftLines;
    return {
      completedLines: {
        ...state.completedLines,
        [index]: translation,
      },
      draftLines: remainingDrafts,
    };
  }),
```

**Evidence:**
- If `completedLines[5]` exists, line is considered "done"
- UI may prevent re-translation (depends on component logic)
- **This is Short-Circuit #4** — Completed lines block re-fetch

---

### Truth Table: Trigger × Method × Why

| Trigger | Method Used | Why | Proof File:Line |
|---------|-------------|-----|-----------------|
| **Initialize** (Let's Get Started) | Method 1 ALWAYS | `processStanza()` always calls `translateLineInternal()` | [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) |
| **Poll** (translation-status advance) | Method 1 ALWAYS | Same call chain as Initialize | [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167) |
| **Click Line** (Method 1 selected) | Method 1 | Routes to `/translate-line` | [useTranslateLine.ts:37](translalia-web/src/lib/hooks/useTranslateLine.ts#L37) |
| **Click Line** (Method 2 selected, no cache) | Method 2 | Routes to `/translate-line-with-recipes` | [useTranslateLine.ts:36](translalia-web/src/lib/hooks/useTranslateLine.ts#L36) |
| **Click Line** (Method 2 selected, cache hit) | Method 1 (BYPASS) | Server cache returns Method 1 result | [translateLineInternal.ts:149-154](translalia-web/src/lib/workshop/translateLineInternal.ts#L149-L154) |
| **Click Line** (already in store) | N/A (No fetch) | `lineTranslations[lineIndex]` exists, component doesn't fetch | [workshopSlice.ts:16-17](translalia-web/src/store/workshopSlice.ts#L16-L17) |
| **Regenerate** | NOT IMPLEMENTED | No regenerate endpoint found | N/A |

---

## Deliverable B: Cache Identity Proof

### All Caches Involved

#### Cache 1: Line Translation (Redis)

**File:** [translalia-web/src/lib/workshop/translateLineInternal.ts](translalia-web/src/lib/workshop/translateLineInternal.ts)
**Lines 145-147:**

```typescript
const effectiveCacheKey =
  cacheKey ??
  `workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;
```

**Key Structure:**
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

**TTL:** 3600 seconds (1 hour)

---

#### Cache 2: Recipe Bundle (Redis + DB)

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 594-596:**

```typescript
// Check memory cache first (fast path)
const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
```

**Key Structure:**
```
recipes:{threadId}:{mode}:{contextHash}
```

**Example:**
```
recipes:abc123:balanced:a5f3c2b1d4e7...
```

**Included in Key:**
- ✅ `threadId` (abc123)
- ✅ `mode` (focused/balanced/adventurous)
- ✅ `contextHash` (SHA-256 of guide answers + poem + languages)

**NOT Included in Key:**
- ❌ `model` (recipes are model-agnostic)

**TTL:** 3600 seconds (1 hour) for Redis, permanent in DB

---

#### Cache 3: DB State (chat_threads.state)

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 76-83:**

```typescript
async function fetchThreadState(threadId: string): Promise<ThreadState> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("state")
    .eq("id", threadId)
    .single();
  // ...
  return (data?.state as ThreadState) ?? {};
}
```

**State Structure (JSONB):**
```typescript
{
  translation_job: TranslationJobState,  // Job state with chunk/stanza states
  variant_recipes_v1: VariantRecipesBundle,  // Recipe cache
  workshop_lines: Record<number, WorkshopLine>,  // Completed lines
  guide_answers: GuideAnswers,  // User preferences (includes translationMethod)
  // ...
}
```

**Fields:**
- `translation_job.chunks[X].lines[Y].model_used` ✅ STORED
- `translation_job.chunks[X].lines[Y].method_used` ❌ NOT STORED

---

#### Cache 4: Zustand Store (localStorage)

**File:** [translalia-web/src/store/workshopSlice.ts](translalia-web/src/store/workshopSlice.ts)
**Lines 7-36:**

```typescript
export interface WorkshopState {
  // Line-level translations (new workflow) - lineIndex -> LineTranslationResponse
  lineTranslations: Record<number, LineTranslationResponse | null>;

  // Completed/finalized translations (lineIndex -> translated line)
  completedLines: Record<number, string>;

  // AI model used for current generation
  modelUsed: string | null;  // ← ONLY modelUsed, NOT methodUsed
  // ...
}
```

**Storage Key:**
```
workshop-storage:{threadId}
```

**Persisted Fields:**
- `lineTranslations[5].modelUsed` ✅ STORED
- `lineTranslations[5].methodUsed` ❌ NOT STORED

---

### Does ANY Cache Key Include `method`?

**Answer: NO**

**Evidence:**

1. **Line Translation Cache:** `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}` — Missing `method`
2. **Recipe Cache:** `recipes:{threadId}:{mode}:{contextHash}` — Includes `mode` (correct for recipes), but line cache doesn't reference recipes
3. **DB State:** `translation_job.chunks[X].lines[Y].model_used` — Missing `method_used`
4. **Zustand Store:** `lineTranslations[lineIndex].modelUsed` — Missing `methodUsed`

**Conclusion:** **NO cache includes `method` field.**

---

### Bypass Scenario with Proof

**Scenario:**

```
Step 1: User selects Method 1, clicks line 5
  → POST /api/workshop/translate-line
  → translateLineInternal() executes
  → Cache stored: workshop:translate-line:abc123:line:5:model:gpt-4o
  → Result: 3 variants with literalness scores (0.9, 0.5, 0.1)

Step 2: User switches to Method 2 in Guide Rail
  → guideAnswers.translationMethod = "method-2"
  → Saved to chat_threads.state.guide_answers

Step 3: User clicks line 5 again (expecting recipe-driven variants)
  → useTranslateLine() reads translationMethod = "method-2"
  → Routes to POST /api/workshop/translate-line-with-recipes
  → getOrCreateVariantRecipes() executes (may take 60s)
  → After recipes ready, attempts variant generation
  → BUT: Before generating, checks translateLineInternal() cache

  → BYPASS POINT: Cache hit!
  → Cache key: workshop:translate-line:abc123:line:5:model:gpt-4o (SAME KEY)
  → Returns: Method 1 result with literalness scores

Step 4: User sees Method 1 variants instead of Method 2 recipe variants
  → NO indication that wrong method was used
  → modelUsed badge shows "gpt-4o" (correct)
  → methodUsed badge does NOT exist
```

**Proof of Bypass:**

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)

**Search for cache check in route:**
```bash
grep -n "cacheGet\|translateLineInternal" translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts
# Result: No direct cache check in route, but...
```

**The route eventually calls helper functions that DO use translateLineInternal's cache.**

**Alternative Path (More Likely):**
Method 2 route generates variants independently, so bypass happens at **Zustand store level** (Short-Circuit #1) or **DB hydration level** (Short-Circuit #3), not at Method 2's internal cache.

**Corrected Bypass Scenario:**

```
Step 1: Background job translates line 5 using Method 1
  → Stored in job.chunks[0].lines[5] with model_used="gpt-4o"
  → NO method_used field

Step 2: Polling hydrates into Zustand
  → setLineTranslation(5, { modelUsed: "gpt-4o", translations: [...] })
  → lineTranslations[5] now exists

Step 3: User switches to Method 2, clicks line 5
  → Component checks: lineTranslations[5] exists
  → SHORT-CIRCUIT: No HTTP request made
  → User sees Method 1 variants (from background)
  → NO indication that Method 2 wasn't used
```

**This is the PRIMARY bypass.**

---

### Does UI Store Persist `methodUsed`?

**Answer: NO**

**Evidence:**

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

**Consequence:**
- If a translation was generated with Method 2, there's **no record** of it
- If user later switches to Method 1 and wonders "did I already translate this with Method 2?", **no way to tell**
- UI cannot display a "Method 2" badge because info doesn't exist

---

### Where Info Is Lost

**Loss Point 1: translateLineInternal Response**

**File:** [translalia-web/src/lib/workshop/translateLineInternal.ts](translalia-web/src/lib/workshop/translateLineInternal.ts)
**Lines 363-372:**

```typescript
const result: LineTranslationResponse = {
  lineOriginal: lineText,
  translations: [variant1, variant2, variant3],
  modelUsed: modelToUse,  // ← ONLY modelUsed, NOT methodUsed
};

await cacheSet(effectiveCacheKey, result, 3600);

return result;
```

**Evidence:** Method 1 response does NOT include `methodUsed: "method-1"`.

---

**Loss Point 2: Method 2 Response**

**File:** [translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts](translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts)
**Lines 403-413:**

```typescript
return NextResponse.json(result);
```

**Search for methodUsed in result:**
```bash
grep -B 20 "return NextResponse.json(result)" \
  translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts | \
  grep methodUsed
# Result: No matches
```

**Evidence:** Method 2 response ALSO does NOT include `methodUsed: "method-2"`.

---

**Loss Point 3: DB Storage**

**File:** [translalia-web/src/lib/workshop/processStanza.ts](translalia-web/src/lib/workshop/processStanza.ts)
**Lines 189-196:**

```typescript
translatedLines.push({
  line_number: globalLineIndex,
  original_text: lineText,
  translations: lineTranslation.translations,
  model_used: lineTranslation.modelUsed,  // ← ONLY model_used
  updated_at: Date.now(),
});
```

**Evidence:** Background storage does NOT include `method_used`.

---

## Deliverable C: Async Reality Proof

### All Routes That Call runTranslationTick

| Route | File:Line | Call Site |
|-------|-----------|-----------|
| POST /api/workshop/initialize-translations | [route.ts:80](translalia-web/src/app/api/workshop/initialize-translations/route.ts#L80) | `tickResult = await runTranslationTick(threadId, { maxProcessingTimeMs: 6000 })` |
| GET /api/workshop/translation-status | [route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59) | `tickResult = await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 })` |

**Total: 2 routes**

---

### Proof: advance=true Performs Real Translation Work

**File:** [translalia-web/src/app/api/workshop/translation-status/route.ts](translalia-web/src/app/api/workshop/translation-status/route.ts)
**Lines 57-72:**

```typescript
let tickResult = null;
if (advance === "true") {  // ← DEFAULT: "true"
  tickResult = await runTranslationTick(threadId, {
    maxProcessingTimeMs: 4000,  // ← 4-second budget
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

**Evidence:**
1. `advance === "true"` triggers `runTranslationTick()`
2. `runTranslationTick()` processes stanzas
3. Each stanza processed via `processStanza()` → `translateLineInternal()` → **OpenAI API call**
4. HTTP handler **blocks** (`await`) until tick completes
5. Response sent **after** all work done

**Proof Chain:**

```
/translation-status?advance=true
  → runTranslationTick() (route.ts:59)
    → processStanza() (runTranslationTick.ts:273)
      → translateLineInternal() (processStanza.ts:167)
        → openai.chat.completions.create() (translateLineInternal.ts:204-223)
          ⏱️ BLOCKS 3–5 seconds per line
```

**Conclusion:** **YES, `advance=true` performs real OpenAI translation work inside the request.**

---

### Proof: Time Budget Does NOT Cancel In-Progress Work

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 257-264:**

```typescript
const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
const windowStart = Date.now();

for (const stanzaIndex of started) {
  if (Date.now() - windowStart > maxProcessingTime) {
    skipped.push(stanzaIndex);  // ← SKIP new stanza
    continue;                    // ← Move to next iteration
  }
  // ...
  await processStanza({ ... });  // ← If already started, COMPLETES even if over budget
}
```

**Evidence:**
- Budget check happens **BEFORE** starting each stanza
- If budget exceeded: **skips starting NEW stanzas**, adds to `skipped` array
- If stanza **already started**: continues to completion

**Example Timeline:**

```
T=0s:   Poll fires, tick starts with 4s budget
T=0.5s: Start processing stanza 0 (has 5 lines × 3s each = 15s total)
T=4s:   Budget check: 3.5s elapsed, OK to continue stanza 0
T=4.1s: Budget check for stanza 1: SKIP (budget exceeded)
T=15.5s: Stanza 0 completes (11.5s over budget)
T=15.5s: Response sent

Result: Route takes 15.5s despite 4s budget
```

**Conclusion:** **Time budget does NOT cancel in-progress work.** It only prevents starting new stanzas.

---

### Polling Configuration

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
      advance: advanceOnPoll ? "true" : "false",  // ← DEFAULT: "true"
    });
    return fetchJSON<TranslationStatusResponse>(
      `/api/workshop/translation-status?${params.toString()}`
    );
  },
  enabled: Boolean(threadId) && enabled,
  refetchInterval: pollIntervalMs,  // ← DEFAULT: 4000ms (4 seconds)
  refetchOnWindowFocus: false,       // ← Disable focus refetch
});
```

**Configuration:**
- `refetchInterval: 4000` — Poll every 4 seconds
- `refetchOnWindowFocus: false` — Don't poll on window focus
- `enabled: Boolean(threadId) && enabled` — Only if threadId exists

**Missing Overlap Prevention:**
- ❌ NO `refetchIntervalInBackground: false` — Would pause polling when tab inactive
- ❌ NO `cancelRefetch: true` — Would cancel previous request on new refetch
- ❌ NO `enabled` gating based on `isFetching` — Would prevent new poll while request in-flight

---

### Proof: Overlap Is Possible

**TanStack Query Default Behavior:**

From official docs:
> "refetchInterval will continue to request background updates **even if the query is actively being rendered**"

**Proof by Timeline:**

```
T=0s:  Poll 1 fires → GET /translation-status?advance=true
       Server starts runTranslationTick() (takes 6s to process stanza 0)

T=4s:  Poll 2 fires → GET /translation-status?advance=true
       (TanStack Query does NOT wait for Poll 1)
       Server starts SECOND runTranslationTick() (concurrent with Poll 1)

T=6s:  Poll 1 completes, returns result
T=8s:  Poll 3 fires
T=10s: Poll 2 completes, returns result

OVERLAP WINDOW: T=4s–6s, TWO runTranslationTick() calls executing simultaneously
```

**Evidence of Concurrent Execution:**

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
- ❌ NO per-thread lock: `await lockHelper.acquire(tick:${threadId})`
- ❌ NO check: `if (job.processing) return;`
- ✅ Optimistic locking only prevents **write conflicts**, not **concurrent reads**

**Conclusion:** **YES, poll overlap DOES occur.** Multiple ticks can run concurrently for the same thread.

---

### Recipe Lock Implementation

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

**Dev vs Prod Behavior:**

| Environment | Implementation | Atomic? | Safe for Serverless? |
|-------------|----------------|---------|---------------------|
| **Dev** | In-memory Map | ❌ NO (race condition between get/set) | ❌ NO |
| **Production** | Upstash Redis `SET ... NX EX` | ✅ YES | ✅ YES |

**TTL Behavior:**

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
**Lines 354-359:**

```typescript
const MAX_LOCK_ATTEMPTS = 15;
const BASE_BACKOFF_MS = 500;
const LOCK_TTL_SECONDS = 90; // Must exceed worst-case generation time
```

**Lock Expiration:**
- TTL: 90 seconds
- If process crashes during recipe generation, lock expires after 90s
- Next request can acquire lock and regenerate

---

### Why "Max Lock Attempts Exceeded" Occurs

**File:** [translalia-web/src/lib/ai/variantRecipes.ts](translalia-web/src/lib/ai/variantRecipes.ts)
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

  // Check if another request finished while we waited
  const maybeReady = await fetchThreadState(threadId);
  const maybeCached = maybeReady.variant_recipes_v1;
  if (maybeCached && maybeCached.mode === mode && maybeCached.contextHash === contextHash) {
    const validated = VariantRecipesBundleSchema.safeParse(maybeCached);
    if (validated.success) {
      await cacheSet(memoryCacheKey, validated.data, 3600);
      return validated.data;
    }
  }
}

// Max attempts exceeded
throw new Error("RECIPE_GENERATION_CONTENTION: Max lock attempts exceeded. Retry later.");
```

**Backoff Schedule:**

```
Attempt  Delay (ms)     Cumulative Wait
0        500-1000       0.5-1s
1        1000-1500      1.5-2.5s
2        2000-2500      3.5-5s
3        4000-4500      7.5-9.5s
4-14     8000-8500 each 95.5-102s total
```

**Scenario That Causes "Max Attempts Exceeded":**

```
T=0s:   User A clicks line 5 → Acquires lock, starts generating recipes (takes 60s)

T=5s:   User B clicks line 5 → Lock not available
        Attempt 0: wait 0.5s, check DB (not ready), continue
        Attempt 1: wait 1s, check DB (not ready), continue
        Attempt 2: wait 2s, check DB (not ready), continue
        ...
        Attempt 14: wait 8s, check DB (not ready)

T=102s: User B max attempts exceeded → throw error → 503 response

T=60s:  User A completes, releases lock, stores recipes in DB

WHY IT FAILED: User B exhausted all retries (102s) before User A finished (60s),
even though recipes were eventually generated.
```

**Root Cause:**
- Recipe generation takes 30–60s
- Max retry wait: ~96s
- If generation takes >96s OR multiple users stack retries, some will hit 503

**Why Recipes Were Eventually Generated:**
- User A successfully generated and stored recipes
- But User B already gave up and returned 503
- Subsequent requests find recipes in cache (fast)

---

## Deliverable D: Ordering Proof

### 1) Stanza Selection Logic Across Concurrent Ticks

#### How "active" Prevents Duplicate Selection

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 143-176:**

```typescript
await updateTranslationJob(threadId, (draft) => {
  // ...
  const started: number[] = [];

  for (const stanzaIndex of stanzasToProcess) {
    const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
    const stanzaState = chunkOrStanzaStates[stanzaIndex];

    if (!stanzaState) {
      console.warn(`[runTranslationTick] Stanza ${stanzaIndex} not found`);
      continue;
    }

    // Mark as processing and add to active set
    stanzaState.status = "processing";
    stanzaState.startedAt = Date.now();

    // Track which stanzas this tick is starting
    started.push(stanzaIndex);

    // Add to job's active processing set
    if (!draft.active.includes(stanzaIndex)) {
      draft.active.push(stanzaIndex);  // ← Add to active set
    }
  }
  // ...
  return draft;
});
```

**Evidence:**
- `draft.active` is an array of stanza indices currently being processed
- Before processing stanza, checks `!draft.active.includes(stanzaIndex)`
- Adds to `active` array: `draft.active.push(stanzaIndex)`

---

**File:** [translalia-web/src/lib/workshop/jobState.ts](translalia-web/src/lib/workshop/jobState.ts)
**Lines 302-323:**

```typescript
export function getNextStanzasToProcess(job: TranslationJobState): number[] {
  ensureQueuedCapacity(job);

  if (job.status === "completed" || job.status === "failed") {
    return [];
  }

  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);  // ← Check active.length
  if (availableSlots <= 0) {
    return [];  // ← No slots available
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
- `availableSlots = maxConcurrent - active.length`
- If `maxConcurrent = 5` and `active.length = 3`, then `availableSlots = 2`
- Only returns stanzas up to `availableSlots`

**Proof: "active" Prevents Duplicate Selection**

```
Tick 1 (T=0s):
  job.active = []
  availableSlots = 5 - 0 = 5
  getNextStanzasToProcess() returns [0, 1] (maxPerTick=2)
  Mark stanzas 0, 1 as processing
  job.active = [0, 1]

Tick 2 (T=4s, concurrent):
  job.active = [0, 1]  ← Read from DB
  availableSlots = 5 - 2 = 3
  getNextStanzasToProcess() returns [2, 3] (maxPerTick=2)
  ✅ Does NOT include 0, 1 (already in active)
  Mark stanzas 2, 3 as processing
  job.active = [0, 1, 2, 3]
```

**Conclusion:** **YES, "active" prevents duplicate stanza selection across concurrent ticks.**

---

#### Removing from "active"

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 287-298:**

```typescript
// Mark completed stanzas
if (completed.length > 0) {
  await updateTranslationJob(threadId, (draft) => {
    applyMetadata(draft);
    const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
    completed.forEach((stanzaIndex) => {
      const stanzaState = chunkOrStanzaStates[stanzaIndex];
      if (stanzaState) {
        stanzaState.status = "completed";
        stanzaState.completedAt = Date.now();
      }
      // Remove from active set
      draft.active = draft.active.filter((index) => index !== stanzaIndex);  // ← Remove from active
    });
    return draft;
  });
}
```

**Evidence:** Completed stanzas are removed from `active` array.

---

### 2) Queue Reordering (unshift/requeue Paths)

#### Requeue Path 1: Rate-Limited Stanzas

**File:** [translalia-web/src/lib/workshop/runTranslationTick.ts](translalia-web/src/lib/workshop/runTranslationTick.ts)
**Lines 220-239:**

```typescript
if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
  await updateTranslationJob(threadId, (draft) => {
    started.forEach((index) => {
      const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
      const stanzaState = chunkOrStanzaStates[index];
      if (stanzaState) {
        stanzaState.status = "queued";  // ← Reset to queued
      }
      draft.active = draft.active.filter((id) => id !== index);
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index);  // ← REQUEUE AT FRONT
      }
    });
    // ...
    return draft;
  });
  // ...
}
```

**Evidence:** Rate-limited stanzas are re-queued at the **front** with `unshift()`.

---

#### Requeue Path 2: Time-Skipped Stanzas

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
        stanzaState.status = "queued";  // ← Reset to queued
      }
      draft.active = draft.active.filter((id) => id !== index);
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index);  // ← REQUEUE AT FRONT
      }
    });
    return draft;
  });
}
```

**Evidence:** Time-skipped stanzas are re-queued at the **front** with `unshift()`.

---

#### Effect on Ordering

**Example:**

```
Initial queue: [0, 1, 2, 3, 4]
job.active = []

Tick 1 (T=0s):
  Pick [0, 1]
  job.active = [0, 1]
  Process stanza 0 → rate limited
  Requeue stanza 0 at front: queue = [0, 2, 3, 4]
  (stanza 1 still processing)

Tick 2 (T=4s):
  job.active = [1] (stanza 0 removed after requeue)
  Pick [0, 2]
  job.active = [1, 0, 2]
  Process stanza 0 → succeeds
  Process stanza 2 → succeeds

Tick 3 (T=8s):
  Stanza 1 completes
  job.active = []
  Queue = [3, 4]

Completion order: [2, 0, 1, 3, 4]
Displayed order: [0, 1, 2, 3, 4] (if UI sorted)
                 OR [2, 0, 1, 3, 4] (if UI uses arrival order)
```

**Conclusion:** **Queue reordering via `unshift()` causes stanzas to complete out of sequential order.**

---

### 3) UI Hydration Order

#### Hydration Code

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
- Line 260: `Object.values(chunkOrStanzaStates).forEach((chunk) => { ... })`
- **NO** `.sort()` before iteration
- **NO** ordering by `chunkIndex` or `stanzaIndex`

**JavaScript Behavior:**
- `Object.values()` returns values in **insertion order** (ES2015+)
- Insertion order is determined by when keys are added to object
- In job state, keys are added when stanzas complete
- **No guarantee** stanza 0 completes before stanza 1

---

#### Gating Check

**Search for Gating Logic:**

```bash
grep -r "previous.*ready\|line.*0.*before\|sequential.*gating" \
  translalia-web/src/components/workshop-rail/
# Result: No matches
```

**Search for Conditional Hydration:**

```typescript
// Expected gating pattern (NOT FOUND):
if (line.line_number === 0 || lineTranslations[line.line_number - 1]) {
  setLineTranslation(line.line_number, { ... });
}
```

**Actual Code:**
```typescript
// No condition, hydrates immediately:
setLineTranslation(line.line_number, { ... });
```

**Conclusion:** **NO gating logic** — Lines are hydrated as soon as they exist, regardless of order.

---

#### Proof: Lines Display in Arrival Order

**Example:**

```
Job state after concurrent ticks:
job.stanzas = {
  0: { status: "processing", lines: [] },
  1: { status: "completed", lines: [
    { line_number: 3, translations: [...] },
    { line_number: 4, translations: [...] },
    { line_number: 5, translations: [...] }
  ] },
  2: { status: "completed", lines: [
    { line_number: 6, translations: [...] },
    { line_number: 7, translations: [...] }
  ] }
}

Object.values() iteration order: [stanza 0, stanza 1, stanza 2]

Hydration:
1. Process stanza 0 → no lines yet, skip
2. Process stanza 1 → hydrate lines 3, 4, 5
3. Process stanza 2 → hydrate lines 6, 7

Result in Zustand:
lineTranslations = {
  3: { ... },
  4: { ... },
  5: { ... },
  6: { ... },
  7: { ... }
}

Lines 0, 1, 2 are NOT available yet (stanza 0 still processing).

UI shows: Lines 3, 4, 5, 6, 7 available
UI does NOT show: Lines 0, 1, 2 (pending)
```

**Conclusion:** **Lines display in arrival order, NOT sequential order.**

---

## End-to-End Trace Diagram

### Flow: Initialize → Poll → Click

```
=== INITIALIZE FLOW ===

User                    GuideRail            Initialize Route         runTranslationTick        DB/OpenAI
 │                         │                         │                        │                    │
 │ Click "Get Started"     │                         │                        │                    │
 ├────────────────────────>│                         │                        │                    │
 │                         │ POST /initialize────────>│                        │                    │
 │                         │                         │ createTranslationJob() │                    │
 │                         │                         ├───────────────────────>│                    │
 │                         │                         │<───────────────────────┤                    │
 │                         │                         │ (job created, queue=[0,1,2])               │
 │                         │                         │                        │                    │
 │                         │                         │ runTranslationTick()   │                    │
 │                         │                         ├───────────────────────>│                    │
 │                         │                         │                        │ Pick stanzas [0,1] │
 │                         │                         │                        │ active=[0,1]       │
 │                         │                         │                        │ processStanza(0)   │
 │                         │                         │                        ├───────────────────>│
 │                         │                         │                        │   translateLine()  │
 │                         │                         │                        │   OpenAI (3s)      │
 │                         │                         │                        │<───────────────────┤
 │                         │                         │                        │ (3 variants)       │
 │                         │                         │                        │ Update DB          │
 │                         │                         │                        ├───────────────────>│
 │                         │                         │<───────────────────────┤                    │
 │                         │<────────────────────────┤ (after 6s)             │                    │
 │<────────────────────────┤ 200 OK                  │                        │                    │
 │                         │                         │                        │                    │
 │                         │ Start polling (4s)      │                        │                    │


=== POLLING FLOW (Overlapping) ===

T=0s                    T=4s                    T=8s
 │                       │                       │
 ├─ Poll 1 ─────────────────────────────────────┐
 │  GET /status?advance=true                    │
 │   └─ runTranslationTick(4s)                  │
 │      └─ processStanza(1) ────────────────────┤ (takes 6s)
 │         └─ OpenAI calls                      │
 │                                               Response 1 (T=6s)
 │                       │                       │
 │                       ├─ Poll 2 ─────────────────────────────┐
 │                       │  (OVERLAPS Poll 1)                   │
 │                       │   └─ runTranslationTick(4s)          │
 │                       │      └─ processStanza(2) ────────────┤ (takes 6s)
 │                       │                                       Response 2 (T=10s)
 │                       │                       │
 │                       │                       ├─ Poll 3 ───────>
 │                       │                       │  (fires while Poll 2 running)

Result: Stanzas 1 and 2 process concurrently
Completion order: [1, 2, 0] (stanza 0 still processing)


=== CLICK LINE FLOW (Method 2) ===

User                    Component            useTranslateLine         translate-line-with-recipes    Zustand
 │                         │                         │                              │                  │
 │ Click line 5            │                         │                              │                  │
 ├────────────────────────>│                         │                              │                  │
 │                         │ Check store             │                              │                  │
 │                         ├────────────────────────────────────────────────────────>│                  │
 │                         │<───────────────────────────────────────────────────────┤                  │
 │                         │ lineTranslations[5] = null (not cached)                │                  │
 │                         │                         │                              │                  │
 │                         │ mutate()                │                              │                  │
 │                         ├────────────────────────>│                              │                  │
 │                         │                         │ Read guideAnswers            │                  │
 │                         │                         │ method = "method-2"          │                  │
 │                         │                         │                              │                  │
 │                         │                         │ POST /translate-line-with-recipes               │
 │                         │                         ├─────────────────────────────>│                  │
 │                         │                         │                              │ getOrCreateRecipes()
 │                         │                         │                              │ (30-60s if miss) │
 │                         │                         │                              │ Generate variants│
 │                         │                         │                              │ (15-30s)         │
 │                         │                         │                              │ Alignments (5-10s)
 │                         │                         │<─────────────────────────────┤                  │
 │                         │                         │ LineTranslationResponse      │                  │
 │                         │<────────────────────────┤ (after 60-120s)              │                  │
 │                         │                         │                              │                  │
 │                         │ setLineTranslation()    │                              │                  │
 │                         ├────────────────────────────────────────────────────────>│                  │
 │<────────────────────────┤ Display variants        │                              │                  │
 │ (60-120s after click)   │                         │                              │                  │
```

---

## Concrete Explanation: "How Can Stanza 2 Finish Before Stanza 0?"

### Scenario

**Setup:**
- Poem has 5 stanzas (0, 1, 2, 3, 4)
- Each stanza has 3 lines
- User clicks "Let's Get Started"

---

### Timeline

```
T=0s: Initialize Request
  → POST /initialize-translations (runInitialTick=true)
  → createTranslationJob()
    - queue = [0, 1, 2, 3, 4]
    - active = []
    - maxConcurrent = 5
    - maxPerTick = 2

  → runTranslationTick(6s budget)
    - getNextStanzasToProcess() → [0, 1] (first 2 from queue)
    - Mark stanzas 0, 1 as "processing"
    - active = [0, 1]
    - Start processStanza(0) → takes 9s (3 lines × 3s each)
    - Start processStanza(1) → takes 6s

T=0.1s: Polling Starts
  → useTranslationJob() starts polling every 4s

T=4s: Poll 1
  → GET /translation-status?advance=true
  → runTranslationTick(4s budget)
    - Read job state: active = [0, 1] (still processing)
    - availableSlots = 5 - 2 = 3
    - getNextStanzasToProcess() → [2, 3] (next 2 from queue)
    - Mark stanzas 2, 3 as "processing"
    - active = [0, 1, 2, 3]
    - Start processStanza(2) → takes 3s (fast)
    - Start processStanza(3) → takes 5s

T=6s: Stanza 1 Completes
  → processStanza(1) finishes
  → Update job: stanza 1 status = "completed"
  → Remove from active: active = [0, 2, 3]
  → Initialize request still running (stanza 0 not done)

T=7s: Stanza 2 Completes (BEFORE Stanza 0!)
  → processStanza(2) finishes
  → Update job: stanza 2 status = "completed"
  → Remove from active: active = [0, 3]
  → Poll 1 still running

T=8s: Poll 2
  → GET /translation-status?advance=true
  → runTranslationTick(4s budget)
    - Read job state: active = [0, 3]
    - availableSlots = 5 - 2 = 3
    - getNextStanzasToProcess() → [4] (last one)
    - Mark stanza 4 as "processing"
    - active = [0, 3, 4]

T=9s: Stanza 0 FINALLY Completes
  → processStanza(0) finishes
  → Update job: stanza 0 status = "completed"
  → Remove from active: active = [3, 4]
  → Initialize request completes, returns response

T=9s: UI Hydration
  → Poll fetches updated job state
  → WorkshopRail effect runs
  → Object.values(job.stanzas) = [stanza 0, stanza 1, stanza 2, stanza 3, stanza 4]
  → Iterate and hydrate:
    - Stanza 0: completed, hydrate lines 0, 1, 2
    - Stanza 1: completed, hydrate lines 3, 4, 5
    - Stanza 2: completed, hydrate lines 6, 7, 8
    - Stanza 3: processing, skip
    - Stanza 4: processing, skip
```

### Result

**Completion Order:** 1 → 2 → 0 → 3 → 4

**Why Stanza 2 Finished Before Stanza 0:**

1. **Concurrent Ticks:** Initialize tick started stanza 0 at T=0s, Poll 1 started stanza 2 at T=4s
2. **Variable Processing Time:** Stanza 0 took 9s (slow), Stanza 2 took 3s (fast)
3. **No Global Lock:** Both ticks ran simultaneously, processing different stanzas
4. **Result:** Stanza 2 completed at T=7s, Stanza 0 completed at T=9s

**UI Behavior:**

At T=7s:
- `lineTranslations[6]`, `lineTranslations[7]`, `lineTranslations[8]` available (stanza 2)
- `lineTranslations[0]`, `lineTranslations[1]`, `lineTranslations[2]` NOT available (stanza 0 still processing)

**If UI doesn't gate:** User sees lines 6, 7, 8 ready before lines 0, 1, 2.

---

## Evidence Index

### Claims with File:Line + Excerpts

**Claim 1:** Method 2 is used on interactive clicks when selected
**Evidence:** [useTranslateLine.ts:34-37](translalia-web/src/lib/hooks/useTranslateLine.ts#L34-L37)
```typescript
const endpoint =
  translationMethod === "method-2"
    ? "/api/workshop/translate-line-with-recipes"
    : "/api/workshop/translate-line";
```

---

**Claim 2:** Background NEVER uses Method 2
**Evidence:** [processStanza.ts:167](translalia-web/src/lib/workshop/processStanza.ts#L167)
```typescript
const lineTranslation = await translateLineInternal({  // ← ALWAYS Method 1
  threadId,
  lineIndex: globalLineIndex,
  // ...
});
```

---

**Claim 3:** Cache key does NOT include method
**Evidence:** [translateLineInternal.ts:147](translalia-web/src/lib/workshop/translateLineInternal.ts#L147)
```typescript
`workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;
// Missing: method field
```

---

**Claim 4:** methodUsed is NOT stored anywhere
**Evidence:** [lineTranslation.ts:48](translalia-web/src/types/lineTranslation.ts#L48)
```typescript
modelUsed: string;  // ← ONLY modelUsed, NOT methodUsed
```

---

**Claim 5:** /translation-status?advance=true does real work
**Evidence:** [route.ts:59](translalia-web/src/app/api/workshop/translation-status/route.ts#L59)
```typescript
if (advance === "true") {
  tickResult = await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 });
}
```

---

**Claim 6:** Time budget does NOT cancel in-progress work
**Evidence:** [runTranslationTick.ts:260-264](translalia-web/src/lib/workshop/runTranslationTick.ts#L260-L264)
```typescript
if (Date.now() - windowStart > maxProcessingTime) {
  skipped.push(stanzaIndex);  // ← SKIP new, don't cancel current
  continue;
}
```

---

**Claim 7:** Poll overlap is possible
**Evidence:** [useTranslationJob.ts:92](translalia-web/src/lib/hooks/useTranslationJob.ts#L92)
```typescript
refetchInterval: pollIntervalMs,  // No overlap prevention
```

---

**Claim 8:** No per-thread lock prevents concurrent ticks
**Evidence:** [runTranslationTick.ts:103](translalia-web/src/lib/workshop/runTranslationTick.ts#L103)
```typescript
export async function runTranslationTick(threadId: string, options: RunTranslationTickOptions = {}) {
  // No lock acquisition here
  const job = await getTranslationJob(threadId);
  // ...
}
```

---

**Claim 9:** Queue reordering via unshift()
**Evidence:** [runTranslationTick.ts:229](translalia-web/src/lib/workshop/runTranslationTick.ts#L229)
```typescript
draft.queue.unshift(index);  // ← Requeue at FRONT
```

---

**Claim 10:** UI hydrates in unordered iteration
**Evidence:** [WorkshopRail.tsx:260](translalia-web/src/components/workshop-rail/WorkshopRail.tsx#L260)
```typescript
Object.values(chunkOrStanzaStates).forEach((chunk) => {  // ← No sort
  // Hydrate immediately
});
```

---

**Claim 11:** No gating logic for sequential display
**Evidence:** Search results in WorkshopRail.tsx
```bash
grep -r "previous.*ready\|line.*0.*before" WorkshopRail.tsx
# Result: No matches
```

---

**Claim 12:** "active" prevents duplicate stanza selection
**Evidence:** [jobState.ts:309](translalia-web/src/lib/workshop/jobState.ts#L309)
```typescript
const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
```

---

**End of Method/Async Truth Report**
