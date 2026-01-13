/**
 * Phase 3: Targeted Regeneration with Multi-Sample Salvage
 *
 * Implements surgical regeneration prompts that mechanically enforce
 * structural divergence and archetype constraints, plus multi-sample
 * salvage (K=6) for balanced/adventurous modes.
 */

import { z } from "zod";
import { openai } from "./openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import type {
  VariantRecipe,
  VariantRecipesBundle,
  ViewpointRangeMode,
} from "./variantRecipes";
import type { Anchor } from "./anchorsValidation";
import { trackCallStart, trackCallEnd } from "./openaiInstrumentation";
import {
  validateAnchorRealizations,
  validateSelfReportMetadata,
} from "./anchorsValidation";
import { pickStopwords } from "./stopwords";
import {
  openerType,
  structuralSignature,
  type OpenerType,
} from "./structureSignature";
import { normalizeForContainment, tokenize } from "./textNormalize";

// =============================================================================
// Types
// =============================================================================

export interface RegenCandidate {
  text: string;
  anchor_realizations?: Record<string, string>;
  b_image_shift_summary?: string;
  c_world_shift_summary?: string;
  c_subject_form_used?: string;
  // Debug metadata (populated when DEBUG_REGEN=1)
  candidatesGenerated?: number;
  candidatesValid?: number;
  selectedReason?: string;
}

export interface RegenContext {
  lineText: string;
  sourceLanguage: string;
  targetLanguage: string;
  mode: ViewpointRangeMode;
  prevLine?: string;
  nextLine?: string;
  stancePlanSubjectForm?: string;
}

export interface FixedVariant {
  text: string;
  openerType?: OpenerType;
  signature?: string;
}

// =============================================================================
// Candidate Validation (Stage 1: Hard Constraints)
// =============================================================================

const RegenCandidateSchema = z.object({
  text: z.string().min(1),
  anchor_realizations: z.record(z.string()).optional(),
  b_image_shift_summary: z.string().optional(),
  c_world_shift_summary: z.string().optional(),
  c_subject_form_used: z.string().optional(),
});

/**
 * Validate a regeneration candidate against Phase 1 + Phase 2 hard constraints.
 *
 * Returns { pass: boolean, reasons: string[] }
 */
export function validateCandidate(
  candidate: RegenCandidate,
  anchors: Anchor[],
  targetLanguage: string,
  variantLabel: "A" | "B" | "C",
  mode: ViewpointRangeMode,
  stancePlanSubjectForm?: string,
  desiredOpenerType?: OpenerType,
  fixedVariants?: FixedVariant[]
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Safety: text non-empty
  if (!candidate.text || candidate.text.trim().length === 0) {
    reasons.push("text is empty");
    return { pass: false, reasons };
  }

  // Anchors validation
  if (anchors.length > 0) {
    const anchorIds = anchors.map((a) => a.id);
    const realizationsCheck = validateAnchorRealizations(
      candidate.text,
      candidate.anchor_realizations,
      anchorIds,
      targetLanguage
    );

    if (!realizationsCheck.valid) {
      reasons.push(`anchors: ${realizationsCheck.reason}`);
    }
  }

  // Self-report metadata validation
  const metadataCheck = validateSelfReportMetadata(
    { ...candidate, label: variantLabel },
    variantLabel,
    anchors.map((a) => a.id),
    mode,
    stancePlanSubjectForm
  );

  if (!metadataCheck.valid) {
    reasons.push(`metadata: ${metadataCheck.reason}`);
  }

  // Structural target validation (if specified)
  if (desiredOpenerType) {
    const candidateOpener = openerType(candidate.text, targetLanguage);
    if (candidateOpener !== desiredOpenerType) {
      // Soft warning - log but don't fail hard
      if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_REGEN === "1") {
        console.log(`[DEBUG_REGEN][opener.mismatch]`, {
          desired: desiredOpenerType,
          actual: candidateOpener,
        });
      }
    }
  }

  // Signature uniqueness (adventurous mode)
  if (mode === "adventurous" && fixedVariants && fixedVariants.length >= 2) {
    const candidateSig = structuralSignature(
      candidate.text,
      targetLanguage
    ).signature;
    const sigMatches = fixedVariants.some(
      (fv) => fv.signature === candidateSig
    );
    if (sigMatches) {
      reasons.push("signature matches fixed variant (adventurous violation)");
    }
  }

  return { pass: reasons.length === 0, reasons };
}

