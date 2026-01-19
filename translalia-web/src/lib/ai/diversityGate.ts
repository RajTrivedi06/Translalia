/**
 * Diversity Gate for Prismatic Variants
 *
 * Performs cheap post-generation checks to ensure translation variants are
 * observably different. If variants are too similar, triggers single-variant
 * regeneration (max 1 extra call).
 *
 * Phase 2 enhancements:
 * - Structural signature / template clone detection (language-aware)
 * - Length-aware overlap thresholds (short lines don't fail on Jaccard noise)
 * - Deterministic worst variant selection with priority order
 * - Integration with Phase 1 validation (respects Phase 1 decisions)
 *
 * Phase 3 enhancements:
 * - Mode-aware Jaccard thresholds (focused=lenient, adventurous=strict)
 * - Extended stopword support (EN/FR/ES/DE/PT/IT)
 * - Debug logging behind DEBUG_GATE flag
 */

import { z } from "zod";
import type { VariantRecipe } from "./variantRecipes";
import { openai } from "./openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { pickStopwords, getStopwordsLanguage } from "./stopwords";
import {
  structuralSignature,
  openerType,
  countNonPunctTokens,
  type OpenerType,
} from "./structureSignature";

// =============================================================================
// Types
// =============================================================================

/**
 * A translation variant as returned by the prismatic generation
 */
export interface TranslationVariant {
  label: "A" | "B" | "C";
  text: string;
  rationale?: string;
  confidence?: number;
}

/**
 * Result of distinctness check
 */
export interface DistinctnessResult {
  pass: boolean;
  worstIndex: number | null;
  reason?: string;
  details?: {
    jaccardScores: number[];
    maxOverlap: number;
    pairWithMaxOverlap: [number, number];
    // Phase 2 debug info
    openerTypes?: OpenerType[];
    signatures?: string[];
    contentTokenCounts?: number[];
    lengthAdjustedThreshold?: number;
  };
}

/**
 * Context for variant regeneration
 */
export interface LineContext {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  prevLine?: string;
  nextLine?: string;
}

// =============================================================================
// Distinctness Checks
// =============================================================================

/**
 * Phase 2: Length-aware Jaccard thresholds.
 * Uses CONTENT TOKEN count (stopword-removed) to scale thresholds.
 * Short lines get more lenient thresholds to avoid Jaccard noise.
 *
 * @param mode - Translation range mode
 * @param contentTokenCount - Number of content tokens (after stopword removal)
 * @returns Overlap threshold for this mode/length combination
 */
function getLengthAwareThreshold(
  mode: "focused" | "balanced" | "adventurous",
  contentTokenCount: number
): number {
  if (mode === "adventurous") {
    // Adventurous: strictest enforcement
    if (contentTokenCount <= 6) return 1.0; // Don't fail on Jaccard alone (structure handles these)
    if (contentTokenCount <= 10) return 0.55;
    if (contentTokenCount <= 16) return 0.45;
    return 0.40;
  }

  if (mode === "balanced") {
    // Balanced: moderate enforcement
    if (contentTokenCount <= 6) return 0.80; // Almost always pass
    if (contentTokenCount <= 10) return 0.65;
    if (contentTokenCount <= 16) return 0.55;
    return 0.50;
  }

  // Focused: lenient (existing behavior)
  return 0.75;
}

/**
 * Legacy mode-aware Jaccard thresholds (kept for backward compatibility).
 * Phase 2: Use getLengthAwareThreshold instead.
 */
const JACCARD_THRESHOLDS: Record<
  "focused" | "balanced" | "adventurous",
  number
> = {
  focused: 0.7,
  balanced: 0.6,
  adventurous: 0.5,
};

/** Get mode-aware Jaccard threshold (legacy, use getLengthAwareThreshold for Phase 2) */
function getJaccardThreshold(
  mode: "focused" | "balanced" | "adventurous"
): number {
  return JACCARD_THRESHOLDS[mode];
}

