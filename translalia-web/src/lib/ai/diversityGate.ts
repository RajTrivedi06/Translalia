/**
 * Diversity Gate for Prismatic Variants
 *
 * Performs cheap post-generation checks to ensure translation variants are
 * observably different. If variants are too similar, triggers single-variant
 * regeneration (max 1 extra call).
 */

import { z } from "zod";
import type { VariantRecipe } from "./variantRecipes";
import { openai } from "./openai";
import { TRANSLATOR_MODEL } from "@/lib/models";

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

/** Threshold for Jaccard similarity - above this is "too similar" */
const JACCARD_THRESHOLD = 0.6;

// If openings/comparison templates repeat, fail even when Jaccard is low.
const MIN_TOKENS_FOR_TEMPLATE_CHECK = 6;

const EN_STOPWORDS = new Set([
  "i",
  "im",
  "i'm",
  "we",
  "you",
  "he",
  "she",
  "it",
  "they",
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "with",
  "under",
  "over",
  "through",
  "as",
  "like",
  "and",
  "or",
  "but",
  "so",
  "that",
  "this",
  "these",
  "those",
]);

const FR_STOPWORDS = new Set([
  "je",
  "j",
  "tu",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "elles",
  "un",
  "une",
  "le",
  "la",
  "les",
  "des",
  "du",
  "de",
  "dans",
  "sous",
  "sur",
  "avec",
  "comme",
  "et",
  "ou",
  "mais",
]);

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
function tokenize(text: string): Set<string> {
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

function pickStopwords(targetLanguage?: string): Set<string> {
  const hint = (targetLanguage ?? "").toLowerCase();
  if (
    hint.includes("french") ||
    hint.includes("français") ||
    hint.includes("francais")
  )
    return FR_STOPWORDS;
  return EN_STOPWORDS;
}

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
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
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
 * Mode-scaled shape checks + Jaccard similarity.
 * Balanced/Adventurous modes enforce stricter structural divergence.
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

  // Tokenize all variants
  const tokenSets = variants.map((v) => tokenize(v.text));
  const tokenLists = variants.map((v) => tokenizeList(v.text));
  const stopwords = pickStopwords(opts?.targetLanguage);

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
      const subjectOpeners = variants.map((v) =>
        detectSubjectOpener(v.text)
      );
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
    const sourceHasMarker = /\b(comme|like|as if|as though|as|como|come)\b/i.test(
      sourceText
    );

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

  // Check if any pair exceeds threshold
  if (maxOverlap > JACCARD_THRESHOLD) {
    // Determine which variant to regenerate
    // Prefer regenerating the one with higher overlap with multiple variants
    const overlapCounts = [0, 0, 0];

    // Count high-overlap pairs for each variant
    const pairs = [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const;
    pairs.forEach(([a, b], pairIdx) => {
      if (jaccardScores[pairIdx] > JACCARD_THRESHOLD) {
        overlapCounts[a]++;
        overlapCounts[b]++;
      }
    });

    // Pick the variant with most high-overlap pairs
    // If tied, pick from the max overlap pair (arbitrary: second one)
    let worstIndex = maxPair[1];
    const maxCount = Math.max(...overlapCounts);
    if (maxCount > 1) {
      worstIndex = overlapCounts.indexOf(maxCount);
    }

    return {
      pass: false,
      worstIndex,
      reason: `Variants ${maxPair[0]} and ${maxPair[1]} have ${(
        maxOverlap * 100
      ).toFixed(0)}% token overlap (threshold: ${JACCARD_THRESHOLD * 100}%)`,
      details: {
        jaccardScores,
        maxOverlap,
        pairWithMaxOverlap: maxPair,
      },
    };
  }

  if (process.env.DEBUG_VARIANTS === "1") {
    // eslint-disable-next-line no-console
    console.log("[DEBUG_VARIANTS][gate.pass]", {
      jaccardScores,
      maxOverlap,
      maxPair,
      threshold: JACCARD_THRESHOLD,
    });
  }

  return {
    pass: true,
    worstIndex: null,
    details: {
      jaccardScores,
      maxOverlap,
      pairWithMaxOverlap: maxPair,
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
function extractOverusedFeatures(
  variants: TranslationVariant[]
): {
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
    if (features.subjectOpeners[0] === "I" || features.subjectOpeners[0] === "je") {
      mustDo.push(
        "Use a different subject (you/we, or omit subject, or use impersonal construction)"
      );
    } else if (features.subjectOpeners[0] === "gerund") {
      mustDo.push("Avoid gerund opener; start with subject or prepositional phrase");
    }
  }

  // If both kept variants use walk-verbs, regen MUST use different motion framing
  if (features.walkVerbs.length === 2) {
    doNotUse.push(
      `Walk-verb bucket (${features.walkVerbs.join(", ")}) - other variants already use walking motion`
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
 * @param originalVariants - The three variants from the first generation
 * @param failedIndex - Index of the variant to regenerate (0, 1, or 2)
 * @param recipe - The recipe that should guide this variant
 * @param context - Line context (source text, languages, etc.)
 */
export async function regenerateVariant(
  originalVariants: TranslationVariant[],
  failedIndex: number,
  recipe: VariantRecipe,
  context: LineContext
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
    let modelToUse = TRANSLATOR_MODEL;
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