// =============================================================================
// Candidate Scoring (Stage 2: Dissimilarity + Stage 3: Fluency)
// =============================================================================

/**
 * Compute dissimilarity score for a candidate.
 * Lower score = better (further from fixed variants).
 *
 * Score = max(simA, simB) + signaturePenalty
 */
export function scoreDissimilarity(
  candidate: RegenCandidate,
  fixedVariants: FixedVariant[],
  targetLanguage: string
): number {
  const stopwords = pickStopwords(targetLanguage);

  // Compute Jaccard similarities
  const candidateTokens = new Set(
    tokenizeForJaccard(candidate.text, stopwords)
  );
  const similarities = fixedVariants.map((fv) => {
    const fvTokens = new Set(tokenizeForJaccard(fv.text, stopwords));
    return jaccardSimilarity(candidateTokens, fvTokens);
  });

  const maxSim = Math.max(...similarities, 0);

  // Structural penalty: signature match
  const candidateSig = structuralSignature(
    candidate.text,
    targetLanguage
  ).signature;
  const signaturePenalty = fixedVariants.some(
    (fv) => fv.signature === candidateSig
  )
    ? 0.15
    : 0.0;

  return maxSim + signaturePenalty;
}

/**
 * Compute fluency score for a candidate.
 * Higher score = worse (penalize issues).
 *
 * Heuristics:
 * - Repeated punctuation ("!!", "..", ",,")
 * - Extreme length blowup (>1.6x longest fixed variant)
 * - Weird symbol density (>10% non-alphanumeric)
 */
export function scoreFluency(
  candidate: RegenCandidate,
  fixedVariants: FixedVariant[],
  mode: ViewpointRangeMode
): number {
  let penalty = 0;

  const text = candidate.text;

  // Repeated punctuation
  if (/[.]{2,}|[,]{2,}|[!]{2,}|[-]{3,}/.test(text)) {
    penalty += 1.0;
  }

  // Extreme length blowup (unless adventurous)
  if (mode !== "adventurous" && fixedVariants.length > 0) {
    const maxFixedLen = Math.max(...fixedVariants.map((fv) => fv.text.length));
    if (text.length > maxFixedLen * 1.6) {
      penalty += 0.5;
    }
  }

  // Weird symbol density
  const alphanumCount = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  const totalChars = text.length;
  if (totalChars > 0) {
    const alphanumRatio = alphanumCount / totalChars;
    if (alphanumRatio < 0.9) {
      // >10% non-alphanumeric
      penalty += 0.3;
    }
  }

  return penalty;
}

/**
 * Select best candidate from validated candidates.
 *
 * Stage 2: Minimize dissimilarity score
 * Stage 3: Tie-break with fluency + length
 */
