/**
 * Phase 4: Diversity Scorecard for Method 2 Testing
 *
 * Provides poem-level quantitative metrics to track diversity improvements:
 * - Opener distinctness percentage
 * - Variant C stance compliance (avoids forbidden "I")
 * - Average pairwise similarity
 * - Regeneration rate
 * - Failure reason aggregation
 */

import { openerType, type OpenerType } from "./structureSignature";
import { tokenize, jaccardSimilarity } from "./diversityGate";
import { pickStopwords } from "./stopwords";
import type { TranslationRangeMode, VariantRecipesBundle } from "./variantRecipes";
import type { LineAudit } from "./audit";

// =============================================================================
// Types
// =============================================================================

export interface LineScore {
  lineIndex: number;
  openerDistinct: boolean;
  openerTypes: { a: string; b: string; c: string };

  cAvoidsI: boolean; // based on stance plan + text opener tokens
  cExpectedSubjectForm?: string;
  cUsedForbiddenI: boolean; // true if starts with I/I'm etc when forbidden

  similarities: { ab: number; ac: number; bc: number; avgPairwise: number };
  regen: { performed: boolean; worstIndex?: 0 | 1 | 2; strategy?: string };
}

export interface PoemScorecard {
  totalLines: number;
  openerDistinctPct: number;
  cAvoidsIPct: number; // only for lines where stance != "i"
  avgPairwiseSimilarity: number;
  regenRate: number;

  byReason?: Record<string, number>; // counts from audits if provided
  lineScores?: LineScore[]; // include in debug mode
}

// =============================================================================
// Line-Level Scoring
// =============================================================================

/**
 * Check if text starts with pronoun "I" (English-focused, language-aware fallback)
 */
