# ADR 0002: Replace Archetype-Based Recipe System with Simplified Prompts

## Status
Accepted (Strategy B — permanent feature flag, default on)

## Context
The original translation pipeline used an archetype-based recipe system with three
archetypes (Essence Cut, Prismatic Reimagining, World & Voice Transposition). Each
translation required an LLM call to generate variant recipes (30-90s latency), which
then drove prompt construction with lens configs (imagery, voice, sound, syntax,
cultural), stance plans, unusualness budgets, and archetype-specific MUST rules.

Matthew (client) requested simpler, source-text-centered prompts that give the LLM
clearer, more direct instructions per translation mode (Focused, Balanced, Adventurous)
without the archetype abstraction layer.

### Problems with the archetype system
- **Latency:** Recipe generation added 30-90s to first-time translations.
- **Prompt complexity:** ~1900 tokens of archetype/lens instructions per translation.
- **Opacity:** Archetype rules were hard to reason about and tune.
- **Diversity gate friction:** Strict thresholds rejected intentionally-close Focused mode
  translations, triggering unnecessary regeneration cycles.

## Decision
Replace the archetype recipe system with simplified, mode-specific prompts gated behind
`USE_SIMPLIFIED_PROMPTS=1` (default on). The old archetype system is preserved for
rollback via `USE_SIMPLIFIED_PROMPTS=0`.

### Implementation (Phases 1-7)
1. **Phase 1-2:** Added `simplifiedPrompts.ts` and `simplifiedRecipes.ts` with Matthew's
   mode-specific variant instructions and static recipe builder. Widened types to make
   archetype fields optional.
2. **Phase 3:** `getOrCreateVariantRecipes()` returns static recipes instantly when flag
   is on — no LLM call, no cache, no lock.
3. **Phase 4:** `buildRecipeAwarePrismaticPrompt()` uses simplified system/user prompts
   (~480 tokens vs ~1900).
4. **Phase 5:** Diversity gate thresholds relaxed for Focused/Balanced modes — close
   translations are intentional, not defects.
5. **Phase 6:** Regen prompts use `SIMPLIFIED_VARIANT_DESCRIPTIONS` instead of archetype
   directives, preserving anti-copy and contrastive constraint systems.
6. **Phase 7:** Resolved TODO comments, gated diagnostic logging, added rollback
   documentation, created this ADR.

## Options Considered

### Option A: Full Graduation (delete old code)
- Pros: Clean codebase, no dual-path complexity.
- Cons: No rollback without git revert. Requires Matthew's final approval of translation quality.

### Option B: Permanent Feature Flag (selected)
- Pros: Instant rollback via env var. Lower risk. Old code preserved.
- Cons: Dual code paths increase cognitive load. Non-null assertions replaced with optional chaining fallbacks.

## Consequences

### Positive
- Recipe generation latency eliminated (30-90s -> 0ms).
- Prompt tokens reduced ~75% (1900 -> 480).
- Simpler mental model for translation modes.
- Focused mode translations no longer falsely rejected by diversity gate.

### Negative
- Two complete prompt systems coexist in the codebase.
- `VariantRecipe` type has optional archetype fields that are always undefined in v6.

### Neutral
- Schema version bumped from v5 to v6 — old cached recipes are automatically invalidated.
- Adventurous mode thresholds are unchanged.
- Anti-copy and contrastive constraint systems in regen are preserved.

## Rollback Procedure
1. Set `USE_SIMPLIFIED_PROMPTS=0` in `.env.local` or Vercel dashboard.
2. Note: `RECIPE_SCHEMA_VERSION` is v6, so old v5 cached recipes need regeneration
   (one-time LLM cost on first translation).
3. All diversity gate thresholds revert to original values.
4. Regen prompts revert to archetype-based directives.

## Links
- Branch: `fix/app-context-loss`
- Files changed: `variantRecipes.ts`, `workshopPrompts.ts`, `diversityGate.ts`,
  `regen.ts`, `anchorsValidation.ts`, `simplifiedPrompts.ts`, `simplifiedRecipes.ts`