export function selectBestCandidate(
  candidates: RegenCandidate[],
  fixedVariants: FixedVariant[],
  targetLanguage: string,
  mode: ViewpointRangeMode
): RegenCandidate {
  if (candidates.length === 0) {
    throw new Error("No candidates to select from");
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Score all candidates
  const scored = candidates.map((c) => {
    const dissim = scoreDissimilarity(c, fixedVariants, targetLanguage);
    const fluency = scoreFluency(c, fixedVariants, mode);
    return {
      candidate: c,
      dissim,
      fluency,
      length: c.text.length,
    };
  });

  // Sort: primary by dissimilarity (lower better), tie-break by fluency + length
  scored.sort((a, b) => {
    if (Math.abs(a.dissim - b.dissim) > 0.01) {
      return a.dissim - b.dissim; // Lower dissim = better
    }
    if (Math.abs(a.fluency - b.fluency) > 0.1) {
      return a.fluency - b.fluency; // Lower fluency penalty = better
    }
    return a.length - b.length; // Shorter = better (tie-break)
  });

  return scored[0].candidate;
}

// =============================================================================
// Multi-Sample Regeneration
// =============================================================================

/**
 * Regenerate a single variant with multi-sample salvage (K=6).
 *
 * Only used when gate fails in balanced/adventurous mode.
 * Generates K candidates, validates them, scores them, picks best.
 *
 * @param worstIndex - Index of variant to regenerate (0, 1, or 2)
 * @param fixedVariants - The other two variants (for dissimilarity scoring)
 * @param recipe - Recipe for the variant being regenerated
 * @param recipes - Full recipe bundle (for stance plan)
 * @param context - Line context (source, languages, mode, etc.)
 * @param anchors - Semantic anchors for this line
 * @param gateReason - Original gate failure reason (for targeted fixes)
 * @param model - Model to use for regeneration
 * @returns Best candidate that passes constraints
 */
export async function regenerateVariantWithSalvage(
  worstIndex: number,
  fixedVariants: Array<{ label: "A" | "B" | "C"; text: string }>,
  recipe: VariantRecipe,
  recipes: VariantRecipesBundle,
  context: RegenContext,
  anchors: Anchor[],
  gateReason: string,
  model?: string
): Promise<RegenCandidate> {
  const K = context.mode === "focused" ? 1 : 6; // Multi-sample only for balanced/adventurous
  const label = ["A", "B", "C"][worstIndex] as "A" | "B" | "C";

  // Build fixed variants with structural info
  const fixedVariantsWithStructure: FixedVariant[] = fixedVariants
    .filter((_, i) => i !== worstIndex)
    .map((v) => ({
      text: v.text,
      openerType: openerType(v.text, context.targetLanguage),
      signature: structuralSignature(v.text, context.targetLanguage).signature,
    }));

  // Determine desired opener type (avoid duplicates)
  const fixedOpeners = fixedVariantsWithStructure
    .map((fv) => fv.openerType)
    .filter((o): o is OpenerType => o !== undefined);
  const desiredOpenerType = determineDesiredOpenerType(
    fixedOpeners,
    context.mode,
    gateReason
  );

  // Build targeted regen prompt
  const promptText = buildRegenPrompt({
    lineText: context.lineText,
    sourceLanguage: context.sourceLanguage,
    targetLanguage: context.targetLanguage,
    mode: context.mode,
    prevLine: context.prevLine,
    nextLine: context.nextLine,
    label,
    recipe,
    recipes,
    anchors,
    fixedVariants: fixedVariantsWithStructure,
    gateReason,
    desiredOpenerType,
  });

  if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_REGEN === "1") {
    console.log(`[DEBUG_REGEN][prompt]`, {
      label,
      mode: context.mode,
      K,
      desiredOpenerType,
      gateReason: gateReason.slice(0, 80),
    });
  }

  // Generate K candidates
  const modelToUse = model ?? TRANSLATOR_MODEL;
  const isGpt5 = modelToUse.startsWith("gpt-5");

  const candidates: RegenCandidate[] = [];

  try {
    // Attempt n=K if supported (GPT-4 supports n parameter)
    if (!isGpt5 && K > 1) {
      const requestId = trackCallStart("regen");
      const regenStart = Date.now();
      let completion;
      try {
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.9, // Higher for diversity
          n: K,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a translation variant generator.",
            },
            { role: "user", content: promptText },
          ],
        });
        trackCallEnd(requestId, {
          status: "ok",
          latencyMs: Date.now() - regenStart,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          model: modelToUse,
          temperature: 0.9,
        });
      } catch (error: unknown) {
        const errorObj = error as {
          name?: string;
          status?: number;
          message?: string;
        };
        trackCallEnd(requestId, {
          status: "error",
          latencyMs: Date.now() - regenStart,
          errorName: errorObj.name,
          httpStatus: errorObj.status,
          errorMessageShort: errorObj.message?.slice(0, 100),
          model: modelToUse,
          temperature: 0.9,
        });
        throw error;
      }

      for (const choice of completion.choices) {
        const text = choice.message?.content?.trim() ?? "{}";
        try {
          const parsed = JSON.parse(text);
          const validated = RegenCandidateSchema.safeParse(parsed);
          if (validated.success) {
            candidates.push(validated.data);
          }
        } catch (e) {
          // Skip unparseable
        }
      }
    } else {
      // Fall back to loop (GPT-5 doesn't support n parameter, or K=1)
      for (let i = 0; i < K; i++) {
        const requestId = trackCallStart("regen");
        const regenStart = Date.now();
        let completion;
        try {
          completion = isGpt5
            ? await openai.chat.completions.create({
                model: modelToUse,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content: "You are a translation variant generator.",
                  },
                  { role: "user", content: promptText },
                ],
              })
            : await openai.chat.completions.create({
                model: modelToUse,
                temperature: 0.9,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content: "You are a translation variant generator.",
                  },
                  { role: "user", content: promptText },
                ],
              });
          trackCallEnd(requestId, {
            status: "ok",
            latencyMs: Date.now() - regenStart,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
            model: modelToUse,
            temperature: isGpt5 ? undefined : 0.9,
          });
        } catch (error: unknown) {
          const errorObj = error as {
            name?: string;
            status?: number;
            message?: string;
          };
          trackCallEnd(requestId, {
            status: "error",
            latencyMs: Date.now() - regenStart,
            errorName: errorObj.name,
            httpStatus: errorObj.status,
            errorMessageShort: errorObj.message?.slice(0, 100),
            model: modelToUse,
            temperature: isGpt5 ? undefined : 0.9,
          });
          throw error;
        }

        const text = completion.choices[0]?.message?.content?.trim() ?? "{}";
        try {
          const parsed = JSON.parse(text);
          const validated = RegenCandidateSchema.safeParse(parsed);
          if (validated.success) {
            candidates.push(validated.data);
          }
        } catch (e) {
          // Skip unparseable
        }
      }
    }
  } catch (error) {
    console.error(`[regenerateVariantWithSalvage] Generation error:`, error);
    throw error;
  }

  if (candidates.length === 0) {
    throw new Error(
      `Failed to generate any valid candidates for variant ${label}`
    );
  }

  // Stage 1: Validate candidates against hard constraints
  const stancePlanSubjectForm = context.stancePlanSubjectForm;

  const validCandidates = candidates.filter((c) => {
    const validation = validateCandidate(
      c,
      anchors,
      context.targetLanguage,
      label,
      context.mode,
      stancePlanSubjectForm,
      desiredOpenerType,
      fixedVariantsWithStructure
    );
    return validation.pass;
  });

  if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_REGEN === "1") {
    console.log(`[DEBUG_REGEN][validation]`, {
      totalGenerated: candidates.length,
      hardPassCount: validCandidates.length,
      label,
    });
  }

  // Fallback: If all fail hard constraints, pick least bad
  if (validCandidates.length === 0) {
    console.warn(
      `[regenerateVariantWithSalvage] All ${candidates.length} candidates failed hard constraints for ${label}`
    );

    // Pick candidate with fewest constraint violations
    const scored = candidates.map((c) => {
      const validation = validateCandidate(
        c,
        anchors,
        context.targetLanguage,
        label,
        context.mode,
        stancePlanSubjectForm,
        desiredOpenerType,
        fixedVariantsWithStructure
      );
      return { candidate: c, failCount: validation.reasons.length };
    });

    scored.sort((a, b) => a.failCount - b.failCount);
    return scored[0].candidate;
  }

  // Stage 2 + 3: Select best candidate by dissimilarity + fluency
  const best = selectBestCandidate(
    validCandidates,
    fixedVariantsWithStructure,
    context.targetLanguage,
    context.mode
  );

  if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_REGEN === "1") {
    const dissim = scoreDissimilarity(
      best,
      fixedVariantsWithStructure,
      context.targetLanguage
    );
    const fluency = scoreFluency(
      best,
      fixedVariantsWithStructure,
      context.mode
    );
    console.log(`[DEBUG_REGEN][selected]`, {
      label,
      dissim,
      fluency,
      textPreview: best.text.slice(0, 60),
      openerType: openerType(best.text, context.targetLanguage),
    });
  }

  // Add debug metadata to result
  return {
    ...best,
    candidatesGenerated: K,
    candidatesValid: validCandidates.length,
    selectedReason:
      validCandidates.length > 0
        ? "best_by_dissimilarity"
        : "least_bad_fallback",
  };
}

