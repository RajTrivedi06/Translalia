# EVIDENCE_PACK_FINAL

## Executive Summary (10 lines max)

- Background translation always runs Method 1 via `translateLineInternal` and `buildLineTranslationPrompt`; Method 2 is only used for direct line clicks routed to `/translate-line-with-recipes`.
- UI readiness is driven by `lineTranslations` hydration (background job + persisted store), which can bypass Method 2 clicks when data already exists.
- Long waits (60–240s) are consistent with in-request OpenAI work plus recipe lock backoff and alignment generation, but **no runtime timings are logged yet**.
- Polling every 4s (`translation-status?advance=true`) can start new ticks while prior ticks are still running; there is no global lock.
- Ordering can appear out-of-order due to concurrent ticks, queue reordering (`unshift`/requeue), and unordered hydration via `Object.values`.
- Cache identity does not include method; Method 1 cache + store hydration can mask Method 2.

## Truth Table (Triggers -> Endpoint -> Method -> Model -> Storage)

| Trigger | Endpoint | Method Requested | Method Actually Used | Model Used | Where Stored |
| --- | --- | --- | --- | --- | --- |
| Click "Let's Get Started" | `POST /api/workshop/initialize-translations` | N/A (background) | Method 1 (`translateLineInternal` + `buildLineTranslationPrompt`) | `guideAnswers.translationModel` or fallback in `translateLineInternal` | `chat_threads.state.translation_job` via `updateStanzaStatus`; hydrates client `lineTranslations` |
| Poll tick | `GET /api/workshop/translation-status?advance=true` | N/A (background) | Method 1 (`translateLineInternal`) | `guideAnswers.translationModel` or fallback | `chat_threads.state.translation_job`; hydrates client `lineTranslations` |
| Click line (Method 1) | `POST /api/workshop/translate-line` | Method 1 | Method 1 (`translateLineInternal`) | `guideAnswers.translationModel` or fallback | Response to client; stored in Zustand `lineTranslations`; Redis line cache |
| Click line (Method 2) | `POST /api/workshop/translate-line-with-recipes` | Method 2 | Method 2 (recipes + variants + alignments) | `guideAnswers.translationModel` for variants; alignments use `gpt-4o-mini` | Response to client; stored in Zustand `lineTranslations`; recipes cached in memory + DB |

## Evidence for Method Routing Decisions (File:Line)

UseTranslateLine endpoint selection:
- translalia-web/src/lib/hooks/useTranslateLine.ts:34-37
```
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";
```

