# Translalia Translation Pipeline

## What this file is for
Describes the current workshop translation path, batch job flow, and rollback branches.

## When to read/use this
- Read when debugging workshop translation, retries, queueing, or job-state persistence.
- Use `docs/01-architecture/data-flow.md` for the higher-level flow first.

## Current default
- The frontend defaults to `translationMethod="method-2"` through `src/lib/hooks/useTranslateLine.ts`.
- The intended operating mode is simplified prompts, but the code only activates that branch when `USE_SIMPLIFIED_PROMPTS=1`.
- Method 1 still exists as a compatible legacy path.

## Interactive line translation
1. The frontend hook `src/lib/hooks/useTranslateLine.ts` chooses:
   - `/api/workshop/translate-line-with-recipes` for `method-2`
   - `/api/workshop/translate-line` for `method-1`
2. The Method 2 route validates auth and payload, then calls `src/lib/translation/method2/translateLineWithRecipesInternal.ts`.
3. `translateLineWithRecipesInternal()` derives `translationRangeMode` from guide answers, defaulting to `balanced`.
4. `getOrCreateVariantRecipes()` resolves the per-thread, per-mode recipe bundle.
   - In simplified mode, it returns static v6 recipes immediately.
   - In rollback mode, it can generate or load archetype-heavy cached recipes.
5. `buildRecipeAwarePrismaticPrompt()` builds the main prompt.
   - In simplified mode, it delegates to `src/lib/ai/simplifiedPrompts.ts`.
   - In rollback mode, it emits the archetype/lens prompt blocks.
6. The main generation call runs through strict-schema / fallback logic where supported.
7. Post-generation checks run in this order:
   - anchor validation
   - fidelity gate
   - diversity gate
   - targeted regeneration / salvage if a variant is too similar or fails checks
8. The final response is returned as `LineTranslationResponse` plus `qualityMetadata`.

## Method 2 output behavior
- The returned structure matches `src/types/lineTranslation.ts`.
- `translations[*].fullText` is authoritative for Method 2.
- `translations[*].words` is currently empty in this path.
- `qualityMetadata` captures whether the line passed, needed salvage, or failed stricter checks.
- Prompt and gate diagnostics can also be pushed to thread state or audit tables when debug/persist flags are enabled.

## Alignment status
- Method 1 still generates word alignment inline.
- Method 2 does not currently wait for alignment before returning text.
- `translateLineWithRecipesInternal()` leaves alignment enqueueing commented out and returns empty `words` arrays.
- Batch job state still supports later alignment updates through `src/lib/workshop/jobState.ts`, but current stanza processing marks alignment as `skipped` for Method 2 lines.
- If you are changing drag-and-drop or word-level UI assumptions, verify whether the caller expects populated `words` arrays.

## Batch translation flow
1. `/api/workshop/initialize-translations` creates a translation job in `chat_threads.state.translation_job`.
2. `src/lib/workshop/translationQueue.ts` and Redis-backed queueing can enqueue the thread for background work.
3. `/api/workshop/translation-status?advance=true` can trigger `src/lib/workshop/runTranslationTick.ts`.
4. `runTranslationTick()` acquires a per-thread Redis lock, loads job state, and pre-warms recipes for the chosen mode.
5. It processes chunks/stanzas with bounded parallelism from env controls such as:
   - `MAX_STANZAS_PER_TICK`
   - `CHUNK_CONCURRENCY`
   - `MAIN_GEN_LINE_CONCURRENCY`
   - `TICK_TIME_BUDGET_MS`
6. Each line goes through the same Method 2 core function used by the interactive route.
7. Job state persists progress, retries, quality metadata, and `alignmentStatus`.

## Persistence surfaces
- Thread columns carry the normalized guide fields such as `translation_model`, `translation_method`, `translation_intent`, and `translation_zone`.
- `chat_threads.state` still carries working structures such as:
  - `poem_stanzas`
  - `raw_poem`
  - `translation_job`
  - `variant_recipes_v3`
  - `method2_audit`
- Audit tables include `prompt_audits` and `translation_audits`.

## Rollback and legacy branches
- Method 1: `src/lib/workshop/translateLineInternal.ts`
- Archetype-heavy Method 2 prompts: active only with `USE_SIMPLIFIED_PROMPTS=0`
- Older narrative context notes: `translalia-web/docs/LLM_CONTEXT.md` is deprecated and should not be loaded by default

## Files to open for specific failures
- Route/auth issue: `src/app/api/workshop/translate-line-with-recipes/route.ts`
- Bad variant diversity: `src/lib/ai/diversityGate.ts`
- Regen loop or salvage issue: `src/lib/ai/regen.ts`
- Recipe cache or contention: `src/lib/ai/variantRecipes.ts`
- Job-state overwrite or concurrency issue: `src/lib/workshop/jobState.ts`, `src/lib/workshop/runTranslationTick.ts`
- Retry behavior: `src/app/api/workshop/retry-line/route.ts`, `src/lib/workshop/autoRetryFailedLines.ts`

## Next docs
- `PROMPTS.md` for prompt-family routing
- `docs/02-reference/database.md` for tables and RPCs
- `docs/02-reference/config-and-env.md` for flags that affect throughput and prompt behavior
