/**
 * Variant Recipes System (v2 - Archetype-Based)
 *
 * Generates and caches reusable "viewpoint recipes" for prismatic translation variants.
 * Recipes are generated once per thread (or when context changes) and applied to each line.
 *
 * Key concepts:
 * - Archetype: Fixed artistic identity (essence_cut / prismatic_reimagining / world_voice_transposition)
 * - Lens: Configuration for translation perspective (imagery, voice, sound, syntax, cultural)
 * - Recipe: A reusable viewpoint definition (archetype, label, lens, directive, unusualnessBudget)
 * - Bundle: Collection of 3 recipes with metadata (mode, contextHash, createdAt)
 *
 * Schema version: v2 introduces archetypes for distinct artistic variants
 */

/**
 * Schema version for recipe cache invalidation.
 *
 * v5 → v6: Simplified prompts (client request). Archetype fields now optional.
 * Static recipes replace LLM-generated recipes when USE_SIMPLIFIED_PROMPTS=1.
 * Bumping the version invalidates all cached v5 recipes, forcing fresh generation
 * (or static return) on next request.
 */
export const RECIPE_SCHEMA_VERSION = "v6";

import { z } from "zod";
import { stableHash } from "./cache";
import type { GuideAnswers } from "@/store/guideSlice";

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Translation range mode - controls how wide the variants range
 */
export const TranslationRangeModeSchema = z.enum([
  "focused",
  "balanced",
  "adventurous",
]);
export type TranslationRangeMode = z.infer<typeof TranslationRangeModeSchema>;

/**
 * Lens configuration for translation perspective
 * Each axis controls a different aspect of the translation approach
 */
export const LensSchema = z.object({
  /** How to handle imagery/metaphors */
  imagery: z.enum(["preserve", "adapt", "substitute", "transform"]),
  /** Narrative voice/perspective */
  voice: z.enum(["preserve", "shift", "collective", "intimate"]),
  /** Sound/phonetic qualities */
  sound: z.enum(["preserve", "adapt", "prioritize", "ignore"]),
  /** Syntactic structure */
  syntax: z.enum(["preserve", "adapt", "fragment", "invert"]),
  /** Cultural references */
  cultural: z.enum(["preserve", "adapt", "hybrid", "localize"]),
});
export type Lens = z.infer<typeof LensSchema>;

/**
 * Unusualness budget - how "creative" this variant is allowed to be
 */
export const UnusualnessBudgetSchema = z.enum(["low", "medium", "high"]);
export type UnusualnessBudget = z.infer<typeof UnusualnessBudgetSchema>;

/**
 * Archetype - fixed artistic identity for each variant
 * - essence_cut: Distill core meaning + emotional contour; clean, legible, not literal
 * - prismatic_reimagining: Fresh metaphor system; new central image/noun anchors
 * - world_voice_transposition: Shift narrator stance / world-frame (time, place, register)
 */
