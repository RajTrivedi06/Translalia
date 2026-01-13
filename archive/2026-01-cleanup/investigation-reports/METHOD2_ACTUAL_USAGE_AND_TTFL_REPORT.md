# METHOD2_ACTUAL_USAGE_AND_TTFL_REPORT

## Proven

### Part A. Method 2 actual usage and entry points

Claim: /api/workshop/translate-line (Method 1) calls translateLineInternal, which builds a prompt with buildLineTranslationPrompt and calls OpenAI.
Evidence: translalia-web/src/app/api/workshop/translate-line/route.ts:166-185
```
    const result = await translateLineInternal({
      threadId,
      lineIndex,
      lineText,
      fullPoem: rawPoem,
      stanzaIndex: actualStanzaIndex,
      prevLine,
      nextLine,
      guideAnswers,
      sourceLanguage: poemAnalysis.language || "the source language",
      targetLanguage,
      modelOverride: model,
      audit: {
        createdBy: user.id,
        projectId: thread.project_id ?? null,
        stage: "workshop-options",
      },
    });
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
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
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
    if (isGpt5) {
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } else {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
```
Evidence: translalia-web/src/lib/ai/workshopPrompts.ts:350-369
```
export function buildLineTranslationPrompt(params: {
  lineText: string;
  lineIndex: number;
  prevLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  stanzaIndex?: number;
  position?: { isFirst: boolean; isLast: boolean; isOnly: boolean };
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  targetLanguage: string;
}): { system: string; user: string } {
```

Claim: /api/workshop/translate-line-with-recipes (Method 2) generates recipes (OpenAI), builds a recipe-aware prompt, calls OpenAI for variants, and calls OpenAI for alignments.
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-167
```
    const mode: ViewpointRangeMode =
      guideAnswers.viewpointRangeMode ?? "balanced";

    // Get or create variant recipes (cached per thread + context)
    let recipes: VariantRecipesBundle;
    try {
      recipes = await getOrCreateVariantRecipes(
        threadId,
        guideAnswers,
        {
          fullPoem: rawPoem,
          sourceLanguage,
          targetLanguage,
        },
        mode
      );
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:401-406
```
  const systemPrompt = buildRecipeGenerationSystemPrompt();
  const userPrompt = buildRecipeGenerationUserPrompt(
    guideAnswers,
    poemContext,
    mode
  );
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:415-433
```
    const completion = isGpt5
      ? await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        })
      : await openai.chat.completions.create({
          model: modelToUse,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:209-216
```
    const { system: systemPrompt, user: userPrompt } =
      buildRecipeAwarePrismaticPrompt({
        sourceText: lineText,
        recipes,
        personality,
        context: contextStr,
      });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