WordGrid skip conditions:
- translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```
- translalia-web/src/components/workshop-rail/WordGrid.tsx:229-237
```
    const requestKey = `${thread}:${currentLineIndex}`;
    if (inFlightRequestRef.current === requestKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[WordGrid] Duplicate request blocked for line ${currentLineIndex}`
        );
      }
      return;
    }
```

Background method choice (Method 1 prompt builder):
- translalia-web/src/lib/workshop/processStanza.ts:166-173
```
      const lineTranslation = await translateLineInternal({
        threadId,
        lineIndex: globalLineIndex,
        lineText,
        fullPoem: rawPoem,
        stanzaIndex,
```
- translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
```
  const prompt = fallbackMode
    ? null
    : buildLineTranslationPrompt({
        lineText,
        lineIndex,
        prevLine: prevLine ?? null,
        nextLine: nextLine ?? null,
        fullPoem,
        stanzaIndex,
        position,
        guideAnswers,
        sourceLanguage,
        targetLanguage,
      });
```

## Flow Traces (4)

### 1) Start workshop (Guide -> background Method 1)
1. GuideRail triggers initialization: translalia-web/src/components/guide/GuideRail.tsx:657-677
2. initialize-translations runs a tick: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
3. Tick calls processStanza: translalia-web/src/lib/workshop/runTranslationTick.ts:272-284
4. processStanza calls translateLineInternal: translalia-web/src/lib/workshop/processStanza.ts:166-173
5. translateLineInternal builds Method 1 prompt: translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
6. Results are stored in job state and later hydrated into `lineTranslations`: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311

### 2) Poll tick (advance=true)
1. Client polls every 4s: translalia-web/src/lib/hooks/useTranslationJob.ts:67-94
2. Server runs `runTranslationTick` inside handler: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
3. Tick processes stanzas sequentially per tick: translalia-web/src/lib/workshop/runTranslationTick.ts:260-286
4. UI hydrates any completed lines: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:293-304

### 3) Click line Method 1
1. Endpoint selection in client: translalia-web/src/lib/hooks/useTranslateLine.ts:34-37
2. Server handler calls `translateLineInternal`: translalia-web/src/app/api/workshop/translate-line/route.ts:166-185
3. Response stored into Zustand `lineTranslations`: translalia-web/src/components/workshop-rail/WordGrid.tsx:245-258

### 4) Click line Method 2
1. Endpoint selection in client: translalia-web/src/lib/hooks/useTranslateLine.ts:34-37
2. Server handler generates recipes + variants + alignments:
   - recipes: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-167
   - variants OpenAI call: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
   - alignments: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:349-359
3. Response stored into Zustand `lineTranslations`: translalia-web/src/components/workshop-rail/WordGrid.tsx:245-258

## Latency Accounting (Modeled From Code; Runtime Logs Missing)

### In-request OpenAI work (proof)
- initialize-translations: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
- translation-status?advance=true: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
- translate-line: translalia-web/src/app/api/workshop/translate-line/route.ts:166-185
- translate-line-with-recipes: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-359

### Modeled timing sources (not measured)
- Tick budget: `maxProcessingTimeMs` 6s (initialize) / 4s (poll) but budget only skips *new* stanzas; does not cancel in-flight work (see loop check): translalia-web/src/lib/workshop/runTranslationTick.ts:257-264
```
  const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
  const windowStart = Date.now();

  for (const stanzaIndex of started) {
    if (Date.now() - windowStart > maxProcessingTime) {
      skipped.push(stanzaIndex);
      continue;
    }
```
- Recipe lock wait can exceed 60s (15 attempts with backoff): translalia-web/src/lib/ai/variantRecipes.ts:662-668, 751-755
- Recipe generation OpenAI call (duration unknown): translalia-web/src/lib/ai/variantRecipes.ts:415-433
- Variants generation OpenAI call (duration unknown): translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
- Alignments: 3 OpenAI calls in parallel, awaited: translalia-web/src/lib/ai/alignmentGenerator.ts:125-140

### Why 60–240s waits are plausible (modeled, not measured)
- Lock backoff upper bound is ~95s plus jitter before recipe generation even starts.
- Recipe generation and variants are full OpenAI calls (no timeouts in code).
- Alignments adds 3 more OpenAI calls per line.
- Combined sequential awaits can push total wall time well beyond a minute.

## Concurrency Proof (Measured Logs Missing; Code Indicates Overlap Is Possible)

### Multiple endpoints can start `runTranslationTick`
- initialize-translations: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
- translation-status?advance=true: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
- requeue-stanza (optional immediate tick): translalia-web/src/app/api/workshop/requeue-stanza/route.ts:117-121
- retry-stanza (optional immediate tick): translalia-web/src/app/api/workshop/retry-stanza/route.ts:157-160

### No global lock; only optimistic versioning on write
- translalia-web/src/lib/workshop/jobState.ts:212-242
```
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await fetchThreadState(threadId);
    const current = state.translation_job;
    ...
    const updated = updater(jobClone);
    ...
    try {
      await writeThreadState(threadId, nextState, current.version);
      return updated;
```

### Poll config (no explicit overlap prevention)
- translalia-web/src/lib/hooks/useTranslationJob.ts:67-94
```
  return useQuery({
    queryKey: ["translation-job", threadId, advanceOnPoll],
    ...
    refetchInterval: pollIntervalMs,
    refetchOnWindowFocus: false,
  });
```
- translalia-web/src/components/providers.tsx:7-9 (default QueryClient, no overrides)

Measured overlap status: **Unknown** (no runtime logs present). See Open Questions.

## Ordering Proof (Why Later Lines Can Appear Ready First)

### Stanza selection order per tick
- translalia-web/src/lib/workshop/jobState.ts:309-322
```
  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  ...
  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
```

### Concurrent ticks allow different stanzas in parallel
- Multiple endpoints call `runTranslationTick` (see Concurrency section) with no lock.

### Queue mutations that reorder work
- Rate-limit requeue (front): translalia-web/src/lib/workshop/runTranslationTick.ts:218-230
- Time-budget skip requeue (front): translalia-web/src/lib/workshop/runTranslationTick.ts:324-336
- Manual requeue places stanza at front: translalia-web/src/app/api/workshop/requeue-stanza/route.ts:104-108

### UI hydration does not sort
- translalia-web/src/components/workshop-rail/WorkshopRail.tsx:293-304
```
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
      if (chunk.lines && Array.isArray(chunk.lines)) {
        chunk.lines.forEach((line) => {
          if (line.translations && line.translations.length > 0) {
            if (line.line_number !== undefined) {
              ...
              setLineTranslation(line.line_number, {
```

## Cache Bypass Proof (Method 1 Masking Method 2)

### Method 1 line cache (no method in key)
- translalia-web/src/lib/workshop/translateLineInternal.ts:142-147
```
  const requestedModel = modelOverride ?? TRANSLATOR_MODEL;
  const effectiveCacheKey =
    cacheKey ??
    `workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;
```
- translalia-web/src/lib/workshop/translateLineInternal.ts:149-152 (cache hit returns)

### Background hydration -> `lineTranslations` -> WordGrid skip
- Background hydration: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
- WordGrid skip: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227

### Persisted hydration can also bypass method choice
- translalia-web/src/store/workshopSlice.ts:214-265
```
  merge: (persisted, current) => {
    ...
    return {
      ...current,
      ...
      lineTranslations: p.lineTranslations ?? current.lineTranslations,
      selectedVariant: p.selectedVariant ?? current.selectedVariant,
      hydrated: true,
```

## Where UI Values Come From (Model Used)

### modelUsed displayed in UI
- translalia-web/src/components/workshop-rail/WordGrid.tsx:275-280
```
  const currentLineTranslation =
    currentLineIndex !== null ? lineTranslations[currentLineIndex] : null;
  const currentSelectedVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;
  const badgeModelUsed = currentLineTranslation?.modelUsed ?? modelUsed;
```

### modelUsed set from response
- translalia-web/src/components/workshop-rail/WordGrid.tsx:245-258
```
        onSuccess: (data) => {
          setLineTranslation(currentLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
```
- Background hydration uses `line.model_used`: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:300-309

### Fallback model in Method 1 (can differ from requested)
- translalia-web/src/lib/workshop/translateLineInternal.ts:224-238 (fallback to gpt-4o-mini)

## Open Questions (<=5)

1) Do translation-status polls overlap in-flight requests for the same thread?
   - Why not proven: No runtime logs in repo; no timestamps for overlapping requests.
   - What to log: Add start/end logs in `translation-status/route.ts` with `threadId`, `requestId`, `startTs`, `endTs`.

2) Actual wall-time breakdown for Method 2 (recipes vs variants vs alignments)?
   - Why not proven: No timing logs for substeps.
   - What to log: Measure `getOrCreateVariantRecipes`, variants OpenAI call, and `generateAlignmentsParallel` in `translate-line-with-recipes/route.ts`.

3) Cache hit rates (line cache, recipe memory/db, recipe lock wait)?
   - Why not proven: Cache events are not logged.
   - What to log: In `translateLineInternal.ts` and `variantRecipes.ts`, log cache hit/miss and lock wait duration.

4) One concrete threadId example showing Method 2 selection and bypass?
   - Why not proven: No runtime logs with threadId/endpoint.
   - What to log: Client-side endpoint selection in `useTranslateLine.ts` plus server logs in both endpoints.

## What We Will Fix Later (No Implementation)

1) Make background translation respect the user-selected method/model.
2) Include method identity in cache keys and store `methodUsed` explicitly.
3) Stop polling from doing work (set `advance=false`) or prevent overlapping ticks.
4) Add UI gating/prioritization for earliest stanza/line readiness.