// If openings/comparison templates repeat, fail even when Jaccard is low.
const MIN_TOKENS_FOR_TEMPLATE_CHECK = 6;

const COMPARISON_MARKERS = [
  // English
  "like",
  "as",
  "as if",
  // French
  "comme",
  "comme si",
  // Spanish/Portuguese
  "como",
  "como si",
  // Italian
  "come",
];

/**
 * Tokenize text for Jaccard calculation.
 * Simple word-level tokenization that works for most languages.
 */
export function tokenize(text: string): Set<string> {
  // Normalize: lowercase, remove punctuation, split on whitespace
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();

  // Split on whitespace and filter empty strings
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);

  return new Set(tokens);
}

function tokenizeList(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  return normalized.split(/\s+/).filter((t) => t.length > 0);
}

// pickStopwords is now imported from ./stopwords.ts

function openingContentBigram(
  text: string,
  stopwords: Set<string>
): string | null {
  const toks = tokenizeList(text);
  if (toks.length < 4) return null;
  const content: string[] = [];
  for (const t of toks) {
    if (!stopwords.has(t)) content.push(t);
    if (content.length >= 2) break;
  }
  if (content.length < 2) return null;
  return content.join(" ");
}

function detectComparisonMarker(text: string): string | null {
  const norm = text.toLowerCase();
  // longest markers first
  for (const m of [...COMPARISON_MARKERS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${m.replace(/\s+/g, "\\\\s+")}\\b`, "i");
    if (re.test(norm)) return m;
  }
  return null;
}

/**
 * Calculate Jaccard similarity between two token sets.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1; // Both empty = identical
  if (a.size === 0 || b.size === 0) return 0; // One empty = no overlap

  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);

  return intersection.size / union.size;
}

// Walk-verb bucket for detecting repeated motion verbs
const WALK_VERB_BUCKET = [
  "walk",
  "stroll",
  "step",
  "wander",
  "march",
  "marche",
  "marcher",
  "caminar",
  "camino",
  "cammino",
  "camminare",
];

/**
 * Detect if text contains a verb from the walk-verb bucket
 */
function detectWalkVerb(text: string): string | null {
  const norm = text.toLowerCase();
  for (const verb of WALK_VERB_BUCKET) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(norm)) {
      return verb;
    }
  }
  return null;
}

/**
 * Extract subject opener type (I/we/you/gerund/etc.)
 * Returns null if unclear or too short.
 */
function detectSubjectOpener(text: string): string | null {
  const toks = tokenizeList(text);
  if (toks.length < 3) return null;

  const first = toks[0];
  // Detect pronoun subjects
  if (/^(i|im|i'm)$/i.test(first)) return "I";
  if (/^(we|us)$/i.test(first)) return "we";
  if (/^(you|your)$/i.test(first)) return "you";
  if (/^(he|she|it|they)$/i.test(first)) return "3rd-person";

  // French subjects
  if (/^(je|j)$/i.test(first)) return "je";
  if (/^(tu)$/i.test(first)) return "tu";
  if (/^(nous)$/i.test(first)) return "nous";
  if (/^(vous)$/i.test(first)) return "vous";
  if (/^(il|elle|on)$/i.test(first)) return "il/elle";

  // Spanish subjects
  if (/^(yo)$/i.test(first)) return "yo";
  if (/^(nosotros|nosotras)$/i.test(first)) return "nosotros";

  // Gerund opener (-ing, -ant, -ando)
  if (/ing$/i.test(first) || /ant$/i.test(first) || /ando$/i.test(first)) {
    return "gerund";
  }

  return null;
}

/**
 * Check if variants are sufficiently distinct.
 *
 * Phase 2: Structural signature checks + length-aware Jaccard thresholds.
 * Integration order:
 * 1. Empty/safety checks
 * 2. Phase 2 structural checks (template clone detection)
 * 3. Legacy shape checks (subject opener, opening bigram, comparison markers, walk-verbs)
 * 4. Phase 2 length-aware Jaccard overlap checks
 */
export function checkDistinctness(
  variants: TranslationVariant[],
  opts?: {
    targetLanguage?: string;
    mode?: "focused" | "balanced" | "adventurous";
    sourceText?: string;
  }
): DistinctnessResult {
  if (variants.length !== 3) {
    return {
      pass: false,
      worstIndex: null,
      reason: `Expected 3 variants, got ${variants.length}`,
    };
  }

  const mode = opts?.mode ?? "balanced";
  const sourceText = opts?.sourceText ?? "";
  const targetLanguage = opts?.targetLanguage;

  // ========================================================================
  // SAFETY CHECK: Empty variant text
  // ========================================================================
  for (let i = 0; i < 3; i++) {
    if (!variants[i].text || variants[i].text.trim().length === 0) {
      return {
        pass: false,
        worstIndex: i,
        reason: `empty_variant_text: variant ${i} has empty text`,
      };
    }
  }

  // ========================================================================
  // PHASE 2: STRUCTURAL SIGNATURE CHECKS (Template Clone Detection)
  // ========================================================================
  const signatures = variants.map((v) => structuralSignature(v.text, targetLanguage));
  const openerTypes = signatures.map((s) => s.openerType);
  const signatureKeys = signatures.map((s) => s.signature);

  // Debug logging for Phase 2
  if (process.env.DEBUG_GATE === "1") {
    console.log("[DEBUG_GATE][phase2.signatures]", {
      mode,
      openerTypes,
      signatureKeys,
      variantTexts: variants.map((v) => v.text.slice(0, 60)),
    });
  }

  // Adventurous mode: Strict structural enforcement
  if (mode === "adventurous") {
    // Rule 1: Variant C signature must be unique vs A and B
    if (signatureKeys[2] === signatureKeys[0] || signatureKeys[2] === signatureKeys[1]) {
      return {
        pass: false,
        worstIndex: 2,
        reason: `signature_match_c: C signature matches ${
          signatureKeys[2] === signatureKeys[0] ? "A" : "B"
        }`,
        details: {
          jaccardScores: [],
          maxOverlap: 0,
          pairWithMaxOverlap: [0, 1],
          openerTypes,
          signatures: signatureKeys,
        },
      };
    }

    // Rule 2: Opener type distinctness with priority (C first, then B)
    if (openerTypes[2] === openerTypes[0] || openerTypes[2] === openerTypes[1]) {
      return {
        pass: false,
        worstIndex: 2,
        reason: `opener_duplicate_c: C opener "${openerTypes[2]}" matches ${
          openerTypes[2] === openerTypes[0] ? "A" : "B"
        }`,
        details: {
          jaccardScores: [],
          maxOverlap: 0,
          pairWithMaxOverlap: [0, 1],
          openerTypes,
          signatures: signatureKeys,
        },
      };
    }

    if (openerTypes[1] === openerTypes[0]) {
      return {
        pass: false,
        worstIndex: 1,
        reason: `opener_duplicate_b: B opener "${openerTypes[1]}" matches A`,
        details: {
          jaccardScores: [],
          maxOverlap: 0,
          pairWithMaxOverlap: [0, 1],
          openerTypes,
          signatures: signatureKeys,
        },
      };
    }
  }

  // Balanced mode: Lighter structural enforcement
  if (mode === "balanced") {
    // If all three openers are the same, fail with priority (prefer C, then B)
    if (
      openerTypes[0] === openerTypes[1] &&
      openerTypes[1] === openerTypes[2]
    ) {
      // Determine worst based on which has highest overlap with others
      // For simplicity, prefer regenerating C first
      return {
        pass: false,
        worstIndex: 2,
        reason: `opener_all_same: all three variants use "${openerTypes[0]}" opener`,
        details: {
          jaccardScores: [],
          maxOverlap: 0,
          pairWithMaxOverlap: [0, 1],
          openerTypes,
          signatures: signatureKeys,
        },
      };
    }
  }

  // ========================================================================
  // LEGACY SHAPE CHECKS + PHASE 2 LENGTH-AWARE JACCARD
  // ========================================================================

  // Tokenize all variants
  const tokenSets = variants.map((v) => tokenize(v.text));
  const tokenLists = variants.map((v) => tokenizeList(v.text));
  const stopwords = pickStopwords(opts?.targetLanguage);

  // ========================================================================
  // PHASE 2: CALCULATE CONTENT TOKEN COUNTS (for length-aware thresholds)
  // ========================================================================
  // Content tokens = tokens after stopword removal
  const contentTokenCounts = tokenLists.map((toks) => {
    const contentToks = toks.filter((t) => !stopwords.has(t));
    return contentToks.length;
  });

  // Use average content token count for threshold calculation
  const avgContentTokenCount = Math.round(
    contentTokenCounts.reduce((sum, c) => sum + c, 0) / 3
  );

  // Phase 2: Length-aware threshold
  const lengthAwareThreshold = getLengthAwareThreshold(mode, avgContentTokenCount);

  // Debug logging for gate initialization
  if (process.env.DEBUG_GATE === "1") {
    console.log("[DEBUG_GATE][init]", {
      mode,
      lengthAwareThreshold,
      avgContentTokenCount,
      contentTokenCounts,
      targetLanguage: opts?.targetLanguage,
      stopwordsLanguage: getStopwordsLanguage(stopwords),
      variantLengths: variants.map((v) => v.text.length),
    });
  }

  // Calculate pairwise Jaccard similarities
  const jaccardScores: number[] = [];
  let maxOverlap = 0;
  let maxPair: [number, number] = [0, 1];

  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const score = jaccardSimilarity(tokenSets[i], tokenSets[j]);
      jaccardScores.push(score);

      if (score > maxOverlap) {
        maxOverlap = score;
        maxPair = [i, j];
      }
    }
  }

  // Template-aware checks (cheap, structure-focused).
  // Guard for very short lines / stopword-heavy openers.
  const minLen = Math.min(...tokenLists.map((t) => t.length));
  if (minLen >= MIN_TOKENS_FOR_TEMPLATE_CHECK) {
    // SHAPE CHECK 1: Subject opener repetition (balanced/adventurous)
    if (mode === "balanced" || mode === "adventurous") {
      const subjectOpeners = variants.map((v) => detectSubjectOpener(v.text));
      const nonNullSubjects = subjectOpeners.filter(
        (s): s is string => s !== null
      );
      if (nonNullSubjects.length >= 2) {
        const uniqSubjects = new Set(nonNullSubjects);
        if (uniqSubjects.size < nonNullSubjects.length) {
          // Find last duplicate
          const dup = subjectOpeners.findIndex(
            (s, i) => s !== null && subjectOpeners.indexOf(s) !== i
          );
          return {
            pass: false,
            worstIndex: dup === -1 ? 2 : dup,
            reason: `Two variants share the same subject opener pattern: "${
              subjectOpeners[dup === -1 ? 2 : dup]
            }"`,
            details: {
              jaccardScores,
              maxOverlap,
              pairWithMaxOverlap: maxPair,
            },
          };
        }
      }
    }

    // SHAPE CHECK 2: Opening content bigram (all modes)
    const openings = variants.map((v) =>
      openingContentBigram(v.text, stopwords)
    );
    const nonNullOpenings = openings.filter((o): o is string => !!o);
    if (nonNullOpenings.length === 3) {
      const uniq = new Set(nonNullOpenings);
      if (uniq.size < 3) {
        // Regenerate one of the duplicates (prefer last duplicate)
        const dup = openings.findIndex(
          (o, i) => o && openings.indexOf(o) !== i
        );
        return {
          pass: false,
          worstIndex: dup === -1 ? 2 : dup,
          reason: `Two variants share the same opening content bigram: "${
            openings[dup === -1 ? 2 : dup]
          }"`,
          details: {
            jaccardScores,
            maxOverlap,
            pairWithMaxOverlap: maxPair,
          },
        };
      }
    }

    // SHAPE CHECK 3: Comparison marker constraints (mode-scaled)
    const markers = variants.map((v) => detectComparisonMarker(v.text));
    const markerCount = markers.filter(Boolean).length;
    const sourceHasMarker =
      /\b(comme|like|as if|as though|as|como|come)\b/i.test(sourceText);

    if (sourceHasMarker) {
      if (mode === "balanced" || mode === "adventurous") {
        // At most 1 variant may use comparison marker
        if (markerCount > 1) {
          return {
            pass: false,
            worstIndex: 2,
            reason: `Source has simile; ${mode} mode requires at most 1 variant with comparison marker (found ${markerCount})`,
            details: {
              jaccardScores,
              maxOverlap,
              pairWithMaxOverlap: maxPair,
            },
          };
        }
      } else {
        // Focused mode: allow up to 2, but warn if all 3
        if (markerCount === 3) {
          return {
            pass: false,
            worstIndex: 2,
            reason:
              "All variants use a comparison marker; prefer at least one variant without comparison-marker template",
            details: {
              jaccardScores,
              maxOverlap,
              pairWithMaxOverlap: maxPair,
            },
          };
        }
      }
    }

    // If multiple variants use the same marker, nudge regeneration.
    const nonNull = markers.filter((m): m is string => !!m);
    if (nonNull.length >= 2 && new Set(nonNull).size < nonNull.length) {
      return {
        pass: false,
        worstIndex: 2,
        reason: `Multiple variants use the same comparison marker (${nonNull.join(
          ", "
        )})`,
        details: {
          jaccardScores,
          maxOverlap,
          pairWithMaxOverlap: maxPair,
        },
      };
    }

    // SHAPE CHECK 4: Walk-verb bucket repetition (balanced/adventurous)
    if (mode === "balanced" || mode === "adventurous") {
      const walkVerbs = variants.map((v) => detectWalkVerb(v.text));
      const nonNullWalkVerbs = walkVerbs.filter((w): w is string => w !== null);
      if (nonNullWalkVerbs.length >= 2) {
        // If 2+ variants use walk-verbs, fail
        return {
          pass: false,
          worstIndex: 2,
          reason: `Multiple variants use walk-verb bucket (${nonNullWalkVerbs.join(
            ", "
          )}); require motion verb divergence`,
          details: {
            jaccardScores,
            maxOverlap,
            pairWithMaxOverlap: maxPair,
          },
        };
      }
    }
  }

  // ========================================================================
  // PHASE 2: LENGTH-AWARE JACCARD OVERLAP CHECK
  // ========================================================================
  // Check if any pair exceeds the length-aware threshold
  if (maxOverlap > lengthAwareThreshold) {
    // ========================================================================
    // PHASE 2: DETERMINISTIC WORST VARIANT SELECTION
    // ========================================================================
    // Priority order for adventurous mode:
    // 1. Prefer regenerating the variant with most high-overlap pairs
    // 2. Tie-breaker: prefer C, then B, then A

    const overlapCounts = [0, 0, 0];

    // Count high-overlap pairs for each variant
    const pairs = [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const;
    pairs.forEach(([a, b], pairIdx) => {
      if (jaccardScores[pairIdx] > lengthAwareThreshold) {
        overlapCounts[a]++;
        overlapCounts[b]++;
      }
    });

    // Determine worstIndex with deterministic priority
    let worstIndex: number;
    const maxCount = Math.max(...overlapCounts);

    if (maxCount > 1) {
      // Multiple variants have high overlap - use priority order
      // Find all variants with maxCount overlaps
      const candidatesWithMaxCount: number[] = [];
      for (let i = 0; i < 3; i++) {
        if (overlapCounts[i] === maxCount) {
          candidatesWithMaxCount.push(i);
        }
      }

      // Adventurous mode tie-breaker: prefer C (2), then B (1), then A (0)
      if (mode === "adventurous") {
        worstIndex = Math.max(...candidatesWithMaxCount);
      } else {
        // Balanced/focused: use highest index among candidates
        worstIndex = Math.max(...candidatesWithMaxCount);
      }
    } else {
      // Only one pair exceeded threshold - pick from that pair
      // Prefer the one with higher index (tie-breaker: C > B > A)
      worstIndex = Math.max(maxPair[0], maxPair[1]);
    }

    const failReason = `Variants ${maxPair[0]} and ${maxPair[1]} have ${(
      maxOverlap * 100
    ).toFixed(0)}% token overlap (threshold: ${(lengthAwareThreshold * 100).toFixed(
      0
    )}% for ${mode} mode, ${avgContentTokenCount} content tokens)`;

    if (process.env.DEBUG_GATE === "1") {
      console.log("[DEBUG_GATE][fail.jaccard]", {
        mode,
        lengthAwareThreshold,
        avgContentTokenCount,
        maxOverlap,
        maxPair,
        worstIndex,
        overlapCounts,
        reason: failReason,
      });
    }

    return {
      pass: false,
      worstIndex,
      reason: failReason,
      details: {
        jaccardScores,
        maxOverlap,
        pairWithMaxOverlap: maxPair,
        openerTypes,
        signatures: signatureKeys,
        contentTokenCounts,
        lengthAdjustedThreshold: lengthAwareThreshold,
      },
    };
  }

  if (process.env.DEBUG_VARIANTS === "1" || process.env.DEBUG_GATE === "1") {
    console.log("[DEBUG_GATE][pass]", {
      mode,
      lengthAwareThreshold,
      avgContentTokenCount,
      jaccardScores,
      maxOverlap,
      maxPair,
      openerTypes,
      signatures: signatureKeys,
    });
  }

  return {
    pass: true,
    worstIndex: null,
    details: {
      jaccardScores,
      maxOverlap,
      pairWithMaxOverlap: maxPair,
      openerTypes,
      signatures: signatureKeys,
      contentTokenCounts,
      lengthAdjustedThreshold: lengthAwareThreshold,
    },
  };
}

