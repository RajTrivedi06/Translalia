# Prompt Playground / Debug Mode — Feasibility Report

**Date:** 2026-03-01
**Auditor:** Claude Code (automated codebase analysis)
**Branch:** `fix/app-context-loss`
**Scope:** Full codebase exploration of `translalia-web/src/`

---

## Table of Contents

1. [Prompt Inventory](#1-prompt-inventory)
2. [Translation Pipeline Mapping](#2-translation-pipeline-mapping)
3. [Prompt Dependency Analysis](#3-prompt-dependency-analysis)
4. [Error Handling & Fallbacks](#4-error-handling--fallbacks)
5. [Existing Test Coverage](#5-existing-test-coverage)
6. [State Management Relevant to Prompts](#6-state-management-relevant-to-prompts)
7. [Configuration & Environment](#7-configuration--environment)
8. [Feasibility Assessment](#8-feasibility-assessment)

---

## 1. PROMPT INVENTORY

### 1A. Main Translation — Simplified Prompts (Active when `USE_SIMPLIFIED_PROMPTS=1`)

**File:** `src/lib/ai/simplifiedPrompts.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `buildSimplifiedSystemPrompt()` | 82–90 | System message for translation LLM call | Hardcoded builder | None | ~80 |
| `buildSimplifiedUserPrompt()` | 102–165 | User message for main generation | Dynamic builder | `sourceText`, `mode`, `personality` (domain/purpose/priority/variety), `currentTranslation`, `context` (full poem) | ~200–600 |
| `SIMPLIFIED_VARIANT_INSTRUCTIONS` | 26–41 | Mode-specific instructions (focused / balanced / adventurous) | Hardcoded constant | None (selected by `mode`) | ~80–120 each |
| `buildSimplifiedRegenPrompt()` | 191–251 | Regeneration after diversity gate failure | Dynamic builder | `label`, `mode`, `lineText`, `sourceLanguage`, `targetLanguage`, `fixedVariants`, `gateReason`, `prevLine`, `nextLine` | ~250–400 |
| `SIMPLIFIED_VARIANT_DESCRIPTIONS` | 52–71 | Short role descriptions per variant per mode | Hardcoded constant | None | ~20 each |

**System prompt content (exact):**
```
You are a poetry translator assisting in an educational exercise.
Respond ONLY with valid JSON in this exact format:
{ "variants": [{ "label": "A", "text": "..." }, { "label": "B", "text": "..." }, { "label": "C", "text": "..." }] }
Do not include any explanation, commentary, or additional fields.
Each variant text should contain only the translated line(s), no labels or prefixes.
```

---

### 1B. Main Translation — Legacy Workshop Prompts (Active when `USE_SIMPLIFIED_PROMPTS=0`)

**File:** `src/lib/ai/workshopPrompts.ts` (~850 lines)

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `buildLineTranslationPrompt()` | ~100–350 | Full system+user prompt for line translation with word alignment | Dynamic builder | `lineText`, `lineIndex`, `prevLine`, `nextLine`, `fullPoem`, `stanzaIndex`, `position`, `guideAnswers`, `sourceLanguage`, `targetLanguage` | ~800–1500 |
| `buildLineTranslationFallbackSystemPrompt()` | ~360–380 | Simplified system for fallback (no alignment) | Dynamic builder | None | ~100 |
| `buildLineTranslationFallbackPrompt()` | ~380–430 | Simplified user for fallback | Dynamic builder | `lineText`, `lineIndex`, `fullPoem`, `stanzaIndex`, `guideAnswers`, `sourceLanguage` | ~300–500 |
| `buildAIAssistPrompt()` | ~450–550 | AI assist for word refinement | Dynamic builder | `selectedWords`, `sourceLineText`, `guideAnswers`, `instruction` (refine/rephrase/expand/simplify) | ~200–400 |
| `buildAIAssistSystemPrompt()` | ~430–445 | Minimal JSON-only system for AI assist | Hardcoded builder | None | ~30 |

---

### 1C. Archetype-Based Regeneration

**File:** `src/lib/ai/regen.ts` (~800+ lines)

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `buildRegenPrompt()` | ~180–350 | Surgical single-variant regeneration | Dynamic builder | `label`, archetypes, lens configs, existing variants, anchors, `gateReason`, structural metadata | ~400–800 |
| Regen system prompt | Inline | "You are a translation variant generator." | Hardcoded string | None | ~10 |

**Archetypes (3 types):**
- **A:** `essence_cut` — Distill core meaning + emotional contour
- **B:** `prismatic_reimagining` — Fresh metaphor system
- **C:** `world_voice_transposition` — Shift narrator stance/world-frame

---

### 1D. Notebook — Formal Features Analysis (3-step flow)

**File:** `src/lib/ai/notebookSuggestionsPrompts.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `IDENTIFY_FEATURES_SYSTEM_PROMPT` | 16–52 | Step 1: Identify rhyme scheme & formal features | Hardcoded constant | None | ~350 |
| `buildIdentifyFeaturesUserPrompt()` | 54–77 | Step 1 user prompt | Dynamic builder | `sourcePoem`, `sourceLanguage` | ~100–300 |
| `ADJUST_TRANSLATION_SYSTEM_PROMPT` | 83–127 | Step 2: Suggest rhyme adjustments | Hardcoded constant | None | ~400 |
| `buildAdjustTranslationUserPrompt()` | 129–201 | Step 2 user prompt | Dynamic builder | `sourcePoem`, `translationPoem`, `formalFeatures`, `sourceLanguage`, `targetLanguage`, `selectedLines` | ~300–800 |
| `PERSONALIZED_SUGGESTIONS_SYSTEM_PROMPT` | 208–248 | Step 3: Personalized mentor suggestions | Hardcoded constant | None | ~300 |
| `buildPersonalizedSuggestionsUserPrompt()` | 250–311 | Step 3 user prompt | Dynamic builder | `sourcePoem`, `translationPoem`, `formalFeatures`, `translationDiary`, `lineNotes`, `sourceLanguage`, `targetLanguage` | ~300–800 |

**Fallback generators:** `generateFallbackFormalFeatures()`, `generateFallbackAdjustments()`, `generateFallbackPersonalized()` — return static JSON objects when LLM fails.

---

### 1E. Rhyme Workshop

**File:** `src/lib/ai/rhymeWorkshopPrompts.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `RHYME_WORKSHOP_SYSTEM_PROMPT` | 20–63 | Expert poetry teacher for sonic qualities | Hardcoded constant | None | ~500 |
| `buildRhymeWorkshopUserPrompt()` | 88–201 | Line-level rhyme/sound/rhythm analysis | Dynamic builder | `lineIndex`, `sourceLine`, `currentTranslation`, `previousLine`, `nextLine`, `fullSourcePoem`, `fullTranslation`, `sourceLanguage`, `targetLanguage`, `rhymeDictionaryData`, `sourceLineAnalysis`, `currentLineAnalysis`, `sourceRhymeScheme`, `rhymeTargetLines` | ~400–1200 |
| `RHYME_WORKSHOP_JSON_SCHEMA` | 207–372 | Structured output schema | JSON Schema constant | None | N/A |

**Fallback:** `generateFallbackRhymeWorkshopResponse()` — returns empty arrays with basic rhythm data.

---

### 1F. Poem-Level (Macro) Suggestions

**File:** `src/lib/ai/poemSuggestions.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `buildPoetryMacroSystemPrompt()` | 73–111 | Macro-level critique system | Dynamic builder | `guideAnswers` (zone, intent) | ~200 |
| `buildPoetryMacroUserPrompt()` | 116–150 | Macro critique user prompt | Dynamic builder | `sourcePoem`, `translationPoem` | ~200–600 |

**Fallback:** `generateFallbackSuggestions()` — returns heuristic-based rhyme/tone suggestions.

---

### 1G. Verification & Context Notes

**File:** `src/lib/ai/verificationPrompts.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `buildVerificationPrompt()` | 30–145 | Track A: Brutal AI-option grading | Dynamic builder | `sourceLine`, `sourceLanguage`, `targetLanguage`, `guideAnswers`, `generatedOptions`, `userSelections`, `translatedLine` | ~600–1000 |
| `buildContextNotesPrompt()` | 159–205 | Track B: Educational context notes | Dynamic builder | `sourceLine`, `sourceToken`, `options`, `pos`, `guideAnswers` | ~200–400 |

---

### 1H. Journey & Reflection (Multi-locale)

**File:** `src/lib/ai/localePrompts.ts`

| Prompt | Lines | Purpose | Type | Variables | Est. Tokens |
|--------|-------|---------|------|-----------|-------------|
| `interviewSystemPrompts[lang]` | 27–72 | Rewrite clarifying questions | Hardcoded per-locale | None | ~40 each |
| `journeyFeedbackSystemPrompts[lang]` | 74–101 | Brief encouraging feedback | Hardcoded per-locale | None | ~50 each |
| `journeyReflectionSystemPrompts[lang]` | 103–154 | Deep reflection on translation choices | Hardcoded per-locale | None | ~100 each |

**Languages:** en, es, hi, ar, zh, ta, te, ml (8 locales)

---

### 1I. Translator Personality & Synthetic Personality

**File:** `src/lib/ai/translatorPersonality.ts`

| Component | Lines | Purpose | Type |
|-----------|-------|---------|------|
| `buildTranslatorPersonality()` | 73–80+ | Derive personality from `guideAnswers` | Dynamic builder |
| `buildVariantDefinitions()` | — | Build variant A/B/C definitions | Dynamic builder |
| `buildDomainExamples()` | — | Domain-specific translation examples | Dynamic builder |

**File:** `src/lib/ai/syntheticPersonality.ts`

| Component | Purpose | Type |
|-----------|---------|------|
| Personality knobs | vocabulary, sentenceLength, rhythmDensity, intimacy, slangTolerance, imageryDensity | Dynamic derivation |

---

### 1J. Summary: Total Prompt Count

| Category | System Prompts | User Prompt Builders | Total Distinct Prompts |
|----------|---------------|---------------------|----------------------|
| Main Translation (Simplified) | 1 | 2 (gen + regen) | 3 |
| Main Translation (Legacy) | 2 | 3 (gen + fallback + AI assist) | 5 |
| Archetype Regen | 1 | 1 | 2 |
| Notebook Suggestions | 3 | 3 | 6 |
| Rhyme Workshop | 1 | 1 | 2 |
| Poem Macro | 1 | 1 | 2 |
| Verification | 2 | 2 | 4 |
| Journey/Reflection | 3 × 8 locales | 0 (user context built inline) | 24 |
| Personality | 0 | 2 (personality + synthetic) | 2 |
| **TOTAL** | | | **~50** |

---

## 2. TRANSLATION PIPELINE MAPPING

### 2A. Primary Flow: Line-by-Line Translation

```
┌──────────────────┐
│   User enters     │   (Guide Rail: poem text, translationIntent,
│   poem + config   │    translationZone, sourceLanguageVariety,
│   in Guide Rail   │    translationRangeMode, translationModel, translationMethod)
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   POST /api/workshop/translate-line  │  ← src/app/api/workshop/translate-line/route.ts
│   (or initialize-translations for    │     Validates: Zod schema, auth, rate limit
│    batch processing)                 │     Fetches: thread state from Supabase
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   translateLineInternal()            │  ← src/lib/workshop/translateLineInternal.ts
│   1. Check Redis cache               │     Cache key: threadId:lineIndex:model
│   2. Build prompts:                  │
│      IF USE_SIMPLIFIED_PROMPTS=1:    │
│        → buildSimplifiedSystemPrompt │     ← src/lib/ai/simplifiedPrompts.ts
│        → buildSimplifiedUserPrompt   │
│      ELSE:                           │
│        → buildLineTranslationPrompt  │     ← src/lib/ai/workshopPrompts.ts
│   3. Call OpenAI chat.completions    │
│      (gpt-5 → no temperature)       │
│      (non-gpt-5 → temp 0.7)         │
│   4. Model fallback if 404/400:     │
│      → retry with gpt-4o-mini       │
│   5. Parse JSON response             │
│   6. Validate with Zod schema        │
│   7. On validation fail:             │
│      → fallbackMode retry (simpler)  │
│   8. Cache result (1hr TTL)          │
│   9. Audit log (async, fire-forget)  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   Returns: LineTranslationResponse   │
│   {                                  │
│     lineOriginal: string,            │
│     translations: [                  │
│       { variant: 1, fullText, words, │
│         metadata },                  │
│       { variant: 2, ... },           │
│       { variant: 3, ... }            │
│     ],                               │
│     modelUsed: string                │
│   }                                  │
└──────────────────────────────────────┘
```

### 2B. Method-2 Flow: Recipe-Driven Prismatic Variants

```
┌──────────────────────────────────────┐
│   processStanza()                    │  ← src/lib/workshop/processStanza.ts
│   For each line in stanza:           │     Parallel processing (concurrency 1-8)
│     IF method-2:                     │
│       → translateLineWithRecipesInternal()
│     ELSE:                            │     ← src/lib/translation/method2/
│       → translateLineInternal()      │        translateLineWithRecipesInternal.ts
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   translateLineWithRecipesInternal() │
│   1. Resolve variant recipes          │  ← src/lib/ai/variantRecipes.ts
│      (archetype → lens configs)       │
│   2. Build recipe-aware prompt        │  ← src/lib/ai/workshopPrompts.ts
│      → buildRecipeAwarePrismaticPrompt │
│   3. Call chatCompletionsWithRetry()  │  ← src/lib/ai/chatCompletionsWithRetry.ts
│      (model from buildSamplingParams) │     with sampling, stop sequences, retry
│   4. Parse 3 variants from response  │
│   5. Run diversity gate check         │  ← src/lib/ai/diversityGate.ts
│      (Jaccard similarity check)       │
│   6. IF gate fails:                   │
│      → buildRegenPrompt()             │  ← src/lib/ai/regen.ts
│      → Single-variant regeneration    │
│      → Re-validate with anchors       │
│   7. Return variants + quality meta   │
└──────────────────────────────────────┘
```

### 2C. Batch Translation Flow

```
┌──────────────────────────────────────┐
│   POST /api/workshop/               │
│        initialize-translations       │
│   → Creates translation job in       │
│     Supabase (queued state)          │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   runTranslationTick()               │  ← src/lib/workshop/runTranslationTick.ts
│   1. Acquire distributed lock         │     (Redis/in-memory)
│   2. Load job state from Supabase    │
│   3. Get next stanzas to process     │
│   4. For each stanza (parallel pool):│
│      → processStanza()               │  ← src/lib/workshop/processStanza.ts
│        → For each line:              │
│          → translateLine[WithRecipes]│
│   5. Time-budgeted (interruptible)   │
│   6. Auto-retry failed lines         │  ← src/lib/workshop/autoRetryFailedLines.ts
│      (exponential backoff, max 3)    │
│   7. Update job state in Supabase    │
│   8. Release lock                     │
└──────────────────────────────────────┘
```

### 2D. Full Pipeline Summary

```
User Input (poem + guide config)
  │
  ├─→ [1] Guide Rail (guideSlice.ts → Supabase: chat_threads.state)
  │
  ├─→ [2] Poem Segmentation (stanzaDetection.ts / smartStanzaDetection.ts / chunkDetection.ts)
  │
  ├─→ [3] Translation Job Init (initialize-translations route → Supabase)
  │
  ├─→ [4] Translation Tick (runTranslationTick → processStanza → translateLine)
  │     │
  │     ├─→ [4a] Prompt Building (simplifiedPrompts.ts OR workshopPrompts.ts)
  │     ├─→ [4b] Personality Injection (translatorPersonality.ts + syntheticPersonality.ts)
  │     ├─→ [4c] OpenAI API Call (chatCompletionsWithRetry.ts → openai.ts)
  │     ├─→ [4d] Response Parsing (Zod validation, JSON schema enforcement)
  │     ├─→ [4e] Diversity Gate (diversityGate.ts → regen.ts if needed)
  │     ├─→ [4f] Caching (Redis / in-memory via cache.ts)
  │     └─→ [4g] Audit Logging (insertPromptAudit.ts + mask.ts)
  │
  ├─→ [5] Workshop UI (workshopSlice.ts → variant selection → draftLines → completedLines)
  │
  ├─→ [6] Notebook Phase
  │     ├─→ [6a] Formal Features (notebookSuggestionsPrompts.ts → Step 1–3)
  │     ├─→ [6b] Rhyme Workshop (rhymeWorkshopPrompts.ts)
  │     └─→ [6c] Poem Macro Suggestions (poemSuggestions.ts)
  │
  ├─→ [7] Verification (verificationPrompts.ts → grading + context notes)
  │
  └─→ [8] Journey Reflection (localePrompts.ts → generate-reflection route)
```

---

## 3. PROMPT DEPENDENCY ANALYSIS

### 3A. Main Translation Prompts (Simplified)

| Prompt | Input Variables | Expected Output | Downstream Parser | If Changed, What Breaks? | Fragility |
|--------|----------------|-----------------|-------------------|--------------------------|-----------|
| `buildSimplifiedSystemPrompt()` | None | N/A (system message) | N/A | Output format instructions — JSON schema enforcement catches malformed output | **MEDIUM** |
| `buildSimplifiedUserPrompt()` | `sourceText`, `mode`, `personality.domain`, `personality.purpose`, `personality.priority`, `personality.source_language_variety`, `personality.source_language_notes`, `currentTranslation`, `context` | `{ "variants": [{ "label": "A", "text": "..." }, ...] }` | `JSON.parse()` → Zod `mainGenSchema.ts` (strict: additionalProperties: false, exactly 3 variants with labels A/B/C) | **Strict JSON schema validation**: must have exactly `variants` array with 3 items, each with `label` (enum A/B/C) and `text` (non-empty string). Any structural deviation → parse error → fallback mode. | **HIGH** |
| `buildSimplifiedRegenPrompt()` | `label`, `mode`, `lineText`, `sourceLanguage`, `targetLanguage`, `fixedVariants`, `gateReason` | `{ "text": "..." }` | Zod schema in `regen.ts` with anchor/metadata validation | Must return single JSON with `text` field. Anchor realization check, self-report metadata validation, structural signature uniqueness check all run post-parse. | **HIGH** |

### 3B. Notebook Suggestions Prompts

| Prompt | Expected Output | Downstream Parser | Fragility |
|--------|-----------------|-------------------|-----------|
| `IDENTIFY_FEATURES_SYSTEM_PROMPT` | `{ rhymeScheme, rhymeSchemeDescription, otherFeatures[], summary }` | `JSON.parse()` → typed access to `.rhymeScheme`, `.otherFeatures`, `.summary` | **HIGH** — specific field names expected |
| `ADJUST_TRANSLATION_SYSTEM_PROMPT` | `{ adjustments[], generalGuidance, imitationFeasibility, feasibilityExplanation }` | `JSON.parse()` → typed field access | **HIGH** |
| `PERSONALIZED_SUGGESTIONS_SYSTEM_PROMPT` | `{ insight: { observation, interests[], aims[] }, suggestions[], encouragement }` | `JSON.parse()` → typed field access | **HIGH** |

### 3C. Rhyme Workshop Prompts

| Prompt | Expected Output | Downstream Parser | Fragility |
|--------|-----------------|-------------------|-----------|
| `RHYME_WORKSHOP_SYSTEM_PROMPT` | `{ rhymeWorkshop[], soundWorkshop[], rhythmWorkshop[] }` | Full JSON Schema enforcement (`RHYME_WORKSHOP_JSON_SCHEMA`, 160+ lines of schema). Each array item has deeply nested required fields. | **VERY HIGH** |

### 3D. Verification Prompts

| Prompt | Expected Output | Downstream Parser | Fragility |
|--------|-----------------|-------------------|-----------|
| `buildVerificationPrompt()` | `{ overall_score, scores: { semantic_accuracy, ... }, detailed_reasoning[], issues[], strengths[], model_used }` | `JSON.parse()` → typed field access for dashboard display | **HIGH** |
| `buildContextNotesPrompt()` | `{ "considerations": ["note1", "note2"] }` | `JSON.parse()` → `.considerations` array | **MEDIUM** |

### 3E. Journey/Reflection Prompts

| Prompt | Expected Output | Downstream Parser | Fragility |
|--------|-----------------|-------------------|-----------|
| `interviewSystemPrompts` | `{ "question": "<text>" }` | `JSON.parse()` → `.question` | **MEDIUM** |
| `journeyFeedbackSystemPrompts` | `{ "feedback": "<text>" }` | `JSON.parse()` → `.feedback` | **MEDIUM** |
| `journeyReflectionSystemPrompts` | `{ "reflection": "<text>" }` | `JSON.parse()` → `.reflection` + repair call if structure differs (extracts arrays: insights/strengths/challenges/recommendations) | **MEDIUM** — has repair fallback |

### 3F. Fragility Summary

| Fragility Level | Count | Examples |
|----------------|-------|---------|
| **VERY HIGH** | 1 | Rhyme Workshop (160-line JSON schema) |
| **HIGH** | 8 | Main translation gen/regen, all 3 notebook steps, verification grading, diversity gate output |
| **MEDIUM** | 5 | Context notes, journey prompts (all 3), simplified system prompt |
| **LOW** | 0 | None — every prompt requires structured JSON output |

---

## 4. ERROR HANDLING & FALLBACKS

### 4A. LLM API Failure Handling

| Layer | File | Mechanism | Details |
|-------|------|-----------|---------|
| **OpenAI Responses API** | `openai.ts:46–129` | Unsupported-parameter retry | If `temperature` is unsupported → retry without temp/top_p/response_format |
| **Chat Completions** | `chatCompletionsWithRetry.ts` | Multi-layer retry | (1) Unsupported param → strip all sampling params and retry. (2) Stop-sequence truncation → retry without stops. (3) Parse callback for pre-return validation |
| **Model fallback** | `translateLineInternal.ts:224–248` | Model-not-found → gpt-4o-mini | If model returns 404/400, falls back to `gpt-4o-mini` with temperature 0.7 |
| **Validation fallback** | `translateLineInternal.ts:284–303` | Alignment failure → fallback mode | If Zod validation fails and not in fallback mode → re-call with simplified prompts (no alignment) |
| **Line auto-retry** | `autoRetryFailedLines.ts` | Exponential backoff | MAX_RETRIES=3, delay=5000×2^retryCount, max 60s. Checks `shouldRetryNow()` based on time since last update |
| **Stanza-level retry** | `processStanza.ts:516–567` | Error classification + requeue | `classifyError()` classifies as retryable/permanent. Retryable → requeue stanza with backoff (2s×2^n, max 30s) |
| **Verification errors** | `errorHandler.ts` | Non-blocking | `isBlockingError()` returns false — verification never blocks translation |

### 4B. Error Classification

From `processStanza.ts:13–91`:

| Error Type | Code | Retryable? |
|------------|------|-----------|
| Timeout/abort | `timeout` | Yes |
| Rate limit (429) | `rate_limit` | Yes |
| Server error (500/502/503) | `server_error` | Yes |
| Model not found (404) | `model_not_found` | No |
| Validation error | `validation_error` | No |
| Auth error (401/403) | `auth_error` | No |
| Unknown | `unknown` | Yes (default) |

### 4C. Fallback Prompts

| Feature | File | Fallback |
|---------|------|----------|
| Notebook: Formal Features | `notebookSuggestionsPrompts.ts:317–325` | `generateFallbackFormalFeatures()` — returns `{ rhymeScheme: null, otherFeatures: [], summary: "try again" }` |
| Notebook: Adjustments | `notebookSuggestionsPrompts.ts:327–341` | `generateFallbackAdjustments()` — returns empty adjustments array |
| Notebook: Personalized | `notebookSuggestionsPrompts.ts:343–363` | `generateFallbackPersonalized()` — returns generic encouragement |
| Rhyme Workshop | `rhymeWorkshopPrompts.ts:381–426` | `generateFallbackRhymeWorkshopResponse()` — empty arrays + basic rhythm data |
| Poem Macro | `poemSuggestions.ts:182–269` | `generateFallbackSuggestions()` — heuristic-based rhyme/tone suggestions |
| Journey Reflection | `generate-reflection/route.ts` | Repair call with gpt-4o-mini (temp 0.3) if response structure is wrong |

### 4D. Rate Limiting

| Component | File | Mechanism |
|-----------|------|-----------|
| Per-user daily limit | `ratelimit/redis.ts` | Upstash Redis counter, 86400s window. Falls back to in-memory Map in dev. Returns `{ success, limit, remaining, reset }` |
| Per-route limit | `translate-line/route.ts:49–64` | `checkDailyLimit(userId, key, maxPerPeriod=600)` — 600 requests per 10 minutes |

---

## 5. EXISTING TEST COVERAGE

### 5A. Test Files Found

| File | Framework | Coverage |
|------|-----------|----------|
| `src/lib/workshop/runTranslationTick.test.ts` | Vitest | Translation tick retryable error handling |
| `src/lib/workshop/__tests__/stuckChunkRecovery.test.ts` | Vitest | Stuck chunk recovery and reconciliation |

### 5B. Test Scripts in package.json

```json
"test:personality": "node scripts/test-translator-personality.cjs"
"worker:translations": "tsx scripts/translation-worker.ts"
```

### 5C. Coverage Gaps

| Area | Test Coverage | Risk Level |
|------|-------------|------------|
| Prompt building functions | **NONE** | Critical |
| JSON response parsing/validation | **NONE** | Critical |
| Diversity gate logic | **NONE** | High |
| Regen prompt + validation pipeline | **NONE** | High |
| API route handlers | **NONE** | High |
| State management (Zustand stores) | **NONE** | Medium |
| Cache operations | **NONE** | Medium |
| Personality derivation | Script only (not automated) | Medium |
| Rate limiting | **NONE** | Low |
| Audit logging/masking | **NONE** | Low |

**Assessment:** Test coverage is extremely sparse. Only 2 test files exist in the entire codebase. No integration tests, no E2E tests, no component tests. The prompt building and response parsing — the core surfaces that Prompt Playground would touch — have zero automated test coverage.

---

## 6. STATE MANAGEMENT RELEVANT TO PROMPTS

### 6A. Zustand Stores

| Store | File | Key Fields | Persistence |
|-------|------|------------|-------------|
| `useGuideStore` | `store/guideSlice.ts` | `poem`, `translationIntent`, `translationZone`, `sourceLanguageVariety`, `translationRangeMode`, `translationModel`, `translationMethod`, `answers` (GuideAnswers) | Thread-aware localStorage via `threadStorage` |
| `useWorkshopStore` | `store/workshopSlice.ts` | `lineTranslations`, `selectedVariant`, `draftLines`, `completedLines`, `poemLines` | Thread-aware localStorage via `threadStorage` |
| `useNotebookStore` | `store/notebookSlice.ts` | Notebook editor state, notes | Thread-aware localStorage via `threadStorage` |

### 6B. Where Custom User Prompts Could Fit

The `GuideAnswers` interface (`guideSlice.ts:12-64`) is the natural extension point:

```typescript
export interface GuideAnswers {
  translationIntent?: string | null;       // ← free-form user instructions
  sourceLanguageVariety?: string | null;
  translationRangeMode?: "focused" | "balanced" | "adventurous";
  translationModel?: string;
  translationMethod?: "method-1" | "method-2";
  // ... legacy fields ...

  // Potential addition:
  // customPromptOverrides?: {
  //   systemPrompt?: string;
  //   variantInstructions?: Record<TranslationRangeMode, string>;
  // };
}
```

**Current architectural patterns that support extension:**
1. `GuideAnswers` already flows through the entire pipeline (API routes → prompt builders → LLM calls)
2. Thread-aware storage already handles per-thread persistence
3. The `USE_SIMPLIFIED_PROMPTS` flag already demonstrates A/B prompt switching
4. Personality derivation (`translatorPersonality.ts`) already combines multiple user inputs into prompt context

### 6C. Settings/Preferences Patterns

The guide store already implements a settings-like pattern:
- `translationModel` — user selects model (gpt-4o, gpt-5-mini, etc.)
- `translationMethod` — user selects method (method-1, method-2)
- `translationRangeMode` — user selects variant diversity (focused/balanced/adventurous)

These are all passed through `guideAnswers` to the backend.

---

## 7. CONFIGURATION & ENVIRONMENT

### 7A. Model Configuration

**File:** `src/lib/models.ts`

| Env Variable | Default | Used For |
|-------------|---------|----------|
| `TRANSLATOR_MODEL` | `gpt-4o` | Main translation calls |
| `ENHANCER_MODEL` | `gpt-5-mini` | Journey reflection, enhancement |
| `ROUTER_MODEL` | `gpt-5-nano-2025-08-07` | Routing/decision making |
| `EMBEDDINGS_MODEL` | `text-embedding-3-large` | Embeddings |
| `VERIFICATION_MODEL` | `gpt-5` | Verification/grading |
| `CONTEXT_MODEL` | `gpt-5-mini` | Context notes generation |

### 7B. Sampling Parameters

**File:** `src/lib/ai/buildSamplingParams.ts`

| Env Variable | Default | Purpose |
|-------------|---------|---------|
| `ENABLE_GPT5_SAMPLING_TUNING` | `0` | Allow sampling params on GPT-5 models |

Non-GPT-5 models use explicit temperature (0.7 for main-gen, 0.9 for regen). GPT-5 models default to no sampling params.

### 7C. Token & Concurrency Limits

| Env Variable | Default | Purpose |
|-------------|---------|---------|
| `MAIN_GEN_MAX_OUTPUT_TOKENS` | `4000` | Max output tokens for main generation |
| `REGEN_MAX_OUTPUT_TOKENS` | `3000` | Max output tokens for regeneration |
| `MAIN_GEN_LINE_CONCURRENCY` | `6` | Parallel line translation (max 8) |
| `MAIN_GEN_PARALLEL_LINES` | `1` (true) | Enable parallel line processing |
| `ENABLE_TICK_TIME_SLICING` | `1` (true) | Budget-aware interruptible processing |

### 7D. Prompt & Schema Control

| Env Variable | Default | Purpose |
|-------------|---------|---------|
| `USE_SIMPLIFIED_PROMPTS` | `0` | Use simplified vs archetype prompt system |
| `ENABLE_STRICT_JSON_SCHEMA` | `1` | Use json_schema format (strict) |
| `STRICT_JSON_SCHEMA_MODELS` | `gpt-5,gpt-5-mini` | Models that use strict schema |
| `STRICT_SCHEMA_FALLBACK_TO_JSON_OBJECT` | `1` | Fallback to json_object if schema fails |
| `ENABLE_STOP_SEQUENCES` | `0` | Apply stop sequences for JSON responses |
| `PROMPT_AUDIT_MODE` | `mask` | Audit prompt mode (mask/hash/full) |

### 7E. Debug Flags

| Env Variable | Default | Purpose |
|-------------|---------|---------|
| `DEBUG_SAMPLING` | `0` | Log sampling parameter handling |
| `DEBUG_STOP_SEQUENCES` | `0` | Log stop sequence application |
| `DEBUG_RAW_COMPLETION` | `0` | Log raw model output preview |
| `DEBUG_MAIN_GEN_OUTPUT` | `0` | Log main-gen raw output |
| `DEBUG_REGEN_OUTPUT` | `0` | Log regen raw output |
| `DEBUG_OUTPUT_ON_PARSE_FAIL` | `1` | Log output when JSON parse fails |
| `DEBUG_OUTPUT_MAX_CHARS` | `8000` | Truncation limit for debug logs |
| `DEBUG_ANCHOR_REALIZATIONS` | `0` | Log anchor realization comparisons |

### 7F. Abstraction Layer

The app has a **thin abstraction layer** between the app and OpenAI:

1. **`openai.ts`** — Singleton client + `responsesCall()` wrapper (Responses API) with audit logging
2. **`chatCompletionsWithRetry.ts`** — Chat Completions wrapper with parameter retry + stop-sequence fallback
3. **`buildSamplingParams.ts`** — Model-aware sampling parameter builder
4. **`buildStopSequences.ts`** — Conditional stop sequence builder

This is NOT a full provider-agnostic abstraction. It's OpenAI-specific throughout (uses `openai.chat.completions.create()` and `openai.responses.create()` directly).

---

## 8. FEASIBILITY ASSESSMENT

### 8A. Complexity Estimate

| Task | Files Affected | New Files Needed | Difficulty |
|------|---------------|-----------------|------------|
| Expose prompts read-only in UI | ~5 components + 1 API route | 1 component, 1 store slice | Low |
| Prompt editing (with preview) | ~8 prompt files + 3 stores + 2 routes | 2-3 components, 1 store | Medium |
| Pipeline visualization flowchart | 0 existing (new feature) | 3-5 components (React Flow already installed) | Medium |
| "Test run" validation for edited prompts | ~5 prompt files + 2 routes | 1 route, 1 service, 1 component | High |
| Full Prompt Playground with persistence | ~15 files + Supabase migration | 5-8 new files | High |

**Total estimated scope:** 15-25 file modifications + 10-15 new files.

### 8B. Risk Areas

| Risk | Severity | Why |
|------|----------|-----|
| **Broken JSON output parsing** | Critical | Every prompt requires strict JSON output. User edits to system prompts that remove JSON format instructions → crash. All 50 prompts have downstream JSON parsers. |
| **Variant count mismatch** | Critical | Main-gen requires exactly 3 variants (label A/B/C). Zod schema enforces `minItems: 3, maxItems: 3`. User prompts producing 2 or 4 variants → validation error. |
| **Diversity gate failure loop** | High | Regen prompts reference existing variant metadata. If user-edited prompt produces variants that always fail the diversity gate, it creates an infinite regen loop (currently capped at 1 retry). |
| **Rhyme Workshop schema violations** | High | The Rhyme Workshop has a 160-line JSON schema with deeply nested required fields. Any prompt edit that changes expected structure → crash. |
| **Locale prompt breakage** | Medium | 24 locale-specific prompts. User edits in English might not carry to other locales. |
| **Cache poisoning** | Medium | Cache keys include threadId + lineIndex + model but NOT prompt content. Edited prompts would serve cached results from old prompts unless cache is invalidated. |
| **Audit trail corruption** | Low | Prompt audit logging masks content. Custom prompts might contain user PII that bypasses masking. |

### 8C. Quick Wins (Safely Exposable with Minimal Risk)

1. **Read-only prompt visualization** — Display current prompts without editing. Zero risk.
   - Show the pipeline flowchart using React Flow (already installed as dependency)
   - Show which prompt file, model, and parameters are used at each stage
   - Display the actual system/user prompts after variable interpolation

2. **`SIMPLIFIED_VARIANT_INSTRUCTIONS` editing** — These are plain English text instructions that don't affect JSON structure.
   - Located at `simplifiedPrompts.ts:26-41`
   - Three mode-specific strings (focused/balanced/adventurous)
   - Output format is still enforced by the system prompt and JSON schema
   - **Risk: Low** — the system prompt still mandates JSON output format

3. **Personality/Synthetic Personality tuning** — These inject context paragraphs into prompts.
   - `domain`, `purpose`, `priority` fields from `translatorPersonality.ts`
   - Vocabulary/rhythm/intimacy knobs from `syntheticPersonality.ts`
   - **Risk: Low** — these are context inputs, not structural

4. **`translationRangeMode` real-time switching** — Already exists in guide store, just needs better UI.
   - Switches between focused/balanced/adventurous
   - **Risk: None** — already implemented

### 8D. Hard Problems

1. **JSON schema enforcement vs. prompt freedom**: Every prompt mandates specific JSON output. Allowing users to edit system prompts risks breaking the JSON format instructions. The app has no runtime recovery for malformed non-JSON responses (it throws errors, triggers fallback mode, or crashes the UI).

2. **Cross-prompt consistency**: Many prompts reference each other's concepts. The regen prompt references diversity gate failure reasons. The notebook suggestions prompt references formal features output from a prior step. User edits to Step 1 could break Step 2.

3. **No test infrastructure**: With only 2 test files in the entire codebase, there's no safety net for validating prompt changes. Building a "test run" validation step requires creating test infrastructure from scratch.

4. **Cache invalidation**: The cache system (`cache.ts`) uses thread+line+model keys but doesn't include prompt content in the key. Prompt edits need cache invalidation logic.

5. **Supabase state model**: Translation jobs persist in Supabase with specific state schemas. Custom prompts need either: (a) a new Supabase table for prompt overrides, or (b) embedding them in the existing `chat_threads.state` JSONB column.

### 8E. Recommended Approach

**Phase 1: Read-Only Pipeline Visualization (Low Risk)**
- Build a React Flow-based pipeline diagram
- Show which prompts, models, and parameters are used at each stage
- Display interpolated prompts for the current translation context
- **No editing yet** — purely diagnostic/educational

**Phase 2: Safe Prompt Editing with "Test Run" Validation (Medium Risk)**
- Allow editing of **variant instructions only** (the `SIMPLIFIED_VARIANT_INSTRUCTIONS` strings)
- Allow editing of **personality context** (domain, purpose, priority)
- Add a "Test Run" button that:
  1. Calls the LLM with the edited prompt
  2. Validates the response against the existing Zod schema
  3. Shows a pass/fail result with the actual LLM output
  4. Does NOT save the result to the main translation state
- Store custom prompt overrides in `guideAnswers` (thread-scoped)

**Phase 3: Full Prompt Playground (Higher Risk, Requires Test Coverage)**
- Allow editing of system prompts with format-enforcement guardrails
- Add a "prompt template" system that preserves JSON format instructions as non-editable header/footer
- Build prompt versioning (undo/history)
- Add prompt diff view (original vs. edited)
- **Prerequisite:** Build test coverage for all prompt building functions and response parsers

### 8F. Testing Strategy (Minimum for Safe Ship)

| Priority | Test | Coverage Target | Effort |
|----------|------|----------------|--------|
| P0 | **Prompt builder unit tests** — every `build*Prompt()` function returns valid string | All 50 prompts | 2-3 days |
| P0 | **Response parser unit tests** — valid/invalid JSON handling for every parser | All Zod schemas + JSON.parse calls | 2-3 days |
| P1 | **Diversity gate unit tests** — Jaccard calculation, threshold logic | `diversityGate.ts` | 1 day |
| P1 | **Integration test: prompt → LLM → parse round-trip** | Main translation (simplified), regen | 2 days |
| P2 | **Prompt edit validation test** — edited prompts still produce valid output | Test run feature | 1-2 days |
| P2 | **Cache invalidation test** — prompt changes clear relevant cache entries | Cache module | 1 day |

**Minimum viable test coverage before shipping Phase 2:** P0 tests (4-6 days of effort).

---

## Appendix: File Reference Index

| Category | File Path | Lines |
|----------|-----------|-------|
| OpenAI Client | `src/lib/ai/openai.ts` | 200 |
| Chat Completions Retry | `src/lib/ai/chatCompletionsWithRetry.ts` | 445 |
| Sampling Params | `src/lib/ai/buildSamplingParams.ts` | 175 |
| Model Config | `src/lib/models.ts` | 20 |
| Simplified Prompts | `src/lib/ai/simplifiedPrompts.ts` | 251 |
| Workshop Prompts | `src/lib/ai/workshopPrompts.ts` | ~850 |
| Regen Prompts | `src/lib/ai/regen.ts` | ~800 |
| Diversity Gate | `src/lib/ai/diversityGate.ts` | ~400 |
| Translator Personality | `src/lib/ai/translatorPersonality.ts` | ~150 |
| Synthetic Personality | `src/lib/ai/syntheticPersonality.ts` | ~150 |
| Variant Recipes | `src/lib/ai/variantRecipes.ts` | ~300 |
| Notebook Suggestions | `src/lib/ai/notebookSuggestionsPrompts.ts` | 364 |
| Rhyme Workshop | `src/lib/ai/rhymeWorkshopPrompts.ts` | 427 |
| Poem Suggestions | `src/lib/ai/poemSuggestions.ts` | 270 |
| Verification | `src/lib/ai/verificationPrompts.ts` | 205 |
| Locale Prompts | `src/lib/ai/localePrompts.ts` | 189 |
| Main Gen Schema | `src/lib/translation/method2/mainGenSchema.ts` | ~50 |
| Translate Line Internal | `src/lib/workshop/translateLineInternal.ts` | 369 |
| Process Stanza | `src/lib/workshop/processStanza.ts` | 702 |
| Run Translation Tick | `src/lib/workshop/runTranslationTick.ts` | ~600 |
| Auto Retry | `src/lib/workshop/autoRetryFailedLines.ts` | ~150 |
| Cache (Redis) | `src/lib/ai/cache.ts` | ~200 |
| Rate Limit | `src/lib/ratelimit/redis.ts` | ~100 |
| Audit Insert | `src/server/audit/insertPromptAudit.ts` | ~50 |
| Audit Mask | `src/server/audit/mask.ts` | ~80 |
| Guide Store | `src/store/guideSlice.ts` | 588 |
| Workshop Store | `src/store/workshopSlice.ts` | 299 |
| API: translate-line | `src/app/api/workshop/translate-line/route.ts` | 215 |
| API: generate-reflection | `src/app/api/journey/generate-reflection/route.ts` | ~200 |
| Total API Routes | `src/app/api/**/route.ts` | 41 routes |