```
    try {
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:349-359
```
    // Generate word-level alignments for all variants (in parallel)
    const variantTexts = variants.map((v) => v.text);
    let alignments: AlignedWord[][];

    try {
      alignments = await generateAlignmentsParallel(
        lineText,
        variantTexts,
        sourceLanguage,
        targetLanguage
      );
```
Evidence: translalia-web/src/lib/ai/alignmentGenerator.ts:65-73
```
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0, // Deterministic for consistency
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
```
Evidence: translalia-web/src/lib/ai/workshopPrompts.ts:1078-1086
```
export function buildRecipeAwarePrismaticPrompt(params: {
  sourceText: string;
  recipes: VariantRecipesBundle;
  personality: TranslatorPersonality;
  currentTranslation?: string;
  context?: string;
}): { system: string; user: string } {
```

Claim: Background pipeline generates 3 variants via translateLineInternal (Method 1 prompt builder) and OpenAI.
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:272-284
```
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
```
Evidence: translalia-web/src/lib/workshop/processStanza.ts:135-168
```
  for (let i = 0; i < totalLines; i += 1) {
    const lineText = stanza.lines[i];
    const globalLineIndex = lineOffset + i;
    ...
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
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
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
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
    if (isGpt5) {
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } else {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
```

Claim: /api/workshop/translate-line-with-recipes does NOT call translateLineInternal; it uses OpenAI directly in the handler.
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:1-18
```
import { requireUser } from "@/lib/auth/requireUser";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import { openai } from "@/lib/ai/openai";
import {
  getOrCreateVariantRecipes,
  type ViewpointRangeMode,
  type VariantRecipesBundle,
} from "@/lib/ai/variantRecipes";
import { buildRecipeAwarePrismaticPrompt } from "@/lib/ai/workshopPrompts";
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
```
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
```

### Part A. Cache identity and method 2 routing details

Claim: translateLineInternal cache key includes threadId, lineIndex, and model only (no method, recipe label, mode, or contextHash).
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:142-147
```
  const requestedModel = modelOverride ?? TRANSLATOR_MODEL;
  const effectiveCacheKey =
    cacheKey ??
    `workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;
```

Claim: translateLineInternal returns cached results before any OpenAI call when cache is present.
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:149-152
```
  if (!forceRefresh) {
    const cached = await cacheGet<LineTranslationResponse>(effectiveCacheKey);
    if (cached) {
      return cached;
    }
  }
```

Claim: Method 2 uses recipe caching (memory + DB) keyed by threadId/mode/contextHash; no line-level translation cache is used in translate-line-with-recipes.
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:585-596
```
  const contextHash = computeRecipeContextHash(
    guideAnswers,
    poemContext.sourceLanguage,
    poemContext.targetLanguage,
    poemHash
  );

  // Check memory cache first (fast path)
  const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
  const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:622-629
```
  // Check DB cache
  const threadState = await fetchThreadState(threadId);
  const dbCached = threadState.variant_recipes_v1;
  if (
    dbCached &&
    dbCached.mode === mode &&
    dbCached.contextHash === contextHash
  ) {
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:378-413
```
    const result: LineTranslationResponse = {
      lineOriginal: lineText,
      translations: [
        {
          variant: 1,
          fullText: variants[0]?.text || "",
          words: alignments[0] || [],
          metadata: {
            literalness: 0.8, // Recipe A typically more literal
            characterCount: variants[0]?.text.length || 0,
          },
        },
        ...
      ],
      modelUsed: model,
    };

    return NextResponse.json(result);
```

Claim: Recipe generation uses a lock key separate from line translation caching.
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:662-664
```
  // Need to generate new recipes - use lock to prevent concurrent generation
  const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;
```

### Part A. Method 2 bypass conditions (selected but not actually run)

Client-side bypass conditions

Claim: WordGrid will not start a translation request if currentLineIndex or thread is missing, or if the line text is not a string.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-224
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;
```

Claim: WordGrid skips the request entirely if lineTranslations already has a value for that line.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:226-227
```
    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```

Claim: Background translation hydration can populate lineTranslations before a click, preventing Method 2 from running when selected.
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
```
  // Hydrate background translations into workshop store (lineTranslations only)
  React.useEffect(() => {
    ...
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
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
```

Claim: lineTranslations can be rehydrated from persisted storage, preventing Method 2 from running on page load.
Evidence: translalia-web/src/store/workshopSlice.ts:216-265
```
  merge: (persisted, current) => {
    ...
    return {
      ...current,
      ...
      lineTranslations: p.lineTranslations ?? current.lineTranslations,
      selectedVariant: p.selectedVariant ?? current.selectedVariant,
      hydrated: true,
      meta: { threadId: tid ?? p.meta?.threadId ?? null },
    };
```

Claim: inFlightRequestRef blocks duplicate in-flight requests for the same line.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:229-237
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

Claim: There is no completedLines guard in the translation fetch path (WordGrid only checks lineTranslations).
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```

Server-side bypass conditions

Claim: translateLineInternal can return cached Method 1 artifacts for any caller (background or /translate-line), because it returns cache hits before calling OpenAI.
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:149-152
```
  if (!forceRefresh) {
    const cached = await cacheGet<LineTranslationResponse>(effectiveCacheKey);
    if (cached) {
      return cached;
    }
  }
```

Claim: /api/workshop/translate-line-with-recipes does not use translateLineInternal, so it does not read the Method 1 cache.
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:1-18
```
import type { LineTranslationResponse } from "@/types/lineTranslation";
import { openai } from "@/lib/ai/openai";
import {
  getOrCreateVariantRecipes,
  type ViewpointRangeMode,
  type VariantRecipesBundle,
} from "@/lib/ai/variantRecipes";
import { buildRecipeAwarePrismaticPrompt } from "@/lib/ai/workshopPrompts";
```

### Part A. Instrumentation plan (proposal only; no code changes in this report)

Claim: In /api/workshop/translate-line, log after translateLineInternal returns so methodActuallyUsed and modelUsed are known.
Evidence: translalia-web/src/app/api/workshop/translate-line/route.ts:166-186
```
    const result = await translateLineInternal({
      threadId,
      lineIndex,
      lineText,
      ...
    });

    return NextResponse.json(result);
```
Suggested log placement: immediately after the translateLineInternal call (line 168) and before return.

Claim: In the background pipeline, log after translateLineInternal in processStanza.
Evidence: translalia-web/src/lib/workshop/processStanza.ts:166-188
```
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
        modelOverride: selectedModel,
        audit: ...
      });
```
Suggested log placement: right after the await translateLineInternal call (line 167).

Claim: In /api/workshop/translate-line-with-recipes, log right before returning result.
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:378-413
```
    const result: LineTranslationResponse = {
      lineOriginal: lineText,
      translations: [ ... ],
      modelUsed: model,
    };

    return NextResponse.json(result);
```
Suggested log placement: just before `return NextResponse.json(result)` (line 413).

Claim: To include cacheHitType, instrument translateLineInternal cache lookup and (optionally) getOrCreateVariantRecipes cache path selection.
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:149-152
```
  if (!forceRefresh) {
    const cached = await cacheGet<LineTranslationResponse>(effectiveCacheKey);
    if (cached) {
      return cached;
    }
  }
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:595-596
```
  const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
  const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
```
Suggested instrumentation approach: add a small flag for `cacheHitType` (e.g., "line-cache-hit"/"line-cache-miss" or "recipes-memory"/"recipes-db"/"recipes-generated") and include it in the log line described above.

### Part B. TTFL and ordering

Claim: The background job can process multiple stanzas concurrently (maxConcurrent default is 5), so later stanzas can be started while earlier ones are still processing.
Evidence: translalia-web/src/lib/workshop/jobState.ts:13-14
```
const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_MAX_STANZAS_PER_TICK = 2;
```
Evidence: translalia-web/src/lib/workshop/jobState.ts:186-190
```
  maxConcurrent: options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
  maxChunksPerTick:
    options?.maxStanzasPerTick ?? DEFAULT_MAX_STANZAS_PER_TICK,
  maxStanzasPerTick:
    options?.maxStanzasPerTick ?? DEFAULT_MAX_STANZAS_PER_TICK,
```
Evidence: translalia-web/src/lib/workshop/jobState.ts:309-322
```
  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  ...
  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
```

Claim: Queue order can be mutated (re-queued to front) when rate-limited or when processing time is exceeded.
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:218-230
```
  if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
    await updateTranslationJob(threadId, (draft) => {
      started.forEach((index) => {
        ...
        if (!draft.queue.includes(index)) {
          draft.queue.unshift(index);
        }
      });
```
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:324-336
```
  if (skipped.length > 0) {
    await updateTranslationJob(threadId, (draft) => {
      ...
      skipped.forEach((index) => {
        ...
        if (!draft.queue.includes(index)) {
          draft.queue.unshift(index);
        }
      });
```

Claim: getNextStanzasToProcess uses queue order (slice) and has no explicit line-level prioritization beyond the queue.
Evidence: translalia-web/src/lib/workshop/jobState.ts:314-322
```
  const queued = job.queue.filter(
    (index) =>
      chunkOrStanzaStates[index]?.status === "queued" ||
      chunkOrStanzaStates[index]?.status === "pending"
  );

  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
```

Claim: Within a stanza, lines are translated sequentially in order.
Evidence: translalia-web/src/lib/workshop/processStanza.ts:135-168
```
  for (let i = 0; i < totalLines; i += 1) {
    const lineText = stanza.lines[i];
    const globalLineIndex = lineOffset + i;
    ...
    const lineTranslation = await translateLineInternal({
      threadId,
      lineIndex: globalLineIndex,
      lineText,
      ...
    });
```

### Part B. UI behavior: does the UI wait for line 0?

Claim: There is no automatic "select line 0" behavior; it was explicitly removed.
Evidence: translalia-web/src/components/notebook/NotebookPhase6.tsx:91-94
```
  // NOTE: Removed auto-select-line-0 effect.
  // Previously this would set currentLineIndex to 0 when null, but that
  // conflicts with WorkshopRail's segment->line navigation flow (user should
  // explicitly choose a line from the line list after selecting a segment).
```

Claim: Line selection is user-driven and does not gate on prior lines; onClick always calls onSelect.
Evidence: translalia-web/src/components/workshop-rail/LineClickHandler.tsx:108-113
```
  return (
    <div
      onClick={() => {
        // Allow selection for completed lines, or let user see status for others
        onSelect();
      }}
```

Claim: Translation requests are only triggered for the currently selected line (currentLineIndex), not based on any "line N-1 must exist" rule.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```

### Part B. TTFL critical path (earliest line 0)

Claim: Background translation is kicked off by GuideRail via POST /api/workshop/initialize-translations.
Evidence: translalia-web/src/components/guide/GuideRail.tsx:671-677
```
        const response = await fetch("/api/workshop/initialize-translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            runInitialTick: true,
          }),
        });