// =============================================================================
// Single-Variant Regeneration
// =============================================================================

/**
 * Schema for regeneration response
 */
const RegenerationResponseSchema = z.object({
  text: z.string(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Extract structural features from variants to create contrastive constraints.
 * Returns features that are OVERUSED in the kept variants.
 */
function extractOverusedFeatures(variants: TranslationVariant[]): {
  comparisonMarkers: string[];
  subjectOpeners: string[];
  walkVerbs: string[];
} {
  const markers = variants
    .map((v) => detectComparisonMarker(v.text))
    .filter((m): m is string => m !== null);
  const subjects = variants
    .map((v) => detectSubjectOpener(v.text))
    .filter((s): s is string => s !== null);
  const walkVerbs = variants
    .map((v) => detectWalkVerb(v.text))
    .filter((w): w is string => w !== null);

  return {
    comparisonMarkers: markers,
    subjectOpeners: subjects,
    walkVerbs,
  };
}

/**
 * Build contrastive constraints based on overused features.
 * Returns "MUST DO" and "DO NOT USE" lists.
 */
function buildContrastiveConstraints(features: {
  comparisonMarkers: string[];
  subjectOpeners: string[];
  walkVerbs: string[];
}): { mustDo: string[]; doNotUse: string[] } {
  const mustDo: string[] = [];
  const doNotUse: string[] = [];

  // If both kept variants use comparison markers, regen MUST avoid them
  if (features.comparisonMarkers.length === 2) {
    doNotUse.push(
      "Comparison markers (like/as/comme/como/as if) - other variants already use them"
    );
    mustDo.push(
      "Express relation using direct metaphor, plain statement, or fragment WITHOUT comparison marker"
    );
  }

  // If both kept variants start with same subject type, regen MUST differ
  if (
    features.subjectOpeners.length === 2 &&
    features.subjectOpeners[0] === features.subjectOpeners[1]
  ) {
    doNotUse.push(
      `Subject opener "${features.subjectOpeners[0]}" - other variants already use this pattern`
    );
    if (
      features.subjectOpeners[0] === "I" ||
      features.subjectOpeners[0] === "je"
    ) {
      mustDo.push(
        "Use a different subject (you/we, or omit subject, or use impersonal construction)"
      );
    } else if (features.subjectOpeners[0] === "gerund") {
      mustDo.push(
        "Avoid gerund opener; start with subject or prepositional phrase"
      );
    }
  }

  // If both kept variants use walk-verbs, regen MUST use different motion framing
  if (features.walkVerbs.length === 2) {
    doNotUse.push(
      `Walk-verb bucket (${features.walkVerbs.join(
        ", "
      )}) - other variants already use walking motion`
    );
    mustDo.push(
      "Use different motion framing (move/go/come, or reframe without explicit motion verb)"
    );
  }

  return { mustDo, doNotUse };
}

/**
 * Regenerate a single variant that failed the distinctness gate.
 *
 * Uses feature-contrastive prompting: extracts overused features from kept variants
 * and requires the regenerated variant to avoid those patterns.
 *
 * HARDENING: Added `model` parameter to ensure regeneration uses the same model
 * as the original generation (user's selected model from guideAnswers).
 *
 * @param originalVariants - The three variants from the first generation
 * @param failedIndex - Index of the variant to regenerate (0, 1, or 2)
 * @param recipe - The recipe that should guide this variant
 * @param context - Line context (source text, languages, etc.)
 * @param model - Optional: model to use for regeneration (defaults to TRANSLATOR_MODEL)
 */
export async function regenerateVariant(
  originalVariants: TranslationVariant[],
  failedIndex: number,
  recipe: VariantRecipe,
  context: LineContext,
  model?: string
): Promise<TranslationVariant> {
  const labels = ["A", "B", "C"] as const;
  const failedLabel = labels[failedIndex];
  const otherVariants = originalVariants.filter((_, i) => i !== failedIndex);

  // Extract overused features from the two kept variants
  const features = extractOverusedFeatures(otherVariants);
  const constraints = buildContrastiveConstraints(features);

  const systemPrompt = `You are a translation variant generator. You must generate a STRUCTURALLY DIFFERENT translation variant.

CRITICAL RULES:
- Return ONLY valid JSON
- The new translation must be OBSERVABLY DIFFERENT in structure and wording from the other variants
- Do NOT reuse sentence templates, comparison patterns, or subject openers from other variants
- Follow the recipe directive closely
- Preserve semantic meaning anchors (core facts/images) but use DIFFERENT surface realizations`;

  const contrastiveSection =
    constraints.mustDo.length > 0 || constraints.doNotUse.length > 0
      ? `
═══════════════════════════════════════════════════════════════
CONTRASTIVE CONSTRAINTS (MANDATORY)
═══════════════════════════════════════════════════════════════
The other two variants overuse certain structural patterns. You MUST diverge.

${
  constraints.doNotUse.length > 0
    ? `DO NOT USE:
${constraints.doNotUse.map((c) => `✗ ${c}`).join("\n")}`
    : ""
}

${
  constraints.mustDo.length > 0
    ? `MUST DO:
${constraints.mustDo.map((c) => `✓ ${c}`).join("\n")}`
    : ""
}
`
      : "";

  const userPrompt = `
SOURCE TEXT: "${context.sourceText}"
SOURCE LANGUAGE: ${context.sourceLanguage}
TARGET LANGUAGE: ${context.targetLanguage}
${context.prevLine ? `PREVIOUS LINE: "${context.prevLine}"` : ""}
${context.nextLine ? `NEXT LINE: "${context.nextLine}"` : ""}

EXISTING VARIANTS (DO NOT COPY THESE):
${otherVariants.map((v) => `- Variant ${v.label}: "${v.text}"`).join("\n")}
${contrastiveSection}
RECIPE FOR VARIANT ${failedLabel}:
- Directive: ${recipe.directive}
- Lens: imagery=${recipe.lens.imagery}, voice=${recipe.lens.voice}, sound=${
    recipe.lens.sound
  }, syntax=${recipe.lens.syntax}, cultural=${recipe.lens.cultural}
- Unusualness: ${recipe.unusualnessBudget}

Generate a NEW translation for variant ${failedLabel} that:
1. Follows the recipe directive
2. Honors the contrastive constraints above (if present)
3. Is STRUCTURALLY DIFFERENT from the existing variants (not just synonym swaps)
4. Preserves semantic meaning anchors with different surface wording

OUTPUT FORMAT (JSON only):
{
  "text": "your new translation here",
  "rationale": "brief explanation of how this differs structurally from others",
  "confidence": 0.85
}`;

  try {
    // HARDENING: Use provided model (user's selection) or fall back to default
    const modelToUse = model ?? TRANSLATOR_MODEL;
    const isGpt5 = modelToUse.startsWith("gpt-5");

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
          temperature: 0.9, // Higher temperature for more diversity
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

    const content = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(content);

    const validated = RegenerationResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(
        "[regenerateVariant] Response validation failed:",
        validated.error
      );
      // Return original if regeneration fails
      return originalVariants[failedIndex];
    }

    return {
      label: failedLabel,
      text: validated.data.text,
      rationale: validated.data.rationale,
      confidence: validated.data.confidence,
    };
  } catch (error) {
    console.error("[regenerateVariant] Error:", error);
    // Return original if regeneration fails
    return originalVariants[failedIndex];
  }
}

// =============================================================================
// Lens Compliance Heuristics (Optional)
// =============================================================================

/**
 * Check if a variant's text complies with its recipe lens settings.
 * These are heuristic checks - not guaranteed to catch everything.
 *
 * @param variant - The translation variant to check
 * @param recipe - The recipe that should guide this variant
 * @returns true if the variant appears to comply with the lens
 */
export function checkLensCompliance(
  variant: TranslationVariant,
  recipe: VariantRecipe
): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];
  const text = variant.text.toLowerCase();

  // Voice: collective should use plural pronouns
  if (recipe.lens.voice === "collective") {
    const collectiveIndicators = [
      "we",
      "our",
      "us",
      "nosotros",
      "nos",
      "nuestro",
    ];
    const singularIndicators = ["i ", "my ", "me ", "yo ", "mi "];

    const hasCollective = collectiveIndicators.some((ind) =>
      text.includes(ind)
    );
    const hasSingular = singularIndicators.some((ind) => text.includes(ind));

    if (hasSingular && !hasCollective) {
      issues.push("Voice=collective but uses singular pronouns");
    }
  }

  // Voice: intimate should use second-person or intimate terms
  if (recipe.lens.voice === "intimate") {
    const intimateIndicators = [
      "you",
      "your",
      "tú",
      "tu ",
      "te ",
      "dear",
      "beloved",
    ];
    const hasIntimate = intimateIndicators.some((ind) => text.includes(ind));

    if (!hasIntimate && text.length > 20) {
      issues.push("Voice=intimate but lacks intimate markers");
    }
  }

  // Syntax: fragment should have shorter sentences
  if (recipe.lens.syntax === "fragment") {
    const words = text.split(/\s+/).length;
    if (words > 15) {
      issues.push("Syntax=fragment but sentence is too long");
    }
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}
