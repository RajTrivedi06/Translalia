/**
 * Variant Recipes System
 *
 * Generates and caches reusable "viewpoint recipes" for prismatic translation variants.
 * Recipes are generated once per thread (or when context changes) and applied to each line.
 *
 * Key concepts:
 * - Lens: Configuration for translation perspective (imagery, voice, sound, syntax, cultural)
 * - Recipe: A reusable viewpoint definition (label, lens, directive, unusualnessBudget)
 * - Bundle: Collection of 3 recipes with metadata (mode, contextHash, createdAt)
 */

import { z } from "zod";
import { stableHash } from "./cache";
import type { GuideAnswers } from "@/store/guideSlice";

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Viewpoint range mode - controls how wide the variants range
 */
export const ViewpointRangeModeSchema = z.enum([
  "focused",
  "balanced",
  "adventurous",
]);
export type ViewpointRangeMode = z.infer<typeof ViewpointRangeModeSchema>;

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
 * A single variant recipe - defines one of the A/B/C viewpoints
 */
export const VariantRecipeSchema = z.object({
  /** Variant label (A, B, or C) */
  label: z.enum(["A", "B", "C"]),
  /** Lens configuration for this variant */
  lens: LensSchema,
  /** Short imperative directive (1-2 lines) - truncated to 200 chars if LLM returns longer */
  directive: z.string().transform((s) => s.slice(0, 200)),
  /** How unusual/creative this variant is allowed to be */
  unusualnessBudget: UnusualnessBudgetSchema,
  /** Which mode created this recipe */
  mode: ViewpointRangeModeSchema,
});
export type VariantRecipe = z.infer<typeof VariantRecipeSchema>;

/**
 * Bundle of 3 recipes with metadata
 * Stored in chat_threads.state.variant_recipes_v1
 */