// =============================================================================
// Helper: Determine Desired Opener Type
// =============================================================================

function determineDesiredOpenerType(
  fixedOpeners: OpenerType[],
  mode: ViewpointRangeMode,
  gateReason: string
): OpenerType | undefined {
  if (mode === "focused") {
    // Minimal constraints in focused
    return undefined;
  }

  // In adventurous/balanced: try to pick an opener not used by fixed variants
  const allOpeners: OpenerType[] = ["PREP", "NOUN_PHRASE", "PRON", "OTHER"];
  const unusedOpeners = allOpeners.filter((o) => !fixedOpeners.includes(o));

  if (unusedOpeners.length > 0) {
    // Prefer: PREP > NOUN_PHRASE > OTHER > PRON (PRON often too similar)
    const priority = ["PREP", "NOUN_PHRASE", "OTHER", "PRON"];
    for (const p of priority) {
      if (unusedOpeners.includes(p as OpenerType)) {
        return p as OpenerType;
      }
    }
    return unusedOpeners[0];
  }

  // All openers used - pick different from most recent (first fixed)
  if (fixedOpeners.length > 0) {
    const avoid = fixedOpeners[0];
    const alternatives = allOpeners.filter((o) => o !== avoid);
    return alternatives[0];
  }

  return undefined;
}

