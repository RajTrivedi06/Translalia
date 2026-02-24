# Translalia Translation Pipeline Architecture

This document describes the translation pipeline architecture, including the recipe system, optimization techniques, quality gates, and design decisions.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Translation Methods](#2-translation-methods)
3. [Recipe System](#3-recipe-system)
4. [Pipeline Flow](#4-pipeline-flow)
5. [Optimization Techniques](#5-optimization-techniques)
6. [Quality Gates](#6-quality-gates)
7. [Caching Strategy](#7-caching-strategy)
8. [Design Decisions](#8-design-decisions)

---

## 1. Pipeline Overview

Translalia's translation pipeline generates **3 distinct translation variants (A, B, C)** for each line of poetry. Each variant follows a different artistic archetype, giving students meaningful choices rather than synonymous options.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Translation Request                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Recipe Generation                             │
│  (Once per thread+mode, cached in DB)                           │
│  - Generates 3 archetype recipes (A, B, C)                      │
│  - Mode: focused / balanced / adventurous                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Prismatic Generation                           │
│  (Per line, using cached recipes)                                │
│  - Generates 3 variants following recipes                        │
│  - Runs diversity gate checks                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Quality Gates                                 │
│  - Distinctness check (Jaccard similarity)                       │
│  - Stance plan enforcement (Variant C)                           │
│  - Regeneration if gates fail                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Alignment Generation                            │
│  (Batched for 3 variants in 1 API call)                         │
│  - Word-by-word mapping                                          │
│  - Part-of-speech tagging                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Final Response                                │
│  - 3 variants with alignments                                    │
│  - Metadata (literalness, character count, etc.)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Translation Methods

### Method 1: Literalness Spectrum (Legacy)

**Source:** `src/lib/workshop/translateLineInternal.ts`

The original translation method that generates 3 variants along a literalness spectrum:
- Variant 1: Most literal (high literalness score)
- Variant 2: Balanced (medium literalness)
- Variant 3: Most creative (low literalness)

**Status:** Legacy, still available but not the primary method.

### Method 2: Recipe-Aware Prismatic Variants (Primary)

**Source:** `src/lib/translation/method2/translateLineWithRecipesInternal.ts`

The current primary method that uses archetype-based recipes:
- **Variant A:** Essence Cut - distilled, compressed, emotionally clear
- **Variant B:** Prismatic Reimagining - fresh metaphor system
- **Variant C:** World & Voice Transposition - shifted narrator stance

**Why Method 2 is better:**
- Variants are artistically distinct, not just synonymous
- Consistent artistic approach across all lines (via cached recipes)
- Mode scaling (focused/balanced/adventurous) gives user control
- Stance plans prevent voice flipping in Variant C

---

## 3. Recipe System

### 3.1 Schema Version

Current schema version: **v5** (Phase 1: Added stance plan for variant C)

### 3.2 Three Archetypes

Each variant has a **fixed archetype** that defines its artistic identity:

| Archetype | Variant | Purpose | Key Characteristic |
|-----------|---------|---------|-------------------|
| **Essence Cut** | A | Distill to emotional core | Compressed, clean, no filler |
| **Prismatic Reimagining** | B | Fresh metaphor system | New central images, different visual framing |
| **World & Voice Transposition** | C | Shift narrator/world | Different perspective, time, or register |

### 3.3 Lens Configuration

Each recipe includes a **lens** that configures translation dimensions:

| Dimension | Options | Description |
|-----------|---------|-------------|
| **imagery** | preserve, adapt, substitute, transform | How to handle metaphors/images |
| **voice** | preserve, shift, collective, intimate | Narrative perspective |
| **sound** | preserve, adapt, prioritize, ignore | Phonetic qualities |
| **syntax** | preserve, adapt, fragment, invert | Sentence structure |
| **cultural** | preserve, adapt, hybrid, localize | Cultural references |

### 3.4 Translation Modes

| Mode | Description | Unusualness Budgets |
|------|-------------|---------------------|
| **Focused** | Conservative, subtle artistic choices | low, low, medium |
| **Balanced** | Clear artistic differentiation | low, medium, medium |
| **Adventurous** | Bold reframes, expressive limits | low, medium, high |

### 3.5 Stance Plan (Variant C Only)

To prevent **voice flipping** between lines (e.g., "I" in line 1, "we" in line 5), Variant C includes a **stance plan** that's committed at the poem level:

```typescript
interface StancePlan {
  subject_form: "we" | "you" | "third_person" | "impersonal" | "i";
  world_frame?: string;      // e.g., "late-night city"
  register_shift?: string;   // e.g., "more_colloquial"
  notes?: string;
}
```

**Important:** In balanced/adventurous modes, `subject_form` cannot be "i" - this ensures meaningful perspective shift.

### 3.6 Recipe Storage

Recipes are stored per-mode in the thread state:

```typescript
interface PerModeRecipeCache {
  focused?: VariantRecipesBundle;
  balanced?: VariantRecipesBundle;
  adventurous?: VariantRecipesBundle;
}

// Stored in: chat_threads.state.variant_recipes_v3
```

---

## 4. Pipeline Flow

### 4.1 Interactive Flow (User-Triggered)

```
User clicks "Translate Line"
       │
       ▼
useTranslateLine hook (frontend)
       │
       ▼
POST /api/workshop/translate-line-with-recipes
       │
       ▼
Authentication + Rate Limiting
       │
       ▼
translateLineWithRecipesInternal()
       │
       ├──► getOrCreateVariantRecipes() ──► [Cache check: memory → DB → generate]
       │
       ▼
buildRecipeAwarePrismaticPrompt()
       │
       ▼
OpenAI API call (main generation)
       │
       ▼
checkDistinctness() ──► [Fails?] ──► regenerateVariantWithSalvage()
       │
       ▼
generateAlignmentsBatched() (3 variants in 1 call)
       │
       ▼
Return LineTranslationResponse
```

### 4.2 Background Batch Flow

For pre-translating entire poems:

```
POST /api/workshop/initialize-translations
       │
       ▼
createTranslationJob() → creates job state in DB
       │
       ▼
enqueueTranslationJob() → adds to Redis queue
       │
       ▼
Worker polls /api/workshop/translation-status?advance=true
       │
       ▼
runTranslationTick() [with per-thread lock]
       │
       ├──► Pre-warm recipes (prevents contention)
       │
       ▼
Process stanzas in parallel (up to maxStanzasPerTick)
       │
       ▼
processStanza() → processes lines in parallel (up to 6-8 concurrent)
       │
       ▼
translateLineWithRecipesInternal() per line
       │
       ▼
Update job state incrementally
       │
       ▼
Auto-retry failed lines
```

---

## 5. Optimization Techniques

### 5.1 Multi-Layer Caching

**Source:** `src/lib/ai/cache.ts`

| Layer | Implementation | TTL | Use Case |
|-------|---------------|-----|----------|
| **Memory** | Upstash Redis (prod) / in-memory Map (dev) | 3600s | Fast lookups |
| **Database** | Supabase JSONB | Persistent | Recipe storage |

**Cache Keys:**
- Translations: `cache:workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}`
- Recipes: `cache:recipes:{threadId}:{mode}:{contextHash}`
- Suggestions: `cache:suggestions:line:{threadId}:{lineIndex}:{hash}`

### 5.2 Parallel Processing

#### Stanza-Level Parallelism

```typescript
// Config
ENABLE_PARALLEL_STANZAS = true (default)
MAX_STANZAS_PER_TICK = 4 (default, max: 5)
```

Processes multiple stanzas concurrently within a single tick.

#### Line-Level Parallelism

```typescript
// Config
MAIN_GEN_PARALLEL_LINES = true (default)
MAIN_GEN_LINE_CONCURRENCY = 6 (default, max: 8)
```

Uses `ConcurrencyLimiter` class to bound concurrent line translations within a stanza.

### 5.3 Batched Alignment Generation

**Source:** `src/lib/ai/alignmentGenerator.ts`

Instead of 3 separate API calls per line (one per variant), alignments are batched:

```
Before: 3 API calls × N lines = 3N calls
After:  1 API call × N lines = N calls
```

**Fallback:** If batched call fails validation, falls back to parallel individual calls.

### 5.4 Recipe Pre-Warming

Before parallel stanza processing, recipes are pre-warmed:

```typescript
// Prevents lock contention when multiple chunks start simultaneously
await getOrCreateVariantRecipes(threadId, guideAnswers, poemContext, mode);
```

### 5.5 Time Slicing and Budget Management

**Source:** `src/lib/workshop/runTranslationTick.ts`

```typescript
// Config
ENABLE_TICK_TIME_SLICING = true (default)
maxProcessingTimeMs = 30000 (30 seconds per tick)
```

Processing is interruptible:
- Checks time budget before each line
- Tracks absolute deadline timestamps
- Gracefully stops and resumes in next tick

### 5.6 Distributed Locking

**Source:** `src/lib/ai/cache.ts`

| Lock | TTL | Purpose |
|------|-----|---------|
| `tick:{threadId}` | 600s | Prevents concurrent tick processing |
| `recipe-gen:{threadId}:{mode}:{contextHash}` | 90s | Prevents duplicate recipe generation |

**Lock Features:**
- UUID tokens prevent releasing others' locks
- Heartbeat extends TTL during long operations
- Exponential backoff on contention (200ms base, 3s max)

### 5.7 Job Queue System

**Source:** `src/lib/workshop/translationQueue.ts`

- Redis queue: `translation:queue` (FIFO)
- Active set: `translation:queue:active` (prevents duplicates)
- De-duplication via SADD

### 5.8 Incremental State Updates

Uses JSONB patches for safe concurrent updates:

```typescript
await patchThreadStateField(threadId, ["variant_recipes_v3"], updatedV3);
```

Features:
- Optimistic concurrency control
- Version checking
- Reconciliation for stuck chunks

---

## 6. Quality Gates

### 6.1 Distinctness Gate

**Source:** `src/lib/ai/diversityGate.ts`

Ensures the 3 variants are meaningfully different using **Jaccard similarity**:

```typescript
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}
```

**Thresholds:** Length-aware thresholds adjust for short vs long lines.

**On Failure:** Triggers `regenerateVariantWithSalvage()` for the least distinct variant.

### 6.2 Structural Signature Detection

Extracts opener types to ensure surface variety:

| Opener Type | Description | Example |
|-------------|-------------|---------|
| PREP | Preposition-first | "In the garden..." |
| NOUN_PHRASE | Article + noun | "The moon rises..." |
| PRON | Pronoun-first | "We dance..." |
| OTHER | Verb, adjective, fragment | "Dancing..." |

### 6.3 Regeneration with Contrastive Constraints

When regenerating a failed variant:

1. **Extract overused features** from the two "good" variants
2. **Build contrastive constraints** (DO NOT USE / MUST DO)
3. **Target different opener type** to force structural variety
4. **Ban first tokens** from existing variants

### 6.4 Stance Plan Enforcement

For Variant C, the system:
1. Validates stance plan exists and is valid
2. Checks mode forbids "i" (in balanced/adventurous)
3. Falls back to deterministic stance plan if invalid

```typescript
function generateDeterministicStancePlan(threadId: string, mode: TranslationRangeMode): StancePlan {
  const allowedForms = ["we", "you", "third_person", "impersonal"];
  const hash = stableHash(`${threadId}:${mode}:stance_v1`);
  const hashNum = parseInt(hash.slice(0, 8), 16);
  return { subject_form: allowedForms[hashNum % allowedForms.length] };
}
```

---

## 7. Caching Strategy

### 7.1 Context Hash Computation

Recipes are invalidated when context changes:

```typescript
function computeRecipeContextHash(
  guideAnswers: GuideAnswers,
  sourceLanguage: string,
  targetLanguage: string,
  poemHash?: string
): string {
  const relevant = {
    schemaVersion: RECIPE_SCHEMA_VERSION,  // Invalidate on schema change
    intent: guideAnswers.translationIntent ?? "",
    zone: guideAnswers.translationZone ?? "",
    srcLang: sourceLanguage,
    tgtLang: targetLanguage,
    poemHash: poemHash ?? "",
  };
  return stableHash(relevant);
}
```

### 7.2 Cache Lookup Order

```
1. Memory cache (Redis/Map) → fastest
       ↓ miss
2. DB cache (v3 per-mode) → check mode slot
       ↓ miss
3. DB cache (v2 single bundle) → backward compat, migrate to v3
       ↓ miss
4. Generate new recipes (with lock)
```

### 7.3 Cache Invalidation Triggers

| Trigger | Effect |
|---------|--------|
| Schema version change | All recipes invalidated |
| Translation intent change | Context hash changes |
| Translation zone change | Context hash changes |
| Source/target language change | Context hash changes |
| Poem text change | Poem hash changes |
| `forceRefresh` parameter | Bypasses cache |
| Model change | Model included in translation cache key |

---

## 8. Design Decisions

### 8.1 Why 3 Archetypes?

**Problem:** Literalness spectrum (literal → creative) often produces synonymous variants.

**Solution:** Fixed archetypes ensure each variant serves a distinct purpose:
- **Essence Cut:** For students who want clarity and compression
- **Prismatic Reimagining:** For students exploring imagery
- **World & Voice Transposition:** For students experimenting with perspective

### 8.2 Why Recipe Caching?

**Problem:** Without caching, each line might get different "artistic approaches," causing inconsistency.

**Solution:** Generate recipes once per thread+mode+context:
- Variant B always uses the same metaphor strategy across all lines
- Variant C maintains consistent perspective throughout the poem
- Users can switch modes and get different (but internally consistent) recipes

### 8.3 Why Stance Plans for Variant C?

**Problem:** Without commitment, Variant C might use "I" in line 1, "we" in line 3, "you" in line 7.

**Solution:** Stance plan commits to a subject form at the poem level:
- Generated during recipe creation
- Deterministic fallback if LLM fails
- Mode-aware constraints (no "i" in balanced/adventurous)

### 8.4 Why Batched Alignments?

**Problem:** 3 alignment API calls per line is expensive and slow.

**Solution:** Batch all 3 variants into 1 API call:
- Reduces latency by ~60%
- Reduces cost by ~60%
- Fallback to parallel calls if batch fails

### 8.5 Why Contrastive Regeneration?

**Problem:** Simple regeneration often produces variants similar to existing ones.

**Solution:** Analyze what makes existing variants similar, then explicitly forbid those patterns:
- Extract overused opener types
- Ban specific token sequences
- Target different structural patterns
- Provide contrastive constraints in prompt

### 8.6 Why No Streaming?

**Decision:** JSON-first outputs, no streaming (see root LLM docs in `docs/05-llm/DOC_MAP.md`)

**Rationale:**
- Structured JSON is easier to validate
- UI updates happen all-at-once, not incrementally
- Retry logic is simpler with complete responses
- Token usage tracking is more accurate

### 8.7 Why Distributed Locking?

**Problem:** Multiple concurrent requests might generate duplicate recipes.

**Solution:** Atomic lock acquisition with:
- UUID tokens (prevent releasing others' locks)
- TTL-based expiration (prevent deadlocks)
- Exponential backoff (reduce contention)
- Double-check after lock acquisition (handle race conditions)

---

## API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/workshop/translate-line-with-recipes` | POST | Method 2 translation |
| `/api/workshop/translate-line` | POST | Method 1 translation (legacy) |
| `/api/workshop/initialize-translations` | POST | Start batch translation job |
| `/api/workshop/translation-status` | GET | Poll job status, auto-advance |
| `/api/workshop/save-line` | POST | Save completed translation |
| `/api/workshop/additional-suggestions` | POST | Get more word suggestions |
| `/api/workshop/token-suggestions` | POST | Word-level suggestions |
| `/api/workshop/line-suggestions` | POST | Line-level suggestions |
| `/api/workshop/rhyme-workshop` | POST | Rhyme/sound/rhythm suggestions |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSLATOR_MODEL` | gpt-4o | Main translation model |
| `VERIFICATION_MODEL` | gpt-5 | Verification/grading model |
| `CONTEXT_MODEL` | gpt-5-mini | Context notes model |
| `MAIN_GEN_MAX_OUTPUT_TOKENS` | 4000 | Max output tokens for main gen |
| `MAIN_GEN_LINE_CONCURRENCY` | 6 | Concurrent lines per stanza |
| `MAX_STANZAS_PER_TICK` | 4 | Concurrent stanzas per tick |
| `ENABLE_PARALLEL_STANZAS` | 1 | Enable stanza parallelism |
| `ENABLE_TICK_TIME_SLICING` | 1 | Enable time budget management |
| `ENABLE_COMPRESSED_RECIPES` | 0 | Use compressed recipe format |
| `DEBUG_VARIANTS` | 0 | Enable variant debugging logs |
| `DEBUG_LOCK` | 0 | Enable lock debugging logs |
| `DEBUG_PROMPT_SIZES` | 0 | Log prompt token sizes |

---

## Related Documentation

- [PROMPTS.md](./PROMPTS.md) - All AI prompts with exact content and explanations
- [LLM_CONTEXT.md](./LLM_CONTEXT.md) - Legacy deep reference (deprecated as primary source)
- [../../docs/05-llm/DOC_MAP.md](../../docs/05-llm/DOC_MAP.md) - Primary routing for current LLM docs
- Source files in `src/lib/ai/` and `src/lib/workshop/` for implementation details