export const ArchetypeSchema = z.enum([
  "essence_cut",
  "prismatic_reimagining",
  "world_voice_transposition",
]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

/**
 * Hard-mapped archetype assignments by label
 */
export const LABEL_TO_ARCHETYPE: Record<"A" | "B" | "C", Archetype> = {
  A: "essence_cut",
  B: "prismatic_reimagining",
  C: "world_voice_transposition",
};

/**
 * Phase 1: Stance plan for Variant C (poem-level, stable across all lines in a thread+mode)
 */
export const StancePlanSchema = z.object({
  /** Subject form for narrator stance (NO "i" in balanced/adventurous by default) */
  subject_form: z.enum(["we", "you", "third_person", "impersonal", "i"]),
  /** Optional world/setting frame (e.g., "late-night city", "rural coastline") */
  world_frame: z.string().optional(),
  /** Optional register shift direction */
  register_shift: z
    .enum([
      "more_colloquial",
      "more_formal",
      "more_regional",
      "more_spoken",
      "more_lyrical",
    ])
    .optional(),
  /** Optional short practical notes */
  notes: z.string().optional(),
});
export type StancePlan = z.infer<typeof StancePlanSchema>;

/**
 * A single variant recipe - defines one of the A/B/C viewpoints.
 *
 * Fields marked .optional() are archetype-machinery fields that were required
 * in the v5 recipe system (Essence Cut / Prismatic Reimagining / World & Voice
 * Transposition). They are optional as of v6 to support the simplified prompt
 * system requested by the client.
 *
 * Existing v5 cached recipes still have these fields populated and will
 * continue to parse successfully. New v6 static recipes may omit them.
 */
export const VariantRecipeSchema = z.object({
  /** Variant label (A, B, or C) */
  label: z.enum(["A", "B", "C"]),
  /** Archetype - fixed artistic identity (optional as of v6) */
  archetype: ArchetypeSchema.optional(),
  /** Lens configuration for this variant (optional as of v6) */
  lens: LensSchema.optional(),
  /** Short imperative directive (1-2 lines) - truncated to 200 chars if LLM returns longer */
  directive: z.string().transform((s) => s.slice(0, 200)),
  /** How unusual/creative this variant is allowed to be (optional as of v6) */
  unusualnessBudget: UnusualnessBudgetSchema.optional(),
  /** Which mode created this recipe */
  mode: TranslationRangeModeSchema,
  /** Phase 1: Stance plan (only for variant C / world_voice_transposition) */
  stance_plan: StancePlanSchema.optional(),
});
export type VariantRecipe = z.infer<typeof VariantRecipeSchema>;

/**
 * Bundle of 3 recipes with metadata
 * Stored in chat_threads.state.variant_recipes_v2 (with v1 fallback for reads)
 */
export const VariantRecipesBundleSchema = z.object({
  /** Thread ID this bundle belongs to */
  threadId: z.string(),
  /** Translation range mode used to generate these recipes */
  mode: TranslationRangeModeSchema,
  /** SHA-256 hash of relevant context (for cache invalidation) */
  contextHash: z.string(),
  /** The three recipes (A, B, C) */
  recipes: z.tuple([
    VariantRecipeSchema,
    VariantRecipeSchema,
    VariantRecipeSchema,
  ]),
  /** Timestamp when recipes were generated */
  createdAt: z.number(),
  /** Model used to generate recipes */
  modelUsed: z.string(),
  /** Optional debug information (gated behind env flag) */
  debug: z.any().optional(),
});
export type VariantRecipesBundle = z.infer<typeof VariantRecipesBundleSchema>;

/**
 * Phase 4: Recipe cache information for audit logging
 */
export interface RecipeCacheInfo {
  cacheHit: "memory" | "db" | "miss";
  schemaVersion: string;
  bundleKey?: string;
}

/**
 * Phase 4: Extract cache info from a recipe bundle for audit logging.
 * Call this immediately after getOrCreateVariantRecipes to determine cache status.
 *
 * Note: This is a helper that inspects bundle metadata. The actual cache detection
 * happens inside getOrCreateVariantRecipes and is logged via DEBUG_VARIANTS.
 * For audit purposes, we infer from createdAt timestamp (fresh < 5s = miss, else db/memory).
 */
export function extractRecipeCacheInfo(
  bundle: VariantRecipesBundle,
  wasJustCreated: boolean = false
): RecipeCacheInfo {
  const age = Date.now() - bundle.createdAt;

  // If bundle was created within last 5 seconds, it's a fresh generation (miss)
  const cacheHit: RecipeCacheInfo["cacheHit"] =
    wasJustCreated || age < 5000 ? "miss" : "db";

  return {
    cacheHit,
    schemaVersion: RECIPE_SCHEMA_VERSION,
    bundleKey: bundle.contextHash?.slice(0, 8), // Short hash for debugging
  };
}

// =============================================================================
// Context Hash Computation
// =============================================================================

/**
 * Computes a stable hash of all inputs that affect recipe generation.
 *
 * HARDENING (Method 2): Simplified to core fields only.
 * Legacy fields (stance/vibes/policy) are no longer included in hash
 * to reduce cache fragmentation and simplify recipe caching.
 *
 * Recipes are invalidated when ANY of these change:
 * - Schema version (RECIPE_SCHEMA_VERSION)
 * - translationIntent
 * - translationZone
 * - Source/target language pair
 * - Poem text (via poemHash)
 */
export function computeRecipeContextHash(
  guideAnswers: GuideAnswers,
  sourceLanguage: string,
  targetLanguage: string,
  poemHash?: string
): string {
  const relevant = {
    schemaVersion: RECIPE_SCHEMA_VERSION, // Invalidate cache when schema changes
    intent: guideAnswers.translationIntent ?? "",
    zone: guideAnswers.translationZone ?? "",
    // REMOVED: stance, vibes, mustKeep, noGo (legacy fields, not used in Method 2)
    srcLang: sourceLanguage,
    tgtLang: targetLanguage,
    poemHash: poemHash ?? "",
  };
  return stableHash(relevant);
}

// =============================================================================
// Mode-Specific Recipe Constraints
// =============================================================================

/**
 * Mode-specific constraints for recipe generation
 */
export interface ModeConstraints {
  /** Distribution of unusualness budgets */
  unusualnessBudgets: [UnusualnessBudget, UnusualnessBudget, UnusualnessBudget];
  /** Lens constraints description for the prompt */
  lensGuidance: string;
  /** Minimum lens differences required between variants */
  minLensDiffs: number;
}

/**
 * Get mode-specific constraints for recipe generation
 */
export function getModeConstraints(mode: TranslationRangeMode): ModeConstraints {
  switch (mode) {
    case "focused":
      return {
        unusualnessBudgets: ["low", "low", "medium"],
        lensGuidance: `
For FOCUSED mode, prefer safer lens moves:
- Syntax: prefer 'adapt' or 'preserve'
- Voice: prefer 'preserve'
- Imagery: prefer 'preserve' or 'adapt'
- Avoid 'transform' unless absolutely necessary
- All variants should feel close to the source while still being distinct`,
        minLensDiffs: 2,
      };

    case "balanced":
      return {
        unusualnessBudgets: ["low", "medium", "medium"],
        lensGuidance: `
For BALANCED mode, ensure meaningful but safe diversity:
- At least one recipe should have imagery='substitute' OR voice='shift' OR cultural='hybrid'
- One recipe should stay relatively close to source
- One recipe should be more creative but still grounded
- Balance between safety and exploration`,
        minLensDiffs: 2,
      };

    case "adventurous":
      return {
        unusualnessBudgets: ["low", "medium", "high"],
        lensGuidance: `
For ADVENTUROUS mode, include at least one bold choice:
- At least one recipe MUST have imagery='transform' OR syntax='fragment' OR syntax='invert' OR cultural='hybrid' with strong localization
- Keep ONE recipe more grounded (as fallback)
- Still enforce meaning anchors and policy constraints
- Bold but defensible choices`,
        minLensDiffs: 3,
      };
  }
}

// =============================================================================
// Archetype-Specific Lens Constraints
// =============================================================================

/**
 * Allowed lens values for each archetype + mode combination
 */
export interface ArchetypeLensConstraints {
  allowedImagery: Array<"preserve" | "adapt" | "substitute" | "transform">;
  allowedVoice: Array<"preserve" | "shift" | "collective" | "intimate">;
  allowedSound: Array<"preserve" | "adapt" | "prioritize" | "ignore">;
  allowedSyntax: Array<"preserve" | "adapt" | "fragment" | "invert">;
  allowedCultural: Array<"preserve" | "adapt" | "hybrid" | "localize">;
}

/**
 * Get allowed lens values for a given archetype and mode.
 * These constraints ensure each archetype maintains its artistic identity
 * while scaling with mode aggressiveness.
 */
export function getArchetypeLensConstraints(
  archetype: Archetype,
  mode: TranslationRangeMode
): ArchetypeLensConstraints {
  switch (archetype) {
    case "essence_cut":
      // Distilled, clean, emotionally legible - simplify, don't complicate
      switch (mode) {
        case "focused":
          return {
            allowedImagery: ["preserve", "adapt"],
            allowedVoice: ["preserve", "shift"],
            allowedSound: ["preserve", "adapt"],
            allowedSyntax: ["adapt"], // Always adapt for cleaner structure
            allowedCultural: ["preserve", "adapt"],
          };
        case "balanced":
          return {
            allowedImagery: ["adapt"],
            allowedVoice: ["preserve", "shift"],
            allowedSound: ["adapt", "ignore"], // Can drop sound for clarity
            allowedSyntax: ["adapt"],
            allowedCultural: ["adapt", "hybrid"],
          };
        case "adventurous":
          return {
            allowedImagery: ["adapt", "substitute"], // More aggressive simplification
            allowedVoice: ["shift"],
            allowedSound: ["adapt", "ignore"],
            allowedSyntax: ["adapt", "fragment"], // Fragment for sharper cuts
            allowedCultural: ["adapt", "hybrid"],
          };
      }
      break;

    case "prismatic_reimagining":
      // Fresh metaphor system - imagery is key, must change image anchors
      switch (mode) {
        case "focused":
          return {
            allowedImagery: ["adapt", "substitute"], // Must change imagery
            allowedVoice: ["preserve"],
            allowedSound: ["adapt"],
            allowedSyntax: ["preserve", "adapt"],
            allowedCultural: ["adapt"],
          };
        case "balanced":
          return {
            allowedImagery: ["substitute", "transform"],
            allowedVoice: ["preserve", "shift"],
            allowedSound: ["adapt", "prioritize"],
            allowedSyntax: ["adapt", "invert"],
            allowedCultural: ["adapt", "hybrid"],
          };
        case "adventurous":
          return {
            allowedImagery: ["substitute", "transform"],
            allowedVoice: ["shift", "intimate"],
            allowedSound: ["adapt", "prioritize", "ignore"],
            allowedSyntax: ["adapt", "invert", "fragment"],
            allowedCultural: ["hybrid", "localize"],
          };
      }
      break;

    case "world_voice_transposition":
      // Shift narrator stance / world-frame - voice is key
      switch (mode) {
        case "focused":
          return {
            allowedImagery: ["preserve", "adapt"],
            allowedVoice: ["shift", "collective", "intimate"], // Must shift voice
            allowedSound: ["preserve", "adapt"],
            allowedSyntax: ["preserve", "adapt"],
            allowedCultural: ["adapt"],
          };
        case "balanced":
          return {
            allowedImagery: ["adapt"],
            allowedVoice: ["shift", "collective", "intimate"],
            allowedSound: ["adapt"],
            allowedSyntax: ["adapt"],
            allowedCultural: ["adapt", "hybrid"],
          };
        case "adventurous":
          return {
            allowedImagery: ["adapt", "substitute"],
            allowedVoice: ["collective", "intimate"], // Stronger stance shifts
            allowedSound: ["adapt", "prioritize"],
            allowedSyntax: ["adapt", "invert", "fragment"],
            allowedCultural: ["hybrid", "localize"],
          };
      }
      break;
  }
}

// =============================================================================
// Recipe Generation Prompt Builder
// =============================================================================

/**
 * Builds the system prompt for recipe generation (v2 - archetype-aware)
 */
export function buildRecipeGenerationSystemPrompt(): string {
  return `You are a translation strategy designer creating three ARTISTICALLY DISTINCT translation recipes.

Each recipe has a FIXED ARCHETYPE that defines its artistic identity:

═══════════════════════════════════════════════════════════════
ARCHETYPE A: ESSENCE CUT
═══════════════════════════════════════════════════════════════
Distill core meaning + emotional contour.
• Make it clean, legible, compressed.
• NOT literal word-by-word; NOT padded with explanation.
• Preserve key imagery IF it helps clarity, but simplify structure.
• Think: "What would a master say in fewer, sharper words?"

═══════════════════════════════════════════════════════════════
ARCHETYPE B: PRISMATIC REIMAGINING
═══════════════════════════════════════════════════════════════
Reimagine with fresh metaphor system.
• MUST introduce at least 1 new central image/metaphor anchor (noun-level change).
• Avoid reusing the source's main metaphor nouns directly.
• Keep emotional truth, but "new image system."
• Think: "What if a poet saw this moment through different eyes?"

═══════════════════════════════════════════════════════════════
ARCHETYPE C: WORLD & VOICE TRANSPOSITION
═══════════════════════════════════════════════════════════════
Shift narrator stance and/or world-frame.
• MUST change stance (I→we, you→we, impersonal→direct address, etc.)
  OR clearly shift time/place/register references.
• Keep semantic anchors, but in a different voice/world.
• Think: "Who else could be speaking this, from when/where?"

CRITICAL RULES:
- Each recipe MUST align with its archetype identity
- Recipes must be OBSERVABLY DIFFERENT (not paraphrases)
- Honor translator preferences while respecting archetype
- Return ONLY valid JSON

LENS OPTIONS:
- imagery: 'preserve' | 'adapt' | 'substitute' | 'transform'
- voice: 'preserve' | 'shift' | 'collective' | 'intimate'
- sound: 'preserve' | 'adapt' | 'prioritize' | 'ignore'
- syntax: 'preserve' | 'adapt' | 'fragment' | 'invert'
- cultural: 'preserve' | 'adapt' | 'hybrid' | 'localize'`;
}

/**
 * Builds the user prompt for recipe generation (v2 - archetype-aware)
 */
/**
 * Builds the user prompt for recipe generation (v2 - archetype-aware)
 *
 * HARDENING (Method 2): Simplified to core personality fields only.
 * Legacy fields (stance, vibes, mustKeep, noGo) are removed from prompts.
 */
export function buildRecipeGenerationUserPrompt(
  guideAnswers: GuideAnswers,
  poemContext: {
    fullPoem: string;
    sourceLanguage: string;
    targetLanguage: string;
  },
  mode: TranslationRangeMode
): string {
  const constraints = getModeConstraints(mode);

  const poemPreview =
    poemContext.fullPoem.slice(0, 500) +
    (poemContext.fullPoem.length > 500 ? "..." : "");

  // REMOVED: mustKeep, noGo, vibes (legacy fields, not used in Method 2)

  // Get archetype-specific lens constraints
  const constraintsA = getArchetypeLensConstraints("essence_cut", mode);
  const constraintsB = getArchetypeLensConstraints(
    "prismatic_reimagining",
    mode
  );
  const constraintsC = getArchetypeLensConstraints(
    "world_voice_transposition",
    mode
  );

  // Mode-specific intensity guidance
  const modeIntensity =
    mode === "focused"
      ? "Conservative moves, but NOT word-for-word literal. Subtle, controlled artistic choices."
      : mode === "balanced"
      ? "Clear artistic differentiation. Each variant should feel like a different translator's approach."
      : "Bold reframes. Push each archetype to its expressive limits while preserving meaning.";

  return `
TRANSLATION CONTEXT:
- Source language: ${poemContext.sourceLanguage}
- Target language: ${poemContext.targetLanguage}
- Translation intent: ${guideAnswers.translationIntent ?? "Not specified"}
- Translation zone: ${guideAnswers.translationZone ?? "Not specified"}

POEM PREVIEW:
"""
${poemPreview}
"""

═══════════════════════════════════════════════════════════════
MODE: ${mode.toUpperCase()}
═══════════════════════════════════════════════════════════════
${modeIntensity}

${constraints.lensGuidance}

═══════════════════════════════════════════════════════════════
ARCHETYPE-SPECIFIC LENS CONSTRAINTS
═══════════════════════════════════════════════════════════════

RECIPE A (archetype: essence_cut) - ${
    constraints.unusualnessBudgets[0]
  } unusualness:
  imagery: ${constraintsA.allowedImagery.join(" | ")}
  voice: ${constraintsA.allowedVoice.join(" | ")}
  syntax: ${constraintsA.allowedSyntax.join(" | ")}
  cultural: ${constraintsA.allowedCultural.join(" | ")}
  sound: ${constraintsA.allowedSound.join(" | ")}
  MUST: Compress and clarify; remove filler; preserve emotional core

RECIPE B (archetype: prismatic_reimagining) - ${
    constraints.unusualnessBudgets[1]
  } unusualness:
  imagery: ${constraintsB.allowedImagery.join(" | ")}
  voice: ${constraintsB.allowedVoice.join(" | ")}
  syntax: ${constraintsB.allowedSyntax.join(" | ")}
  cultural: ${constraintsB.allowedCultural.join(" | ")}
  sound: ${constraintsB.allowedSound.join(" | ")}
  MUST: Change at least one central metaphor noun; create fresh image system

RECIPE C (archetype: world_voice_transposition) - ${
    constraints.unusualnessBudgets[2]
  } unusualness:
  imagery: ${constraintsC.allowedImagery.join(" | ")}
  voice: ${constraintsC.allowedVoice.join(" | ")}
  syntax: ${constraintsC.allowedSyntax.join(" | ")}
  cultural: ${constraintsC.allowedCultural.join(" | ")}
  sound: ${constraintsC.allowedSound.join(" | ")}
  MUST: Shift narrator stance (I↔we, you↔we, impersonal↔direct) OR shift time/place/register

Phase 1 Requirement for Recipe C ONLY:
Include a "stance_plan" object with:
  - subject_form: "we" | "you" | "third_person" | "impersonal" (DO NOT use "i" for ${mode} mode)
  - world_frame (optional): short phrase like "late-night city", "rural coastline"
  - register_shift (optional): "more_colloquial" | "more_formal" | "more_regional" | "more_spoken" | "more_lyrical"
  - notes (optional): short, practical guidance
This stance plan will be used consistently across ALL lines in the poem for variant C.

Generate exactly 3 recipes with labels A, B, C.

OUTPUT FORMAT (JSON only):
{
  "recipes": [
    {
      "label": "A",
      "archetype": "essence_cut",
      "lens": {
        "imagery": "${constraintsA.allowedImagery[0]}",
        "voice": "${constraintsA.allowedVoice[0]}",
        "sound": "${constraintsA.allowedSound[0]}",
        "syntax": "${constraintsA.allowedSyntax[0]}",
        "cultural": "${constraintsA.allowedCultural[0]}"
      },
      "directive": "Distill to emotional core; compress without losing meaning",
      "unusualnessBudget": "${constraints.unusualnessBudgets[0]}",
      "mode": "${mode}"
    },
    {
      "label": "B",
      "archetype": "prismatic_reimagining",
      "lens": { ... pick from allowed values ... },
      "directive": "...",
      "unusualnessBudget": "${constraints.unusualnessBudgets[1]}",
      "mode": "${mode}"
    },
    {
      "label": "C",
      "archetype": "world_voice_transposition",
      "lens": { ... pick from allowed values ... },
      "directive": "...",
      "unusualnessBudget": "${constraints.unusualnessBudgets[2]}",
      "mode": "${mode}",
      "stance_plan": {
        "subject_form": "we",
        "world_frame": "urban night",
        "register_shift": "more_colloquial",
        "notes": "Use collective voice with contemporary urban imagery"
      }
    }
  ]
}`;
}

// =============================================================================
// Recipe Validation
// =============================================================================

/**
 * Validates that recipes meet mode + archetype constraints
 */
export function validateRecipes(
  recipes: VariantRecipe[],
  mode: TranslationRangeMode
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (recipes.length !== 3) {
    issues.push(`Expected 3 recipes, got ${recipes.length}`);
    return { valid: false, issues };
  }

  // Check labels
  const labels = recipes.map((r) => r.label);
  if (!labels.includes("A") || !labels.includes("B") || !labels.includes("C")) {
    issues.push("Recipes must have labels A, B, and C");
  }

  // Check archetype assignments (must match label mapping).
  // v6 simplified recipes have no archetype/lens — skip validation for those.
  for (const recipe of recipes) {
    if (!recipe.archetype || !recipe.lens) {
      // v6 simplified recipe — skip archetype/lens validation
      continue;
    }
    const expectedArchetype = LABEL_TO_ARCHETYPE[recipe.label];
    if (recipe.archetype !== expectedArchetype) {
      issues.push(
        `Recipe ${recipe.label} has archetype '${recipe.archetype}' but should have '${expectedArchetype}'`
      );
    }

    // Validate lens values are within allowed set for archetype+mode
    const archetypeConstraints = getArchetypeLensConstraints(
      expectedArchetype,
      mode
    );
    if (
      !archetypeConstraints.allowedImagery.includes(
        recipe.lens
          .imagery as (typeof archetypeConstraints.allowedImagery)[number]
      )
    ) {
      issues.push(
        `Recipe ${recipe.label} imagery='${
          recipe.lens.imagery
        }' not in allowed: ${archetypeConstraints.allowedImagery.join(", ")}`
      );
    }
    if (
      !archetypeConstraints.allowedVoice.includes(
        recipe.lens.voice as (typeof archetypeConstraints.allowedVoice)[number]
      )
    ) {
      issues.push(
        `Recipe ${recipe.label} voice='${
          recipe.lens.voice
        }' not in allowed: ${archetypeConstraints.allowedVoice.join(", ")}`
      );
    }
    if (
      !archetypeConstraints.allowedSyntax.includes(
        recipe.lens
          .syntax as (typeof archetypeConstraints.allowedSyntax)[number]
      )
    ) {
      issues.push(
        `Recipe ${recipe.label} syntax='${
          recipe.lens.syntax
        }' not in allowed: ${archetypeConstraints.allowedSyntax.join(", ")}`
      );
    }
    if (
      !archetypeConstraints.allowedCultural.includes(
        recipe.lens
          .cultural as (typeof archetypeConstraints.allowedCultural)[number]
      )
    ) {
      issues.push(
        `Recipe ${recipe.label} cultural='${
          recipe.lens.cultural
        }' not in allowed: ${archetypeConstraints.allowedCultural.join(", ")}`
      );
    }
    // Sound is more flexible, skip strict validation
  }

  // Check lens diversity (at least N lens values differ between each pair).
  // v6 simplified recipes have no lens — skip when absent.
  const constraints = getModeConstraints(mode);
  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) {
      const lensI = recipes[i].lens;
      const lensJ = recipes[j].lens;
      if (!lensI || !lensJ) continue; // v6: no lens to compare
      const diffs = countLensDiffs(lensI, lensJ);
      if (diffs < constraints.minLensDiffs) {
        issues.push(
          `Recipes ${recipes[i].label} and ${recipes[j].label} have only ${diffs} lens differences (need ${constraints.minLensDiffs})`
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Count how many lens values differ between two lenses
 */
function countLensDiffs(a: Lens, b: Lens): number {
  let diffs = 0;
  if (a.imagery !== b.imagery) diffs++;
  if (a.voice !== b.voice) diffs++;
  if (a.sound !== b.sound) diffs++;
  if (a.syntax !== b.syntax) diffs++;
  if (a.cultural !== b.cultural) diffs++;
  return diffs;
}

// =============================================================================
// Main Recipe Generator with Caching and Concurrency Safety
// =============================================================================

import { lockHelper, sleep, cacheGet, cacheSet } from "./cache";
import { patchThreadStateField } from "@/server/guide/updateGuideState";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai } from "./openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { trackCallStart, trackCallEnd } from "./openaiInstrumentation";
import { createRetryTelemetryCollector, noOpRetryTelemetry } from "@/lib/telemetry/retryTelemetry";
import type { TickInstrumentation } from "@/lib/workshop/runTranslationTick";

/** Constants for lock retry */
// Reduced to fail faster on true contention - prioritize interactive responsiveness
const MAX_LOCK_ATTEMPTS = 6; // Was 8, now max ~15s wait (reduced from 31.5s)
const BASE_BACKOFF_MS = 200; // Was 300, faster initial retry
const LOCK_TTL_SECONDS = 90; // Was 120, reduced to detect stale locks faster
const MAX_BACKOFF_MS = 3000; // Was 4000, cap backoff even lower for faster fail

/**
 * Per-mode recipe storage structure.
 * HARDENING: Each mode gets its own slot to avoid cache thrashing when users switch modes.
 */
export interface PerModeRecipeCache {
  focused?: VariantRecipesBundle;
  balanced?: VariantRecipesBundle;
  adventurous?: VariantRecipesBundle;
}

/** Thread state shape (partial) */
interface ThreadState {
  // NEW: Per-mode recipe storage (v3 schema)
  variant_recipes_v3?: PerModeRecipeCache;
  // LEGACY: Single-bundle storage (v2 schema) - migrated on read
  variant_recipes_v2?: VariantRecipesBundle;
  variant_recipes_v1?: VariantRecipesBundle; // Legacy v1, for backward-compat reads
  guide_answers?: GuideAnswers;
  raw_poem?: string;
  [key: string]: unknown;
}

/**
 * Fetch thread state from database
 */
async function fetchThreadState(threadId: string): Promise<ThreadState> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("state")
    .eq("id", threadId)
    .single();

  if (error) {
    console.error("[fetchThreadState] Error:", error);
    return {};
  }

  return (data?.state as ThreadState) ?? {};
}

/**
 * Generate recipes using LLM
 */
async function generateRecipesLLM(
  guideAnswers: GuideAnswers,
  poemContext: {
    fullPoem: string;
    sourceLanguage: string;
    targetLanguage: string;
  },
  mode: TranslationRangeMode,
  contextHash: string,
  threadId: string,
  instrumentation?: TickInstrumentation
): Promise<VariantRecipesBundle> {
  const systemPrompt = buildRecipeGenerationSystemPrompt();
  const userPrompt = buildRecipeGenerationUserPrompt(
    guideAnswers,
    poemContext,
    mode
  );

  // Respect user-selected translation model when generating recipes.
  // (Falls back to env TRANSLATOR_MODEL if not provided.)
  const modelToUse = guideAnswers.translationModel ?? TRANSLATOR_MODEL;
  const isGpt5 = modelToUse.startsWith("gpt-5");
  const temperature =
    mode === "focused" ? 0.6 : mode === "adventurous" ? 0.95 : 0.8;

  const requestId = trackCallStart("recipe", { threadId });
  const recipeStart = Date.now();

  try {
    // ISS-017: Track OpenAI call for recipe generation
    if (instrumentation) {
      instrumentation.openaiCalls.recipe++;
    }
    
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
    
    // ISS-017: Track duration and tokens
    const recipeDuration = Date.now() - recipeStart;
    if (instrumentation) {
      instrumentation.openaiDurations.recipe.push(recipeDuration);
      const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
      if (usage) {
        instrumentation.openaiTokens.recipe.push({
          prompt: usage.prompt_tokens ?? 0,
          completion: usage.completion_tokens ?? 0,
        });
      }
    }

    trackCallEnd(requestId, {
      status: "ok",
      latencyMs: Date.now() - recipeStart,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model: modelToUse,
      temperature: isGpt5 ? undefined : temperature,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(content);

    // Validate and extract recipes
    if (
      !parsed.recipes ||
      !Array.isArray(parsed.recipes) ||
      parsed.recipes.length !== 3
    ) {
      throw new Error("Invalid recipe response: expected 3 recipes");
    }

    // Validate each recipe with Zod, enforcing archetype assignment
    const recipes = parsed.recipes.map((r: unknown, i: number) => {
      // Ensure archetype is set correctly based on label
      const rawRecipe = r as Record<string, unknown>;
      const label = rawRecipe.label as "A" | "B" | "C";
      const expectedArchetype =
        LABEL_TO_ARCHETYPE[label] ??
        LABEL_TO_ARCHETYPE[["A", "B", "C"][i] as "A" | "B" | "C"];

      // Inject correct archetype if missing or wrong
      const recipeWithArchetype = {
        ...rawRecipe,
        archetype: expectedArchetype,
      };

      const result = VariantRecipeSchema.safeParse(recipeWithArchetype);
      if (!result.success) {
        console.warn(
          `[generateRecipesLLM] Recipe ${i} validation failed:`,
          result.error
        );
        // Return a safe fallback
        const fallback = createFallbackRecipe(
          ["A", "B", "C"][i] as "A" | "B" | "C",
          mode
        );
        // Phase 1: Add stance plan to C fallback
        if (label === "C") {
          fallback.stance_plan = generateDeterministicStancePlan(
            threadId,
            mode
          );
        }
        return fallback;
      }

      // Phase 1: Defensive enforcement for variant C stance plan
      let validatedRecipe = result.data;
      if (
        validatedRecipe.label === "C" &&
        validatedRecipe.archetype === "world_voice_transposition"
      ) {
        // Validate stance plan exists and is valid
        const stancePlan = validatedRecipe.stance_plan;
        const isValidStancePlan =
          stancePlan &&
          stancePlan.subject_form &&
          ["we", "you", "third_person", "impersonal", "i"].includes(
            stancePlan.subject_form
          );

        if (!isValidStancePlan) {
          // Inject deterministic fallback
          console.warn(
            `[generateRecipesLLM] Recipe C stance_plan missing/invalid, injecting deterministic fallback`
          );
          validatedRecipe = {
            ...validatedRecipe,
            stance_plan: generateDeterministicStancePlan(threadId, mode),
          };
        } else {
          // Check if mode forbids "i" and LLM returned "i"
          if (
            (mode === "balanced" || mode === "adventurous") &&
            stancePlan.subject_form === "i"
          ) {
            console.warn(
              `[generateRecipesLLM] Recipe C stance_plan has forbidden "i" for ${mode} mode, overriding with deterministic fallback`
            );
            validatedRecipe = {
              ...validatedRecipe,
              stance_plan: generateDeterministicStancePlan(threadId, mode),
            };
          }
        }
      }

      return validatedRecipe;
    }) as [VariantRecipe, VariantRecipe, VariantRecipe];

    // Validate recipe diversity
    const validation = validateRecipes(recipes, mode);
    if (!validation.valid) {
      console.warn(
        "[generateRecipesLLM] Recipe validation issues:",
        validation.issues
      );
      // Continue anyway - issues are warnings, not failures
    }

    const bundle: VariantRecipesBundle = {
      threadId,
      mode,
      contextHash,
      recipes,
      createdAt: Date.now(),
      modelUsed: modelToUse,
      debug:
        process.env.NODE_ENV === "development" ? { validation } : undefined,
    };

    if (process.env.DEBUG_VARIANTS === "1") {
      console.log("[DEBUG_VARIANTS][recipes.generate.v2]", {
        threadId,
        mode,
        contextHash,
        schemaVersion: RECIPE_SCHEMA_VERSION,
        model: modelToUse,
        isGpt5,
        temperature: isGpt5 ? null : temperature,
        recipes: bundle.recipes.map((r) => ({
          label: r.label,
          archetype: r.archetype,
          directive: r.directive,
          lens: r.lens,
          unusualnessBudget: r.unusualnessBudget,
        })),
      });
    }

    return bundle;
  } catch (error: unknown) {
    const errorObj = error as {
      name?: string;
      status?: number;
      message?: string;
    };
    trackCallEnd(requestId, {
      status: "error",
      latencyMs: Date.now() - recipeStart,
      errorName: errorObj.name,
      httpStatus: errorObj.status,
      errorMessageShort: errorObj.message?.slice(0, 100),
      model: modelToUse,
      temperature: isGpt5 ? undefined : temperature,
    });
    console.error("[generateRecipesLLM] Error:", error);
    // Return fallback recipes
    return createFallbackBundle(threadId, mode, contextHash);
  }
}

/**
 * Create a fallback recipe when LLM fails
 */
function createFallbackRecipe(
  label: "A" | "B" | "C",
  mode: TranslationRangeMode
): VariantRecipe {
  const constraints = getModeConstraints(mode);
  const archetype = LABEL_TO_ARCHETYPE[label];
  const archetypeConstraints = getArchetypeLensConstraints(archetype, mode);

  // Use first allowed value from each constraint set
  const lens = {
    imagery: archetypeConstraints.allowedImagery[0],
    voice: archetypeConstraints.allowedVoice[0],
    sound: archetypeConstraints.allowedSound[0],
    syntax: archetypeConstraints.allowedSyntax[0],
    cultural: archetypeConstraints.allowedCultural[0],
  };

  const directive =
    archetype === "essence_cut"
      ? "Distill to emotional core; compress without losing meaning"
      : archetype === "prismatic_reimagining"
      ? "Reimagine with fresh metaphor; change at least one central image"
      : "Shift narrator stance or world-frame; different voice, same meaning";

  const idx = label === "A" ? 0 : label === "B" ? 1 : 2;

  return {
    label,
    archetype,
    lens,
    directive,
    unusualnessBudget: constraints.unusualnessBudgets[idx],
    mode,
  };
}

/**
 * Create a fallback bundle when LLM fails
 */
function createFallbackBundle(
  threadId: string,
  mode: TranslationRangeMode,
  contextHash: string
): VariantRecipesBundle {
  const recipeA = createFallbackRecipe("A", mode);
  const recipeB = createFallbackRecipe("B", mode);
  const recipeC = createFallbackRecipe("C", mode);

  // Phase 1: Add stance plan to variant C
  recipeC.stance_plan = generateDeterministicStancePlan(threadId, mode);

  return {
    threadId,
    mode,
    contextHash,
    recipes: [recipeA, recipeB, recipeC],
    createdAt: Date.now(),
    modelUsed: "fallback",
  };
}

/**
 * Phase 1: Generate deterministic stance plan for Variant C.
 * Uses stable hash of threadId + mode to select subject_form.
 * This ensures consistency across regenerations and prevents per-line voice flipping.
 *
 * @param threadId - Thread ID for deterministic selection
 * @param mode - Translation range mode
 * @returns A deterministic stance plan for variant C
 */
export function generateDeterministicStancePlan(
  threadId: string,
  mode: TranslationRangeMode
): StancePlan {
  // Allowed subject forms (NO "i" in balanced/adventurous by default)
  const allowedForms: Array<StancePlan["subject_form"]> =
    mode === "focused"
      ? ["we", "you", "third_person", "impersonal"] // Focused: same as others, default away from "i"
      : ["we", "you", "third_person", "impersonal"]; // Balanced/Adventurous: NO "i"

  // Deterministic selection using stable hash
  const seedString = `${threadId}:${mode}:stance_v1`;
  const hash = stableHash(seedString);
  // Convert first 8 hex chars to number
  const hashNum = parseInt(hash.slice(0, 8), 16);
  const selectedForm = allowedForms[hashNum % allowedForms.length];

  return {
    subject_form: selectedForm,
    // Leave world_frame and register_shift undefined for deterministic fallback
  };
}

/**
 * Get or create variant recipes for a thread.
 *
 * This is the main entry point for recipe generation. It:
 * 1. Checks cache (both mode AND contextHash must match)
 * 2. Uses atomic lock to prevent duplicate generation
 * 3. Uses JSONB patch for safe state updates
 *
 * @param threadId - The thread to get/create recipes for
 * @param guideAnswers - User's translation preferences
 * @param poemContext - Full poem and language info
 * @param mode - Translation range mode (focused/balanced/adventurous)
 */
export async function getOrCreateVariantRecipes(
  threadId: string,
  guideAnswers: GuideAnswers,
  poemContext: {
    fullPoem: string;
    sourceLanguage: string;
    targetLanguage: string;
  },
  mode: TranslationRangeMode,
  instrumentation?: TickInstrumentation
): Promise<VariantRecipesBundle> {
  // ─── SIMPLIFIED PROMPTS (default since v6, client direction from Matthew) ───
  // Static recipes: no LLM call, no cache, no lock. Instant return.
  // The old archetype-based LLM recipe generation (below) is preserved for
  // rollback via USE_SIMPLIFIED_PROMPTS=0.
  if (process.env.USE_SIMPLIFIED_PROMPTS === "1") {
    const poemHash = stableHash(poemContext.fullPoem);
    const contextHash = computeRecipeContextHash(
      guideAnswers,
      poemContext.sourceLanguage,
      poemContext.targetLanguage,
      poemHash
    );
    const { buildStaticRecipeBundle } = await import('./simplifiedRecipes');
    const staticBundle = buildStaticRecipeBundle({ threadId, mode, contextHash });

    if (process.env.DEBUG_RECIPES === "1") {
      console.log(
        `[getOrCreateVariantRecipes] ⚡ SIMPLIFIED MODE: Returning static recipes for ${mode} (thread=${threadId.slice(0, 8)})`
      );
    }

    return staticBundle;
  }
  // ─── End simplified prompts bypass ───

  // Compute context hash for cache invalidation
  const poemHash = stableHash(poemContext.fullPoem);
  const contextHash = computeRecipeContextHash(
    guideAnswers,
    poemContext.sourceLanguage,
    poemContext.targetLanguage,
    poemHash
  );

  // Check memory cache first (fast path)
  const memoryCacheKey = `recipes:${threadId}:${mode}:${contextHash}`;
  const memoryCached = await cacheGet<VariantRecipesBundle>(memoryCacheKey);
  if (memoryCached) {
    if (process.env.DEBUG_VARIANTS === "1") {
      console.log("[DEBUG_VARIANTS][recipes.cache.hit.memory]", {
        threadId,
        mode,
        contextHash,
        memoryCacheKey,
        bundle: {
          threadId: memoryCached.threadId,
          mode: memoryCached.mode,
          contextHash: memoryCached.contextHash,
          createdAt: memoryCached.createdAt,
          modelUsed: memoryCached.modelUsed,
          recipes: memoryCached.recipes.map((r) => ({
            label: r.label,
            directive: r.directive,
            lens: r.lens,
            unusualnessBudget: r.unusualnessBudget,
          })),
        },
      });
    }
    return memoryCached;
  }

  // Check DB cache - prefer v3 (per-mode), fall back to v2 (single bundle)
  const threadState = await fetchThreadState(threadId);

  // TRY V3 (per-mode storage) FIRST
  const v3Cache = threadState.variant_recipes_v3;
  const v3Bundle = v3Cache?.[mode];
  if (v3Bundle && v3Bundle.contextHash === contextHash) {
    const validated = VariantRecipesBundleSchema.safeParse(v3Bundle);
    if (validated.success) {
      // Populate memory cache
      await cacheSet(memoryCacheKey, validated.data, 3600);
      if (process.env.DEBUG_VARIANTS === "1") {
        console.log("[DEBUG_VARIANTS][recipes.cache.hit.db.v3]", {
          threadId,
          mode,
          contextHash,
          memoryCacheKey,
          bundle: {
            threadId: validated.data.threadId,
            mode: validated.data.mode,
            contextHash: validated.data.contextHash,
            createdAt: validated.data.createdAt,
            modelUsed: validated.data.modelUsed,
            recipes: validated.data.recipes.map((r) => ({
              label: r.label,
              archetype: r.archetype,
              directive: r.directive,
              lens: r.lens,
              unusualnessBudget: r.unusualnessBudget,
            })),
          },
        });
      }
      return validated.data;
    }
    console.warn(
      "[getOrCreateVariantRecipes] Cached v3 recipes failed validation"
    );
  }

  // BACKWARD COMPATIBILITY: Try v2 (single bundle) if v3 doesn't have our mode
  const v2Bundle = threadState.variant_recipes_v2;
  if (
    v2Bundle &&
    v2Bundle.mode === mode &&
    v2Bundle.contextHash === contextHash
  ) {
    const validated = VariantRecipesBundleSchema.safeParse(v2Bundle);
    if (validated.success) {
      // Migrate to v3 format by writing to the mode slot
      const migratedV3: PerModeRecipeCache = {
        ...(v3Cache ?? {}),
        [mode]: validated.data,
      };
      await patchThreadStateField(threadId, ["variant_recipes_v3"], migratedV3);

      // Populate memory cache
      await cacheSet(memoryCacheKey, validated.data, 3600);
      if (process.env.DEBUG_VARIANTS === "1") {
        console.log("[DEBUG_VARIANTS][recipes.cache.hit.db.v2.migrated]", {
          threadId,
          mode,
          contextHash,
        });
      }
      return validated.data;
    }
    console.warn(
      "[getOrCreateVariantRecipes] Cached v2 recipes failed validation"
    );
  }
  // Note: v1 recipes are intentionally NOT used as cache hit due to schema change

  // Need to generate new recipes - use lock to prevent concurrent generation
  const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;
  
  // ISS-016: Instrument lock retry telemetry
  const retryTelemetry = instrumentation?.retries
    ? createRetryTelemetryCollector({ retries: instrumentation.retries })
    : noOpRetryTelemetry;

  for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
    // Try atomic lock acquisition - returns UUID token if acquired, null if failed
    const attemptStart = Date.now();
    console.log(
      `[LOCK] Attempt ${attempt + 1}/${MAX_LOCK_ATTEMPTS} for ${lockKey.slice(
        -20
      )}`
    );
    
    const lockToken = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

    // TEMP DEBUG: Verify lock token is acquired
    if (process.env.DEBUG_LOCK === "1") {
      console.log("[DEBUG_LOCK][acquire]", {
        lockKey,
        lockToken: lockToken ? `${lockToken.slice(0, 8)}...` : null,
        attempt,
      });
    }

    if (lockToken) {
      const lockAcquiredMs = Date.now() - attemptStart;
      console.log(`[LOCK] ACQUIRED on attempt ${attempt + 1} (${lockAcquiredMs}ms)`);
      try {
        // Double-check DB in case another process just finished
        // Check v3 first, then fall back to v2
        const freshState = await fetchThreadState(threadId);
        const freshV3Bundle = freshState.variant_recipes_v3?.[mode];
        if (freshV3Bundle && freshV3Bundle.contextHash === contextHash) {
          const validated = VariantRecipesBundleSchema.safeParse(freshV3Bundle);
          if (validated.success) {
            await cacheSet(memoryCacheKey, validated.data, 3600);
            return validated.data;
          }
        }
        // Fallback: check v2 single bundle
        const freshV2Bundle = freshState.variant_recipes_v2;
        if (
          freshV2Bundle &&
          freshV2Bundle.mode === mode &&
          freshV2Bundle.contextHash === contextHash
        ) {
          const validated = VariantRecipesBundleSchema.safeParse(freshV2Bundle);
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
          threadId,
          instrumentation
        );

        if (process.env.DEBUG_VARIANTS === "1") {
          console.log("[DEBUG_VARIANTS][recipes.cache.miss.generated.v3]", {
            threadId,
            mode,
            contextHash,
            memoryCacheKey,
            bundle: {
              threadId: newBundle.threadId,
              mode: newBundle.mode,
              contextHash: newBundle.contextHash,
              createdAt: newBundle.createdAt,
              modelUsed: newBundle.modelUsed,
              recipes: newBundle.recipes.map((r) => ({
                label: r.label,
                archetype: r.archetype,
                directive: r.directive,
                lens: r.lens,
                unusualnessBudget: r.unusualnessBudget,
              })),
            },
          });
        }

        // JSONB patch-safe DB update - write to v3 per-mode storage
        // Fetch current v3 cache to merge with new bundle
        const currentV3 =
          (await fetchThreadState(threadId)).variant_recipes_v3 ?? {};
        const updatedV3: PerModeRecipeCache = {
          ...currentV3,
          [mode]: newBundle,
        };
        const patchResult = await patchThreadStateField(
          threadId,
          ["variant_recipes_v3"],
          updatedV3
        );

        if (!patchResult.success) {
          console.error(
            "[getOrCreateVariantRecipes] Failed to persist recipes:",
            patchResult.error
          );
          // Still return the bundle - it's valid, just not persisted
        } else if (process.env.DEBUG_VARIANTS === "1") {
          console.log("[DEBUG_VARIANTS][recipes.persisted]", {
            threadId,
            mode,
            contextHash,
          });
        }

        // Populate memory cache
        await cacheSet(memoryCacheKey, newBundle, 3600);

        return newBundle;
      } finally {
        // CRITICAL: Use token-based compare-and-delete to prevent releasing others' locks
        if (process.env.DEBUG_LOCK === "1") {
          console.log("[DEBUG_LOCK][release]", {
            lockKey,
            lockToken: lockToken ? `${lockToken.slice(0, 8)}...` : null,
          });
        }
        await lockHelper.release(lockKey, lockToken);
      }
    }

    // Lock not acquired: another request is generating
    // Wait with exponential backoff + jitter, then re-check DB
    const backoff = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, attempt),
      MAX_BACKOFF_MS
    );
    
    // ISS-016: Record lock wait delay
    retryTelemetry.recordRetry({
      layer: "recipe_lock",
      operation: `lock_${lockKey.slice(-20)}`,
      attempt: attempt + 1,
      maxAttempts: MAX_LOCK_ATTEMPTS,
      reason: "Lock contention - waiting",
      delayMs: Math.min(
        BASE_BACKOFF_MS * Math.pow(2, attempt),
        MAX_BACKOFF_MS
      ),
    });
    
    await sleep(
      Math.min(
        BASE_BACKOFF_MS * Math.pow(2, attempt),
        MAX_BACKOFF_MS
      )
    );
    const jitter = Math.random() * 500;
    console.log(`[LOCK] WAITING ${Math.round(backoff + jitter)}ms`);
    await sleep(backoff + jitter);

    // Check if another request finished while we waited
    // Check v3 first, then fall back to v2
    const maybeReady = await fetchThreadState(threadId);
    const maybeV3Bundle = maybeReady.variant_recipes_v3?.[mode];
    if (maybeV3Bundle && maybeV3Bundle.contextHash === contextHash) {
      const validated = VariantRecipesBundleSchema.safeParse(maybeV3Bundle);
      if (validated.success) {
        await cacheSet(memoryCacheKey, validated.data, 3600);
        return validated.data;
      }
    }
    // Fallback: check v2 single bundle
    const maybeV2Bundle = maybeReady.variant_recipes_v2;
    if (
      maybeV2Bundle &&
      maybeV2Bundle.mode === mode &&
      maybeV2Bundle.contextHash === contextHash
    ) {
      const validated = VariantRecipesBundleSchema.safeParse(maybeV2Bundle);
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
}