// =============================================================================
// Helper: Build Targeted Regen Prompt
// =============================================================================

interface RegenPromptParams {
  lineText: string;
  sourceLanguage: string;
  targetLanguage: string;
  mode: ViewpointRangeMode;
  prevLine?: string;
  nextLine?: string;
  label: "A" | "B" | "C";
  recipe: VariantRecipe;
  recipes: VariantRecipesBundle;
  anchors: Anchor[];
  fixedVariants: FixedVariant[];
  gateReason: string;
  desiredOpenerType?: OpenerType;
}

function buildRegenPrompt(params: RegenPromptParams): string {
  const {
    lineText,
    sourceLanguage,
    targetLanguage,
    mode,
    prevLine,
    nextLine,
    label,
    recipe,
    recipes,
    anchors,
    fixedVariants,
    gateReason,
    desiredOpenerType,
  } = params;

  // Extract banned tokens from fixed variants (anti-copy)
  const stopwords = pickStopwords(targetLanguage);
  const bannedFirstTokens = new Set<string>();

  if (fixedVariants.length > 0) {
    const firstVariantTokens = tokenize(fixedVariants[0].text);
    const contentTokens = firstVariantTokens.filter(
      (t) => !stopwords.has(t.toLowerCase())
    );
    contentTokens
      .slice(0, 3)
      .forEach((t) => bannedFirstTokens.add(t.toLowerCase()));
  }

  const bannedTokensList = Array.from(bannedFirstTokens);

  // Stance plan for C
  const stancePlanText =
    label === "C" && recipe.stance_plan
      ? `
CRITICAL STANCE PLAN (poem-level, MUST follow exactly):
- Subject form: ${recipe.stance_plan.subject_form}
- You MUST set c_subject_form_used to exactly "${
          recipe.stance_plan.subject_form
        }"
${
  recipe.stance_plan.world_frame
    ? `- World frame: ${recipe.stance_plan.world_frame}`
    : ""
}
${
  recipe.stance_plan.register_shift
    ? `- Register shift: ${recipe.stance_plan.register_shift}`
    : ""
}
${recipe.stance_plan.notes ? `- Notes: ${recipe.stance_plan.notes}` : ""}

${
  mode === "balanced" || mode === "adventurous"
    ? `FORBIDDEN: c_subject_form_used MUST NOT be "i" in ${mode} mode.`
    : ""
}`
      : "";

  // Archetype-specific rules
  const archetypeRules =
    label === "B"
      ? `
VARIANT B ARCHETYPE RULES (prismatic_reimagining):
- MUST materially change one central image/metaphor element vs the original variants
- NOT just synonyms - reframe the visual/sensory framing
- MUST include b_image_shift_summary:
  - 1 sentence, English, specific about what image/metaphor changed
  - MUST mention at least one anchor ID explicitly (e.g., "I reframed SKY as...")
  - NOT vague phrases like "more poetic" or "more creative"`
      : label === "C"
      ? `
VARIANT C ARCHETYPE RULES (world_voice_transposition):
- MUST shift narrator stance/world frame vs the original variants
- MUST include c_world_shift_summary: 1 sentence, English, concrete about voice/world shift
- MUST include c_subject_form_used: exactly as specified in stance plan above`
      : "";

  // Structural targets
  const structuralTargets = desiredOpenerType
    ? `
STRUCTURAL TARGET:
- Try to start with opener type: ${desiredOpenerType}
- ${
        desiredOpenerType === "PREP"
          ? "Begin with a preposition (on, in, at, through, etc.)"
          : ""
      }
- ${
        desiredOpenerType === "NOUN_PHRASE"
          ? "Begin with an article + noun (the X, a Y, etc.)"
          : ""
      }
- ${
        desiredOpenerType === "PRON"
          ? "Begin with a pronoun (matching stance plan if C)"
          : ""
      }
- ${
        desiredOpenerType === "OTHER"
          ? "Use a creative opening (verb, adjective, fragment, etc.)"
          : ""
      }`
    : "";

  return `You are regenerating variant ${label} for a poetry translation line.

ORIGINAL FAILURE REASON: ${gateReason}

SOURCE LINE: "${lineText}"
SOURCE LANGUAGE: ${sourceLanguage}
TARGET LANGUAGE: ${targetLanguage}
${prevLine ? `PREVIOUS LINE: "${prevLine}"` : ""}
${nextLine ? `NEXT LINE: "${nextLine}"` : ""}

RECIPE FOR VARIANT ${label}:
- Archetype: ${recipe.archetype}
- Directive: ${recipe.directive}
- Lens: imagery=${recipe.lens.imagery}, voice=${recipe.lens.voice}, sound=${
    recipe.lens.sound
  }, syntax=${recipe.lens.syntax}
${stancePlanText}

EXISTING VARIANTS (DO NOT COPY):
${fixedVariants
  .map(
    (v, i) =>
      `- Variant ${
        ["A", "B", "C"].filter((_, idx) => idx !== label.charCodeAt(0) - 65)[i]
      }: "${v.text}"\n  (opener: ${v.openerType}, signature: ${v.signature})`
  )
  .join("\n")}

═══════════════════════════════════════════════════════════════
ANTI-COPY RULES (MANDATORY)
═══════════════════════════════════════════════════════════════
- DO NOT reuse these content tokens in your first 8 tokens: ${bannedTokensList.join(
    ", "
  )}
- DO NOT start with the same first 2 tokens as any existing variant
- MUST be STRUCTURALLY DIFFERENT (not just synonym swaps)
${structuralTargets}

═══════════════════════════════════════════════════════════════
SEMANTIC ANCHORS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════
${anchors
  .map(
    (a) => `- ${a.id}: ${a.concept_en} (source: ${a.source_tokens.join(", ")})`
  )
  .join("\n")}

You MUST include "anchor_realizations" with ALL anchor IDs as keys.
Each realization MUST be:
- An EXACT substring that appears in your translated text (case-insensitive)
- Meaningful (not empty, not just punctuation, not stopword-only)
- Short phrases you will literally include

${archetypeRules}

OUTPUT FORMAT (JSON only, no markdown):
{
  "text": "your translation here",
  "anchor_realizations": {
    ${anchors
      .map((a) => `"${a.id}": "exact substring from text"`)
      .join(",\n    ")}
  }${
    label === "B"
      ? `,
  "b_image_shift_summary": "1 sentence mentioning anchor ID"`
      : ""
  }${
    label === "C"
      ? `,
  "c_subject_form_used": "${
    recipe.stance_plan?.subject_form || "third_person"
  }",
  "c_world_shift_summary": "1 sentence about world/voice shift"`
      : ""
  }
}

Return ONLY valid JSON. No markdown, no explanations.`;
}

// =============================================================================
// Jaccard Similarity Helper (for dissimilarity scoring)
// =============================================================================

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);

  return intersection.size / union.size;
}

function tokenizeForJaccard(text: string, stopwords: Set<string>): string[] {
  const tokens = tokenize(text);
  return tokens.filter((t) => !stopwords.has(t.toLowerCase()));
}