```

Claim: initialize-translations runs runTranslationTick inside the request.
Evidence: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
```
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }
```

Claim: runTranslationTick calls processStanza, which calls translateLineInternal (OpenAI) to produce line translations.
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:272-284
```
      await processStanza({
        threadId,
        stanzaIndex,
        stanza,
        ...
      });
```
Evidence: translalia-web/src/lib/workshop/processStanza.ts:166-172
```
      const lineTranslation = await translateLineInternal({
        threadId,
        lineIndex: globalLineIndex,
        lineText,
        fullPoem: rawPoem,
        stanzaIndex,
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
```

Claim: The UI polls /api/workshop/translation-status every 4s with advance=true, which runs runTranslationTick and delivers job data used to hydrate lineTranslations.
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:61-64
```
  const translationJobQuery = useTranslationJob(threadId || undefined, {
    enabled: shouldPollTranslations,
    pollIntervalMs: 4000, // Poll every 4 seconds
    advanceOnPoll: true, // Advance translation job on each poll
  });
```
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
```
  React.useEffect(() => {
    ...
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
      if (chunk.lines && Array.isArray(chunk.lines)) {
        chunk.lines.forEach((line) => {
          if (line.translations && line.translations.length > 0) {
            if (line.line_number !== undefined) {
              if (line.translations.length === 3) {
                setLineTranslation(line.line_number, {
                  ...
                });
```

Claim: The earliest interactive path for line 0 is a direct line click, which triggers useTranslateLine routing to /translate-line or /translate-line-with-recipes.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-247
```
    translateLine(
      {
        threadId: thread,
        lineIndex: currentLineIndex,
        lineText,
        fullPoem,
        stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
        prevLine: (lineContext?.prevLine ?? ctx.prevLine) || undefined,
        nextLine: (lineContext?.nextLine ?? ctx.nextLine) || undefined,
      },
```
Evidence: translalia-web/src/lib/hooks/useTranslateLine.ts:34-37
```
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";
```

### Part C. Endpoints that do OpenAI work inside the request

Claim: initialize-translations runs OpenAI work inside the handler via runTranslationTick -> translateLineInternal.
Evidence: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
```
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
```

Claim: translation-status?advance=true runs OpenAI work inside the handler via runTranslationTick -> translateLineInternal.
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
```

Claim: translate-line-with-recipes does OpenAI work inside the handler (variants + alignments).
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
```
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
```
Evidence: translalia-web/src/lib/ai/alignmentGenerator.ts:65-73
```
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
```

## Suspected

Claim: Overlapping ticks can cause out-of-order stanza completion when a translation tick takes longer than the poll interval (4s), allowing multiple ticks to run concurrently.
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:61-64
```
  const translationJobQuery = useTranslationJob(threadId || undefined, {
    enabled: shouldPollTranslations,
    pollIntervalMs: 4000, // Poll every 4 seconds
    advanceOnPoll: true, // Advance translation job on each poll
  });
```
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }
```
Reason for "suspected": concurrency/overlap timing depends on runtime latency, which is not observable in static code.

Claim: Method 2 TTFL can be significantly longer on cache miss because recipe generation may take tens of seconds before variants/alignments are generated.
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:354-356
```
/** Constants for lock retry */
// Increased to handle worst-case recipe generation (30-60s)
const MAX_LOCK_ATTEMPTS = 15;
```
Reason for "suspected": actual runtime duration depends on model latency and cache hit rate.

## Addendum for Requested Deliverables (Method Proof, Waits, Ordering)

### Deliverable A. Method Proof trace for one thread + two lines (line 0 and line 5)

Trace A1: Line 0 background when clicking "Let's Get Started" uses Method 1 prompt builder.
Evidence: translalia-web/src/components/guide/GuideRail.tsx:657-677
```
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
Evidence: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
```
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }
```
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:272-284
```
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
Evidence: translalia-web/src/lib/workshop/processStanza.ts:166-173
```
      const lineTranslation = await translateLineInternal({
        threadId,
        lineIndex: globalLineIndex,
        lineText,
        fullPoem: rawPoem,
        stanzaIndex,
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
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

Trace A2: Line 5 click with method-2 selected hits /translate-line-with-recipes unless lineTranslations is already hydrated.
Evidence: translalia-web/src/lib/hooks/useTranslateLine.ts:34-37
```
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";
```
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
```
  React.useEffect(() => {
    ...
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
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
```

### Deliverable A. UI data sources and modelUsed provenance

Claim: The Workshop UI renders translations from Zustand lineTranslations, not directly from the DB.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:275-280
```
  const currentLineTranslation =
    currentLineIndex !== null ? lineTranslations[currentLineIndex] : null;
  const currentSelectedVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;
  const badgeModelUsed = currentLineTranslation?.modelUsed ?? modelUsed;
```

Claim: lineTranslations can be hydrated from background job results returned by translation-status (not direct DB reads).
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-66
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }

  const job = await getTranslationJob(threadId);
  const progress = summarizeTranslationJob(job);
```
Evidence: translalia-web/src/lib/workshop/jobState.ts:124-128
```
export async function getTranslationJob(
  threadId: string
): Promise<TranslationJobState | null> {
  const state = await fetchThreadState(threadId);
  return state.translation_job ?? null;
}
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
```
  React.useEffect(() => {
    ...
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
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
```

Claim: DB thread state (chat_threads.state.workshop_lines) only hydrates completedLines, not lineTranslations.
Evidence: translalia-web/src/lib/hooks/useWorkshopFlow.ts:74-97
```
export function useWorkshopState(threadId: string | undefined) {
  return useQuery({
    queryKey: ["workshop-state", threadId],
    queryFn: async () => {
      ...
      const state = (data?.state as Record<string, unknown>) || {};
      const workshopLines =
        (state.workshop_lines as Record<number, WorkshopLine>) || {};

      return workshopLines;
    },
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:77-105
```
  React.useEffect(() => {
    if (!threadId || !savedWorkshopLines) return;
    ...
    if (Object.keys(mapped).length > 0) {
      console.log(
        `[WorkshopRail] Hydrating ${
          Object.keys(mapped).length
        } saved completed lines from Supabase`
      );
      setCompletedLines(mapped);
    }
  }, [threadId, savedWorkshopLines, completedLines, setCompletedLines]);
```

Claim: lineTranslations can be hydrated from persisted client storage (Zustand persist).
Evidence: translalia-web/src/store/workshopSlice.ts:214-265
```
  merge: (persisted, current) => {
    ...
    return {
      ...current,
      ...
      lineTranslations: p.lineTranslations ?? current.lineTranslations,
      selectedVariant: p.selectedVariant ?? current.selectedVariant,
      hydrated: true,
      meta: { threadId: tid ?? p.meta?.threadId ?? null },
    };
```

Claim: modelUsed displayed in the UI comes from the LineTranslationResponse (data.modelUsed) or from background hydration line.model_used.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:245-258
```
    translateLine(
      {
        threadId: thread,
        lineIndex: currentLineIndex,
        lineText,
        fullPoem,
        stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
        prevLine: (lineContext?.prevLine ?? ctx.prevLine) || undefined,
        nextLine: (lineContext?.nextLine ?? ctx.nextLine) || undefined,
      },
      {
        onSuccess: (data) => {
          setLineTranslation(currentLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:300-309
```
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
```
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:275-280
```
  const currentLineTranslation =
    currentLineIndex !== null ? lineTranslations[currentLineIndex] : null;
  const currentSelectedVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;
  const badgeModelUsed = currentLineTranslation?.modelUsed ?? modelUsed;
```

### Deliverable B. Why did I wait ~2 minutes?

Claim: initialize-translations runs OpenAI inside the HTTP request via runTranslationTick -> translateLineInternal.
Evidence: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
```
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
    if (isGpt5) {
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } else {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
```

Claim: translation-status?advance=true runs OpenAI inside the HTTP request via runTranslationTick -> translateLineInternal.
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:203-223
```
    if (isGpt5) {
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } else {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
```

Claim: translate-line-with-recipes runs OpenAI inside the HTTP request (recipes + variants + alignments).
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-167
```
    let recipes: VariantRecipesBundle;
    try {
      recipes = await getOrCreateVariantRecipes(
        threadId,
        guideAnswers,
        {
          fullPoem: rawPoem,
          sourceLanguage,
          targetLanguage,
        },
        mode
      );
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:415-433
```
    const completion = isGpt5
      ? await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        })
      : await openai.chat.completions.create({
          model: modelToUse,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
```
    try {
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:349-359
```
    let alignments: AlignedWord[][];

    try {
      alignments = await generateAlignmentsParallel(
        lineText,
        variantTexts,
        sourceLanguage,
        targetLanguage
      );
```
Evidence: translalia-web/src/lib/ai/alignmentGenerator.ts:65-73
```
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0, // Deterministic for consistency
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
```

Claim: Recipe generation can include lock wait backoff before OpenAI runs.
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:662-668
```
  const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;

  for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
    // Try atomic lock acquisition
    const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);
```
Evidence: translalia-web/src/lib/ai/variantRecipes.ts:751-755
```
    // Lock not acquired: another request is generating
    // Wait with exponential backoff + jitter, then re-check DB
    const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
    const jitter = Math.random() * 500;
    await sleep(backoff + jitter);
```

Claim: Alignments are parallel per variant, but still block the handler because the Promise.all result is awaited.
Evidence: translalia-web/src/lib/ai/alignmentGenerator.ts:125-140
```
export async function generateAlignmentsParallel(
  sourceText: string,
  variants: string[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<AlignedWord[][]> {
  const alignmentPromises = variants.map((translatedText) =>
    generateAlignmentForVariant(
      sourceText,
      translatedText,
      sourceLanguage,
      targetLanguage
    )
  );

  return Promise.all(alignmentPromises);
}
```

### Deliverable B. TanStack Query overlap analysis

Claim: The translation-status poll is configured to refetch every 4s, enabled by threadId, with no explicit cancelRefetch setting.
Evidence: translalia-web/src/lib/hooks/useTranslationJob.ts:67-94
```
  return useQuery({
    queryKey: ["translation-job", threadId, advanceOnPoll],
    queryFn: async (): Promise<TranslationStatusResponse> => {
      ...
      return fetchJSON<TranslationStatusResponse>(
        `/api/workshop/translation-status?${params.toString()}`
      );
    },
    enabled: Boolean(threadId) && enabled,
    refetchInterval: pollIntervalMs,
    refetchOnWindowFocus: false,
  });
```
Evidence: translalia-web/src/components/providers.tsx:7-9
```
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
```
Reason for "suspected": there is no explicit config in this code to prevent overlapping polls; actual overlap depends on TanStack Query runtime behavior and request duration.

### Deliverable C. Ordering: why later stanzas/lines can finish first

Claim: Multiple ticks can run concurrently because multiple endpoints call runTranslationTick without any explicit mutual exclusion.
Evidence: translalia-web/src/app/api/workshop/initialize-translations/route.ts:78-82
```
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }
```
Evidence: translalia-web/src/app/api/workshop/translation-status/route.ts:57-61
```
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }
```
Evidence: translalia-web/src/app/api/workshop/requeue-stanza/route.ts:117-121
```
  if (runImmediately) {
    try {
      tickResult = await runTranslationTick(threadId, {
        maxProcessingTimeMs: 4000,
      });
```
Evidence: translalia-web/src/app/api/workshop/retry-stanza/route.ts:157-160
```
    try {
      await runTranslationTick(threadId, { maxProcessingTimeMs: 4000 });
    } catch (tickError) {
```

Claim: Later stanzas can run while earlier ones are still active because maxConcurrent allows multiple stanzas and getNextStanzasToProcess slices from the queue.
Evidence: translalia-web/src/lib/workshop/jobState.ts:13-14
```
const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_MAX_STANZAS_PER_TICK = 2;
```
Evidence: translalia-web/src/lib/workshop/jobState.ts:309-322
```
  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  ...
  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
```

Claim: Hydration does not sort by line index; it iterates Object.values() and writes lineTranslations by line_number.
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:293-304
```
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
      if (chunk.lines && Array.isArray(chunk.lines)) {
        chunk.lines.forEach((line) => {
          if (line.translations && line.translations.length > 0) {
            if (line.line_number !== undefined) {
              // Also hydrate the full LineTranslationResponse for the new workflow
              if (line.translations.length === 3) {
                setLineTranslation(line.line_number, {
```

Claim: Queue order can be mutated (front-of-queue) on rate limit, time budget skip, or manual requeue.
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:218-230
```
  if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
    await updateTranslationJob(threadId, (draft) => {
      ...
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index);
      }
    });
```
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:324-336
```
  if (skipped.length > 0) {
    await updateTranslationJob(threadId, (draft) => {
      ...
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index);
      }
    });
```
Evidence: translalia-web/src/app/api/workshop/requeue-stanza/route.ts:104-108
```
    // Ensure stanza is at front of queue without duplicates
    draft.queue = [
      stanzaIndex,
      ...draft.queue.filter((idx) => idx !== stanzaIndex),
    ];
```

### Instrumentation (dev-only) recommendation for runtime proof

Recommended log line placement (no code changes here, just placement):
- After translateLineInternal returns in /api/workshop/translate-line (translalia-web/src/app/api/workshop/translate-line/route.ts:166-186)
- After translateLineInternal returns in background processStanza (translalia-web/src/lib/workshop/processStanza.ts:166-173)
- Right before returning result in /api/workshop/translate-line-with-recipes (translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:378-413)
- Around recipe generation, variants, and alignments to measure durations (translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-359; translalia-web/src/lib/ai/variantRecipes.ts:662-755)

Sample structured log format (example):
```
[workshop-method] {"requestId":"req-123","endpoint":"translate-line-with-recipes","threadId":"...","lineIndex":5,"methodRequested":"method-2","methodActuallyUsed":"method-2","effectiveModel":"gpt-4o","cacheHit":{"line":false,"recipes":"db","lockWaitMs":1200},"durationsMs":{"recipes":42000,"variants":15000,"alignments":8000}}
```

### Root cause summary (evidence-backed)

Cause 1: Background translations always use Method 1 prompt builder (translateLineInternal -> buildLineTranslationPrompt), not Method 2 recipes.
Evidence: translalia-web/src/lib/workshop/processStanza.ts:166-173
```
      const lineTranslation = await translateLineInternal({
        threadId,
        lineIndex: globalLineIndex,
        lineText,
        fullPoem: rawPoem,
        stanzaIndex,
```
Evidence: translalia-web/src/lib/workshop/translateLineInternal.ts:159-172
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

Cause 2: Method-2 click can be bypassed if lineTranslations is already hydrated from background or persistence.
Evidence: translalia-web/src/components/workshop-rail/WordGrid.tsx:221-227
```
  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated -> no fetch
    if (lineTranslations[currentLineIndex]) return;
```
Evidence: translalia-web/src/components/workshop-rail/WorkshopRail.tsx:284-311
```
  React.useEffect(() => {
    ...
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
      if (chunk.lines && Array.isArray(chunk.lines)) {
        chunk.lines.forEach((line) => {
          if (line.translations && line.translations.length > 0) {
            if (line.line_number !== undefined) {
              if (line.translations.length === 3) {
                setLineTranslation(line.line_number, {
```

Cause 3: translate-line-with-recipes does multiple OpenAI calls sequentially (recipes, variants, alignments), which can extend wall time inside the HTTP request.
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:151-167
```
    let recipes: VariantRecipesBundle;
    try {
      recipes = await getOrCreateVariantRecipes(
        threadId,
        guideAnswers,
        {
          fullPoem: rawPoem,
          sourceLanguage,
          targetLanguage,
        },
        mode
      );
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:227-245
```
    try {
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
```
Evidence: translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts:349-359
```
    let alignments: AlignedWord[][];

    try {
      alignments = await generateAlignmentsParallel(
        lineText,
        variantTexts,
        sourceLanguage,
        targetLanguage
      );
```

Cause 4: Stanza ordering can appear out-of-order because multiple stanzas can be processed concurrently and queues can be re-ordered.
Evidence: translalia-web/src/lib/workshop/jobState.ts:13-14
```
const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_MAX_STANZAS_PER_TICK = 2;
```
Evidence: translalia-web/src/lib/workshop/jobState.ts:309-322
```
  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  ...
  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
```
Evidence: translalia-web/src/lib/workshop/runTranslationTick.ts:218-230
```
  if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
    await updateTranslationJob(threadId, (draft) => {
      ...
      if (!draft.queue.includes(index)) {
        draft.queue.unshift(index);
      }
    });
```
Evidence: translalia-web/src/app/api/workshop/requeue-stanza/route.ts:104-108
```
    draft.queue = [
      stanzaIndex,
      ...draft.queue.filter((idx) => idx !== stanzaIndex),
    ];
```

### Minimal fix directions (no code, ranked by safety)

1) Add dev-only structured logs around translateLineInternal and translate-line-with-recipes to produce definitive methodActuallyUsed traces with cache flags and durations.
2) Separate line-level cache keys by method (include method/recipe context in cache key) to prevent Method 1 results from masking Method 2 clicks.
3) Introduce explicit request de-duplication or single-flight on translation-status polling to prevent overlapping ticks and reordering effects.
