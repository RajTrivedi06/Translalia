/**
 * Phase 1: Anchor Validation Helpers
 *
 * Validates semantic anchors extracted from source lines and their realizations
 * in translated variants. Ensures anchors are meaningful scene/idea concepts
 * (not pronouns) and that realizations are actual substrings of variant text.
 */

import { pickStopwords } from "./stopwords";
import {
  normalizeForContainment,
  containsNormalized,
  tokenize,
  isMeaningfulToken,
  validateRealizationMeaningfulness,
} from "./textNormalize";

/**
 * Anchor structure from model output
 */
export interface Anchor {
  id: string;
  concept_en: string;
  source_tokens: string[];
}

/**
 * Validation result for anchors
 */
export interface AnchorValidationResult {
  valid: boolean;
  reason?: string;
  invalidAnchorIds?: string[];
  invalidVariants?: number[]; // Variant indices (0, 1, 2) that failed
}

/**
 * Pronoun/person marker patterns to reject as anchor concepts.
 * Anchors must be SCENE/IDEA concepts, not grammatical person markers.
 */
const PRONOUN_PATTERNS = [
  /^i$/i,
  /^you$/i,
  /^we$/i,
  /^he$/i,
  /^she$/i,
  /^they$/i,
  /^it$/i,
  /^one$/i,
  /^me$/i,
  /^us$/i,
  /^him$/i,
  /^her$/i,
  /^them$/i,
  // Common pronoun ids
  /^(NARRATOR|SPEAKER|PERSON|SUBJECT|I|YOU|WE|HE|SHE|THEY|IT|ONE)$/i,
];

/**
 * Check if an anchor concept is a pronoun or person marker (forbidden).
 *
 * @param conceptEn - The English concept label for the anchor
 * @param anchorId - The UPPER_SNAKE anchor id
 * @returns True if the anchor is a forbidden pronoun/person marker
 */