function startsWithPronounI(text: string, langHint?: string): boolean {
  const normalized = text.toLowerCase().trim();

  // English-specific check
  if (!langHint || langHint.toLowerCase().includes("english") || langHint.toLowerCase().includes("en")) {
    // Match "I " or "I'm" or "I am" at start
    return /^i(\s|'m|am\s)/i.test(normalized);
  }

  // For other languages, use opener type
  const opener = openerType(text, langHint);
  if (opener === "PRON") {
    // Check if first token is first-person singular pronoun
    const firstToken = text.trim().split(/\s+/)[0]?.toLowerCase();
    // Language-specific first-person singular pronouns
    const firstPersonSingular: Record<string, string[]> = {
      es: ["yo"],
      fr: ["je", "j"],
      de: ["ich"],
      pt: ["eu"],
      it: ["io"],
    };

    const lang = detectSimpleLanguage(langHint);
    const pronouns = firstPersonSingular[lang] || [];
    return pronouns.includes(firstToken);
  }

  return false;
}

/**
 * Simple language detection from hint
 */
function detectSimpleLanguage(langHint?: string): string {
  if (!langHint) return "en";

  const hint = langHint.toLowerCase().trim();
  if (/^(fr|french)/.test(hint)) return "fr";
  if (/^(es|spanish)/.test(hint)) return "es";
  if (/^(de|german)/.test(hint)) return "de";
  if (/^(pt|portuguese)/.test(hint)) return "pt";
  if (/^(it|italian)/.test(hint)) return "it";

  return "en";
}

/**
 * Compute line-level diversity score
 */
export function computeLineScore(params: {
  lineIndex: number;
  aText: string;
  bText: string;
  cText: string;
  targetLanguageHint?: string;
  cExpectedSubjectForm?: string;
  regen?: { performed: boolean; worstIndex?: number; strategy?: string };
}): LineScore {
  const { lineIndex, aText, bText, cText, targetLanguageHint, cExpectedSubjectForm, regen } =
    params;

  // Opener type distinctness
  const openerA = openerType(aText, targetLanguageHint);
  const openerB = openerType(bText, targetLanguageHint);
  const openerC = openerType(cText, targetLanguageHint);

  const openerDistinct =
    openerA !== openerB && openerB !== openerC && openerA !== openerC;

  // Variant C stance compliance
  const cUsedForbiddenI =
    cExpectedSubjectForm && cExpectedSubjectForm !== "i"
      ? startsWithPronounI(cText, targetLanguageHint)
      : false;

  const cAvoidsI = !cUsedForbiddenI;

  // Pairwise similarities
  const stopwords = pickStopwords(targetLanguageHint);
  const tokensA = tokenize(aText);
  const tokensB = tokenize(bText);
  const tokensC = tokenize(cText);

  // Remove stopwords for similarity calculation
  const contentA = new Set([...tokensA].filter((t) => !stopwords.has(t)));
  const contentB = new Set([...tokensB].filter((t) => !stopwords.has(t)));
  const contentC = new Set([...tokensC].filter((t) => !stopwords.has(t)));

  const ab = jaccardSimilarity(contentA, contentB);
  const ac = jaccardSimilarity(contentA, contentC);
  const bc = jaccardSimilarity(contentB, contentC);
  const avgPairwise = (ab + ac + bc) / 3;

  return {
    lineIndex,
    openerDistinct,
    openerTypes: { a: openerA, b: openerB, c: openerC },
    cAvoidsI,
    cExpectedSubjectForm,
    cUsedForbiddenI,
    similarities: { ab, ac, bc, avgPairwise },
    regen: {
      performed: regen?.performed ?? false,
      worstIndex:
        regen?.worstIndex !== undefined ? (regen.worstIndex as 0 | 1 | 2) : undefined,
      strategy: regen?.strategy,
    },
  };
}

// =============================================================================
// Poem-Level Scorecard
// =============================================================================

/**
 * Compute poem-level diversity scorecard from line results
 */
export function computePoemScorecard(params: {
  lines: Array<{
    lineIndex: number;
    aText: string;
    bText: string;
    cText: string;
    regen?: { performed: boolean; worstIndex?: number; strategy?: string };
  }>;
  mode: TranslationRangeMode;
  targetLanguageHint?: string;
  recipesBundle?: VariantRecipesBundle;
  audits?: LineAudit[];
  includeLineScores?: boolean; // debug mode
}): PoemScorecard {
  const { lines, mode, targetLanguageHint, recipesBundle, audits, includeLineScores } = params;

  // Extract stance plan from recipes
  const recipeC = recipesBundle?.recipes.find((r) => r.label === "C");
  const cExpectedSubjectForm = recipeC?.stance_plan?.subject_form;

  // Compute line scores
  const lineScores = lines.map((line) =>
    computeLineScore({
      lineIndex: line.lineIndex,
      aText: line.aText,
      bText: line.bText,
      cText: line.cText,
      targetLanguageHint,
      cExpectedSubjectForm,
      regen: line.regen,
    })
  );

  // Aggregate metrics
  const totalLines = lineScores.length;
  const openerDistinctCount = lineScores.filter((s) => s.openerDistinct).length;
  const openerDistinctPct = totalLines > 0 ? openerDistinctCount / totalLines : 0;

  // C avoids I percentage (only count lines where stance != "i")
  const linesWithNonIStance = lineScores.filter(
    (s) => s.cExpectedSubjectForm && s.cExpectedSubjectForm !== "i"
  );
  const cAvoidsICount = linesWithNonIStance.filter((s) => s.cAvoidsI).length;
  const cAvoidsIPct =
    linesWithNonIStance.length > 0 ? cAvoidsICount / linesWithNonIStance.length : 1.0;

  // Average pairwise similarity
  const avgPairwiseSimilarity =
    totalLines > 0
      ? lineScores.reduce((sum, s) => sum + s.similarities.avgPairwise, 0) / totalLines
      : 0;

  // Regeneration rate
  const regenCount = lineScores.filter((s) => s.regen.performed).length;
  const regenRate = totalLines > 0 ? regenCount / totalLines : 0;

  // Aggregate failure reasons from audits
  let byReason: Record<string, number> | undefined;
  if (audits && audits.length > 0) {
    byReason = {};
    audits.forEach((audit) => {
      if (audit.gate.reason) {
        byReason![audit.gate.reason] = (byReason![audit.gate.reason] || 0) + 1;
      }
      if (audit.phase1?.failed) {
        audit.phase1.failed.forEach((reason) => {
          byReason![reason] = (byReason![reason] || 0) + 1;
        });
      }
    });
  }

  return {
    totalLines,
    openerDistinctPct,
    cAvoidsIPct,
    avgPairwiseSimilarity,
    regenRate,
    byReason,
    lineScores: includeLineScores ? lineScores : undefined,
  };
}

/**
 * Format scorecard as human-readable summary
 */
export function formatScorecard(scorecard: PoemScorecard): string {
  const lines: string[] = [
    "=".repeat(60),
    "METHOD 2 DIVERSITY SCORECARD",
    "=".repeat(60),
    `Total Lines: ${scorecard.totalLines}`,
    "",
    "DIVERSITY METRICS:",
    `  Opener Distinctness: ${(scorecard.openerDistinctPct * 100).toFixed(1)}%`,
    `  C Avoids Forbidden "I": ${(scorecard.cAvoidsIPct * 100).toFixed(1)}%`,
    `  Avg Pairwise Similarity: ${(scorecard.avgPairwiseSimilarity * 100).toFixed(1)}%`,
    `  Regeneration Rate: ${(scorecard.regenRate * 100).toFixed(1)}%`,
  ];

  if (scorecard.byReason && Object.keys(scorecard.byReason).length > 0) {
    lines.push("", "FAILURE REASONS:");
    Object.entries(scorecard.byReason)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        lines.push(`  ${reason}: ${count}`);
      });
  }

  lines.push("=".repeat(60));

  return lines.join("\n");
}