export const VariantRecipesBundleSchema = z.object({
  /** Thread ID this bundle belongs to */
  threadId: z.string(),
  /** Viewpoint range mode used to generate these recipes */
  mode: ViewpointRangeModeSchema,
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

// =============================================================================
// Context Hash Computation
// =============================================================================

/**
 * Computes a stable hash of all inputs that affect recipe generation.
 * Recipes are invalidated when ANY of these change:
 * - translationIntent or translationZone
 * - stance.closeness
 * - style.vibes
 * - policy.must_keep or policy.no_go
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
export function getModeConstraints(mode: ViewpointRangeMode): ModeConstraints {
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
// Recipe Generation Prompt Builder
// =============================================================================

/**
 * Builds the system prompt for recipe generation
 */
export function buildRecipeGenerationSystemPrompt(): string {
  return `You are a translation strategy designer. Your task is to create three distinct "recipes" that define different translation viewpoints for poetry translation.

Each recipe must specify:
1. A lens configuration (how to handle imagery, voice, sound, syntax, cultural references)
2. A short directive (1-2 lines describing the approach)
3. An unusualness budget (how creative this variant can be)

CRITICAL RULES:
- All three recipes must be OBSERVABLY DIFFERENT from each other
- Each recipe must honor the translator's stated preferences and constraints
- Recipes must preserve meaning anchors even when being creative
- Return ONLY valid JSON per the schema

LENS OPTIONS:
- imagery: 'preserve' | 'adapt' | 'substitute' | 'transform'
- voice: 'preserve' | 'shift' | 'collective' | 'intimate'
- sound: 'preserve' | 'adapt' | 'prioritize' | 'ignore'
- syntax: 'preserve' | 'adapt' | 'fragment' | 'invert'
- cultural: 'preserve' | 'adapt' | 'hybrid' | 'localize'`;
}

/**
 * Builds the user prompt for recipe generation
 */
export function buildRecipeGenerationUserPrompt(
  guideAnswers: GuideAnswers,
  poemContext: {
    fullPoem: string;
    sourceLanguage: string;
    targetLanguage: string;
  },
  mode: ViewpointRangeMode
): string {
  const constraints = getModeConstraints(mode);

  const poemPreview =
    poemContext.fullPoem.slice(0, 500) +
    (poemContext.fullPoem.length > 500 ? "..." : "");

  const mustKeep = guideAnswers.policy?.must_keep ?? [];
  const noGo = guideAnswers.policy?.no_go ?? [];
  const vibes = guideAnswers.style?.vibes ?? [];

  return `
TRANSLATION CONTEXT:
- Source language: ${poemContext.sourceLanguage}
- Target language: ${poemContext.targetLanguage}
- Translation intent: ${guideAnswers.translationIntent ?? "Not specified"}
- Translation zone: ${guideAnswers.translationZone ?? "Not specified"}
- Stance: ${guideAnswers.stance?.closeness ?? "in_between"}
${vibes.length > 0 ? `- Style vibes: ${vibes.join(", ")}` : ""}
${mustKeep.length > 0 ? `- MUST preserve: ${mustKeep.join(", ")}` : ""}
${noGo.length > 0 ? `- MUST avoid: ${noGo.join(", ")}` : ""}

POEM PREVIEW:
"""
${poemPreview}
"""

MODE: ${mode.toUpperCase()}
${constraints.lensGuidance}

REQUIRED UNUSUALNESS BUDGETS:
- Recipe A: ${constraints.unusualnessBudgets[0]}
- Recipe B: ${constraints.unusualnessBudgets[1]}
- Recipe C: ${constraints.unusualnessBudgets[2]}

Generate exactly 3 recipes with labels A, B, C.

OUTPUT FORMAT (JSON only):
{
  "recipes": [
    {
      "label": "A",
      "lens": {
        "imagery": "preserve",
        "voice": "preserve",
        "sound": "adapt",
        "syntax": "preserve",
        "cultural": "adapt"
      },
      "directive": "Stay close to source structure while adapting sound patterns for the target language",
      "unusualnessBudget": "${constraints.unusualnessBudgets[0]}",
      "mode": "${mode}"
    },
    { "label": "B", ... },
    { "label": "C", ... }
  ]
}`;
}

// =============================================================================
// Recipe Validation
// =============================================================================

/**
 * Validates that recipes meet mode constraints
 */
export function validateRecipes(
  recipes: VariantRecipe[],
  mode: ViewpointRangeMode
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

  // Check lens diversity (at least 2 lens values differ between each pair)
  const constraints = getModeConstraints(mode);
  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) {
      const diffs = countLensDiffs(recipes[i].lens, recipes[j].lens);
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

/** Constants for lock retry */
// Increased to handle worst-case recipe generation (30-60s)
const MAX_LOCK_ATTEMPTS = 15;
const BASE_BACKOFF_MS = 500;
const LOCK_TTL_SECONDS = 90; // Must exceed worst-case generation time

/** Thread state shape (partial) */
interface ThreadState {
  variant_recipes_v1?: VariantRecipesBundle;
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
  mode: ViewpointRangeMode,
  contextHash: string,
  threadId: string
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

  try {
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

    // Validate each recipe with Zod
    const recipes = parsed.recipes.map((r: unknown, i: number) => {
      const result = VariantRecipeSchema.safeParse(r);
      if (!result.success) {
        console.warn(
          `[generateRecipesLLM] Recipe ${i} validation failed:`,
          result.error
        );
        // Return a safe fallback
        return createFallbackRecipe(
          ["A", "B", "C"][i] as "A" | "B" | "C",
          mode
        );
      }
      return result.data;
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
      console.log("[DEBUG_VARIANTS][recipes.generate]", {
        threadId,
        mode,
        contextHash,
        model: modelToUse,
        isGpt5,
        temperature: isGpt5 ? null : temperature,
        recipes: bundle.recipes.map((r) => ({
          label: r.label,
          directive: r.directive,
          lens: r.lens,
          unusualnessBudget: r.unusualnessBudget,
        })),
      });
    }

    return bundle;
  } catch (error) {
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
  mode: ViewpointRangeMode
): VariantRecipe {
  const constraints = getModeConstraints(mode);
  const idx = label === "A" ? 0 : label === "B" ? 1 : 2;

  return {
    label,
    lens: {
      imagery: idx === 0 ? "preserve" : idx === 1 ? "adapt" : "substitute",
      voice: "preserve",
      sound: "adapt",
      syntax: idx === 2 ? "adapt" : "preserve",
      cultural: idx === 1 ? "adapt" : "preserve",
    },
    directive:
      idx === 0
        ? "Stay close to the source structure and meaning"
        : idx === 1
        ? "Balance fidelity with natural target language flow"
        : "Prioritize natural expression in the target language",
    unusualnessBudget: constraints.unusualnessBudgets[idx],
    mode,
  };
}

/**
 * Create a fallback bundle when LLM fails
 */
function createFallbackBundle(
  threadId: string,
  mode: ViewpointRangeMode,
  contextHash: string
): VariantRecipesBundle {
  return {
    threadId,
    mode,
    contextHash,
    recipes: [
      createFallbackRecipe("A", mode),
      createFallbackRecipe("B", mode),
      createFallbackRecipe("C", mode),
    ],
    createdAt: Date.now(),
    modelUsed: "fallback",
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
 * @param mode - Viewpoint range mode (focused/balanced/adventurous)
 */
export async function getOrCreateVariantRecipes(
  threadId: string,
  guideAnswers: GuideAnswers,
  poemContext: {
    fullPoem: string;
    sourceLanguage: string;
    targetLanguage: string;
  },
  mode: ViewpointRangeMode
): Promise<VariantRecipesBundle> {
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
      if (process.env.DEBUG_VARIANTS === "1") {
        console.log("[DEBUG_VARIANTS][recipes.cache.hit.db]", {
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
      "[getOrCreateVariantRecipes] Cached recipes failed validation"
    );
  }

  // Need to generate new recipes - use lock to prevent concurrent generation
  const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;

  for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
    // Try atomic lock acquisition
    const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

    if (acquired) {
      try {
        // Double-check DB in case another process just finished
        const freshState = await fetchThreadState(threadId);
        const freshCached = freshState.variant_recipes_v1;
        if (
          freshCached &&
          freshCached.mode === mode &&
          freshCached.contextHash === contextHash
        ) {
          const validated = VariantRecipesBundleSchema.safeParse(freshCached);
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
          threadId
        );

        if (process.env.DEBUG_VARIANTS === "1") {
          console.log("[DEBUG_VARIANTS][recipes.cache.miss.generated]", {
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
                directive: r.directive,
                lens: r.lens,
                unusualnessBudget: r.unusualnessBudget,
              })),
            },
          });
        }

        // JSONB patch-safe DB update
        const patchResult = await patchThreadStateField(
          threadId,
          ["variant_recipes_v1"],
          newBundle
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
        // CRITICAL: Use explicit DEL, not set-to-null
        await lockHelper.release(lockKey);
      }
    }

    // Lock not acquired: another request is generating
    // Wait with exponential backoff + jitter, then re-check DB
    const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 8000);
    const jitter = Math.random() * 500;
    await sleep(backoff + jitter);

    // Check if another request finished while we waited
    const maybeReady = await fetchThreadState(threadId);
    const maybeCached = maybeReady.variant_recipes_v1;
    if (
      maybeCached &&
      maybeCached.mode === mode &&
      maybeCached.contextHash === contextHash
    ) {
      const validated = VariantRecipesBundleSchema.safeParse(maybeCached);
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
