/**
 * Simplified Static Recipe Builder (Phase 1: Additive Only)
 *
 * Provides a function that returns a static VariantRecipesBundle matching
 * the existing Zod schema, without making any LLM call. This replaces the
 * dynamic archetype-based recipe generation in variantRecipes.ts.
 *
 * Phase 1: Defined but not yet wired into the pipeline.
 * The existing getOrCreateVariantRecipes() and RECIPE_SCHEMA_VERSION in
 * variantRecipes.ts remain untouched.
 */

import {
  type VariantRecipesBundle,
  type VariantRecipe,
  type TranslationRangeMode,
  VariantRecipesBundleSchema,
} from "./variantRecipes";
import { SIMPLIFIED_VARIANT_DESCRIPTIONS } from "./simplifiedPrompts";

/**
 * New recipe schema version. When wired in (Phase 3), this will invalidate
 * all cached v5 recipes so the pipeline uses simplified prompts.
 *
 * NOT YET ACTIVE — the existing RECIPE_SCHEMA_VERSION in variantRecipes.ts
 * remains "v5" until Phase 3.
 */
export const SIMPLIFIED_RECIPE_SCHEMA_VERSION = "v6";

/**
 * Creates a static VariantRecipesBundle that matches the existing Zod type
 * shape without requiring an LLM call.
 *
 * Archetype, lens, and unusualnessBudget are intentionally omitted — these
 * archetype-machinery fields are now optional in the Zod schema (Phase 2).
 * The simplified prompts don't use them.
 *
 * Required fields (verified against variantRecipes.ts Zod schemas):
 * - label: "A" | "B" | "C"                          (z.enum)
 * - directive: variant description string ≤200 chars (z.string().transform)
 * - mode: passed through                            (TranslationRangeModeSchema)
 * - createdAt: number (Date.now())                  (z.number())
 * - modelUsed: "static"                             (z.string())
 *
 * Optional fields intentionally omitted:
 * - archetype, lens, unusualnessBudget (archetype machinery — optional as of v6)
 * - stance_plan (optional since v5, not used by simplified prompts)
 */
export function buildStaticRecipeBundle(params: {
  threadId: string;
  mode: TranslationRangeMode;
  contextHash: string;
}): VariantRecipesBundle {
  const { threadId, mode, contextHash } = params;

  const makeRecipe = (label: "A" | "B" | "C"): VariantRecipe => ({
    label,
    directive: SIMPLIFIED_VARIANT_DESCRIPTIONS[mode][label],
    mode,
    // archetype, lens, unusualnessBudget intentionally omitted —
    // these are archetype-machinery fields not used by simplified prompts.
    // The Zod schema accepts recipes without them (Phase 2).
  });

  // VariantRecipesBundleSchema.recipes is z.tuple of exactly 3 VariantRecipeSchemas
  const bundle = {
    threadId,
    mode,
    contextHash,
    recipes: [makeRecipe("A"), makeRecipe("B"), makeRecipe("C")] as [
      VariantRecipe,
      VariantRecipe,
      VariantRecipe,
    ],
    createdAt: Date.now(),
    modelUsed: "static",
  };

  // Runtime validation — fail fast if the bundle doesn't match the Zod schema.
  // This catches any drift between this builder and the canonical schema.
  const parsed = VariantRecipesBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    console.error(
      "[simplifiedRecipes] Static bundle failed Zod validation:",
      parsed.error.issues
    );
    throw new Error(
      `Static recipe bundle failed Zod validation: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