function isPronounAnchor(conceptEn: string, anchorId: string): boolean {
  const conceptLower = conceptEn.toLowerCase().trim();

  // Check concept_en against pronoun patterns
  for (const pattern of PRONOUN_PATTERNS) {
    if (pattern.test(conceptLower)) {
      return true;
    }
  }

  // Check anchor id against pronoun patterns
  for (const pattern of PRONOUN_PATTERNS) {
    if (pattern.test(anchorId)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that anchor IDs are UPPER_SNAKE and unique.
 *
 * @param anchors - Array of anchors to validate
 * @returns { valid: boolean, reason?: string }
 */
function validateAnchorIds(anchors: Anchor[]): { valid: boolean; reason?: string } {
  const ids = new Set<string>();

  for (const anchor of anchors) {
    const id = anchor.id;

    // Check UPPER_SNAKE format
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) {
      return {
        valid: false,
        reason: `Anchor id "${id}" is not UPPER_SNAKE format`,
      };
    }

    // Check uniqueness
    if (ids.has(id)) {
      return {
        valid: false,
        reason: `Duplicate anchor id: "${id}"`,
      };
    }

    ids.add(id);
  }

  return { valid: true };
}

/**
 * Validate anchors array from model output.
 *
 * Rules:
 * - Length should be 3–6 (allow 2–8 but log warning if outside preferred range)
 * - IDs must be unique and UPPER_SNAKE
 * - Must NOT include pronouns or person markers as anchor concepts
 *
 * @param anchors - Array of anchors from model output
 * @returns Validation result
 */
export function validateAnchors(
  anchors: Anchor[] | undefined | null
): AnchorValidationResult {
  if (!anchors || !Array.isArray(anchors)) {
    return {
      valid: false,
      reason: "anchors field missing or not an array",
    };
  }

  // Check length (strict: 2–8, preferred: 3–6)
  if (anchors.length < 2 || anchors.length > 8) {
    return {
      valid: false,
      reason: `Anchors array length ${anchors.length} outside allowed range (2–8)`,
    };
  }

  // Log warning if outside preferred range
  if (
    process.env.DEBUG_GATE === "1" ||
    process.env.DEBUG_PHASE1 === "1"
  ) {
    if (anchors.length < 3 || anchors.length > 6) {
      console.log(
        `[DEBUG_PHASE1][anchors.length.warning] Length ${anchors.length} outside preferred range (3–6)`
      );
    }
  }

  // Validate IDs
  const idCheck = validateAnchorIds(anchors);
  if (!idCheck.valid) {
    return idCheck;
  }

  // Check for pronoun anchors (forbidden)
  const invalidAnchors: string[] = [];
  for (const anchor of anchors) {
    if (isPronounAnchor(anchor.concept_en, anchor.id)) {
      invalidAnchors.push(anchor.id);
    }
  }

  if (invalidAnchors.length > 0) {
    return {
      valid: false,
      reason: `Anchor(s) are pronouns/person markers (forbidden): ${invalidAnchors.join(
        ", "
      )}`,
      invalidAnchorIds: invalidAnchors,
    };
  }

  return { valid: true };
}

/**
 * Validate anchor realizations for a single variant.
 *
 * Rules:
 * - Must contain all anchor IDs as keys
 * - Each realization must be:
 *   - An exact substring of the variant text (case-insensitive, punctuation-tolerant)
 *   - Meaningful (>= 2 chars with exceptions, contains alphanumeric, not stopword-only)
 *
 * @param variantText - The translated text for this variant
 * @param anchorRealizations - Record of anchor_id -> realization string
 * @param anchorIds - Expected anchor IDs (from anchors array)
 * @param targetLanguage - Target language hint for stopword selection
 * @returns Validation result
 */
export function validateAnchorRealizations(
  variantText: string,
  anchorRealizations: Record<string, string> | undefined | null,
  anchorIds: string[],
  targetLanguage: string
): AnchorValidationResult {
  if (!anchorRealizations || typeof anchorRealizations !== "object") {
    return {
      valid: false,
      reason: "anchor_realizations missing or not an object",
    };
  }

  const realizationKeys = Object.keys(anchorRealizations);

  // Check that all anchor IDs are present
  const missingIds = anchorIds.filter((id) => !realizationKeys.includes(id));
  if (missingIds.length > 0) {
    return {
      valid: false,
      reason: `anchor_realizations missing keys: ${missingIds.join(", ")}`,
    };
  }

  // Get stopwords for target language
  const stopwords = pickStopwords(targetLanguage);

  // Validate each realization
  for (const anchorId of anchorIds) {
    const realization = anchorRealizations[anchorId];

    if (typeof realization !== "string") {
      return {
        valid: false,
        reason: `anchor_realizations["${anchorId}"] is not a string`,
      };
    }

    // Check meaningfulness (length, alphanumeric, not stopword-only)
    const meaningCheck = validateRealizationMeaningfulness(
      realization,
      stopwords
    );
    if (!meaningCheck.valid) {
      return {
        valid: false,
        reason: `anchor_realizations["${anchorId}"] is invalid: ${meaningCheck.reason}`,
      };
    }

    // Check containment (normalized, punctuation-tolerant)
    if (!containsNormalized(variantText, realization)) {
      return {
        valid: false,
        reason: `anchor_realizations["${anchorId}"] = "${realization}" not found as substring in variant text: "${variantText.slice(
          0,
          100
        )}${variantText.length > 100 ? "..." : ""}"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate self-report metadata for a variant.
 *
 * Variant B rules:
 * - Must have b_image_shift_summary (string, >= 12 chars, not vague)
 * - Summary must mention at least one anchor ID (case-insensitive substring match)
 *
 * Variant C rules:
 * - Must have c_world_shift_summary (string)
 * - Must have c_subject_form_used (one of allowed values)
 * - For balanced/adventurous mode, c_subject_form_used MUST NOT be "i"
 * - c_subject_form_used must match the stance plan subject_form from recipe
 *
 * @param variant - Variant object with metadata
 * @param label - Variant label ("A", "B", or "C")
 * @param anchorIds - Array of anchor IDs (for B validation)
 * @param mode - Viewpoint range mode
 * @param stancePlanSubjectForm - Expected subject_form from recipe C stance plan (for C validation)
 * @returns Validation result
 */
export function validateSelfReportMetadata(
  variant: {
    label: string;
    text: string;
    b_image_shift_summary?: string;
    c_world_shift_summary?: string;
    c_subject_form_used?: string;
  },
  label: "A" | "B" | "C",
  anchorIds: string[],
  mode: "focused" | "balanced" | "adventurous",
  stancePlanSubjectForm?: string
): AnchorValidationResult {
  // Variant A: no self-report metadata required
  if (label === "A") {
    return { valid: true };
  }

  // Variant B: b_image_shift_summary
  if (label === "B") {
    const summary = variant.b_image_shift_summary;

    if (!summary || typeof summary !== "string") {
      return {
        valid: false,
        reason: "b_image_shift_summary missing or not a string",
        invalidVariants: [1],
      };
    }

    // Check length
    if (summary.trim().length < 12) {
      return {
        valid: false,
        reason: "b_image_shift_summary too short (< 12 chars)",
        invalidVariants: [1],
      };
    }

    // Check if vague
    if (isVagueSummary(summary)) {
      return {
        valid: false,
        reason: "b_image_shift_summary is vague or generic",
        invalidVariants: [1],
      };
    }

    // Check if mentions at least one anchor ID
    const mentionsAnchor = anchorIds.some((id) =>
      summary.toLowerCase().includes(id.toLowerCase())
    );

    if (!mentionsAnchor) {
      return {
        valid: false,
        reason: `b_image_shift_summary does not mention any anchor ID (expected one of: ${anchorIds.join(
          ", "
        )})`,
        invalidVariants: [1],
      };
    }

    return { valid: true };
  }

  // Variant C: c_world_shift_summary + c_subject_form_used
  if (label === "C") {
    const worldSummary = variant.c_world_shift_summary;
    const subjectFormUsed = variant.c_subject_form_used;

    // Check c_world_shift_summary
    if (!worldSummary || typeof worldSummary !== "string") {
      return {
        valid: false,
        reason: "c_world_shift_summary missing or not a string",
        invalidVariants: [2],
      };
    }

    // Check c_subject_form_used
    if (!subjectFormUsed || typeof subjectFormUsed !== "string") {
      return {
        valid: false,
        reason: "c_subject_form_used missing or not a string",
        invalidVariants: [2],
      };
    }

    const allowedForms = ["we", "you", "third_person", "impersonal", "i"];
    if (!allowedForms.includes(subjectFormUsed)) {
      return {
        valid: false,
        reason: `c_subject_form_used "${subjectFormUsed}" not in allowed values: ${allowedForms.join(
          ", "
        )}`,
        invalidVariants: [2],
      };
    }

    // Check if mode forbids "i"
    if (
      (mode === "balanced" || mode === "adventurous") &&
      subjectFormUsed === "i"
    ) {
      return {
        valid: false,
        reason: `c_subject_form_used is "i" (forbidden for ${mode} mode)`,
        invalidVariants: [2],
      };
    }

    // Check if matches stance plan
    if (
      stancePlanSubjectForm &&
      subjectFormUsed !== stancePlanSubjectForm
    ) {
      return {
        valid: false,
        reason: `c_subject_form_used "${subjectFormUsed}" does not match stance plan subject_form "${stancePlanSubjectForm}"`,
        invalidVariants: [2],
      };
    }

    return { valid: true };
  }

  return { valid: true };
}

/**
 * Check if a summary is vague or generic (Phase 1 anti-lazy-compliance).
 *
 * @param summary - Summary text to check
 * @returns True if summary is vague/generic
 */
function isVagueSummary(summary: string): boolean {
  const vaguePhrases = [
    /more poetic/i,
    /more emotional/i,
    /more vivid/i,
    /more creative/i,
    /same meaning/i,
    /just different/i,
    /slightly different/i,
    /made it better/i,
    /improved it/i,
  ];

  for (const pattern of vaguePhrases) {
    if (pattern.test(summary)) {
      return true;
    }
  }

  return false;
}
