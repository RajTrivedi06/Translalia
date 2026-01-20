/**
 * Phase 3: Targeted Regeneration with Multi-Sample Salvage
 *
 * Implements surgical regeneration prompts that mechanically enforce
 * structural divergence and archetype constraints, plus multi-sample
 * salvage (K=6) for balanced/adventurous modes.
 */

import { z } from "zod";
import { openai } from "./openai";
import { buildSamplingParams } from "./buildSamplingParams";
import {
  chatCompletionsWithRetry,
  getCompletionTokenCount,
} from "./chatCompletionsWithRetry";
import { getTokenLimitParam } from "./tokenLimitParam";
import type { TickInstrumentation } from "@/lib/workshop/runTranslationTick";
import { TRANSLATOR_MODEL } from "@/lib/models";
import type {
  VariantRecipe,
  VariantRecipesBundle,
  TranslationRangeMode,
} from "./variantRecipes";
import { trackCallStart, trackCallEnd } from "./openaiInstrumentation";
import {
  validateAnchorRealizations,
  validateSelfReportMetadata,
  type Anchor,
} from "./anchorsValidation";
import { pickStopwords } from "./stopwords";
import {
  computeAnchorRealizations,
  compareRealizations,
} from "../translation/method2/computeAnchorRealizations";
import {
  detectSubjectForm,
  normalizeSubjectForm,
} from "../translation/method2/detectSubjectForm";
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
  mode: TranslationRangeMode;
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
  anchors: Anchor[] | undefined,
  targetLanguage: string,
  variantLabel: "A" | "B" | "C",
  mode: TranslationRangeMode,
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

  // Anchors validation (skip if anchors are not provided)
  if (anchors && anchors.length > 0) {
    const anchorIds = anchors.map((a) => a.id);
    const useLocalRealizations = process.env.ENABLE_LOCAL_ANCHOR_REALIZATIONS === "1";
    
    // ISS-011: Compute local realizations for comparison/debugging
    const localRealizations = computeAnchorRealizations(
      candidate.text,
      anchors,
      targetLanguage
    );
    
    // ISS-011: Dual-mode comparison logging
    if (process.env.DEBUG_ANCHOR_REALIZATIONS === "1") {
      const comparison = compareRealizations(
        candidate.anchor_realizations,
        localRealizations,
        anchors
      );
      
      console.log(`[ANCHOR_REALIZATIONS][regen][comparison]`, JSON.stringify({
        variantLabel,
        anchorCount: comparison.anchorCount,
        modelCount: comparison.modelCount,
        localCount: comparison.localCount,
        matches: comparison.matches,
        mismatches: comparison.mismatches.length,
        modelStopwordOnly: comparison.modelStopwordOnly,
        localStopwordOnly: comparison.localStopwordOnly,
        timestamp: Date.now(),
      }));
    }
    
    // ISS-011: Use local realizations if flag is enabled, else use model-provided
    const realizationsToValidate = useLocalRealizations
      ? localRealizations
      : candidate.anchor_realizations;
    
    const realizationsCheck = validateAnchorRealizations(
      candidate.text,
      realizationsToValidate,
      anchorIds,
      targetLanguage
    );

    if (!realizationsCheck.valid) {
      reasons.push(`anchors: ${realizationsCheck.reason}`);
    }
    
    // ISS-011: If using local realizations, update candidate with computed realizations
    if (useLocalRealizations && realizationsCheck.valid) {
      candidate.anchor_realizations = localRealizations;
    }
  }

  // Self-report metadata validation (skip if anchors are not provided)
  if (anchors && anchors.length > 0) {
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
  mode: TranslationRangeMode
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
  mode: TranslationRangeMode
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
  anchors: Anchor[] | undefined,
  gateReason: string,
  model?: string,
  options?: {
    maxTimeMs?: number; // ✅ D) Escape hatch: Max total regen time
    regenAttemptNumber?: number; // Track which regen round this is (1-indexed)
    maxRegenRounds?: number; // Max regen rounds per line
  }
): Promise<RegenCandidate & { degraded?: boolean; degradationReason?: string }> {
  // ✅ D) Escape hatch: Enforce max regen rounds
  const regenAttempt = options?.regenAttemptNumber ?? 1;
  const maxRegenRounds = options?.maxRegenRounds ?? 1; // Default: 1 attempt
  if (regenAttempt > maxRegenRounds) {
    throw new Error(
      `Max regen rounds (${maxRegenRounds}) exceeded. Attempt: ${regenAttempt}`
    );
  }

  const regenStartTime = Date.now();
  const maxTimeMs = options?.maxTimeMs ?? 90000; // Default: 90s max per regen
  
  // ISS-007: Configurable K for GPT-5 vs default
  const modelToUse = model ?? TRANSLATOR_MODEL;
  const isGpt5 = modelToUse.startsWith("gpt-5");
  const parallelRegenEnabled = process.env.ENABLE_GPT5_REGEN_PARALLEL !== "0";
  
  // Determine K based on mode and model
  const defaultK = context.mode === "focused" ? 1 : 6;
  const gpt5K = parallelRegenEnabled
    ? Math.min(
        Math.max(1, Number(process.env.GPT5_REGEN_K) || 3),
        6
      )
    : defaultK;
  const defaultRegenK = Math.min(
    Math.max(1, Number(process.env.DEFAULT_REGEN_K) || 6),
    6
  );
  
  // ISS-007: Use GPT-5-specific K if GPT-5, else use default
  const K = isGpt5 ? gpt5K : (context.mode === "focused" ? 1 : defaultRegenK);
  
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

  // ISS-001: Output token cap for regen
  const regenMaxOutputTokens = Math.min(
    Math.max(200, Number(process.env.REGEN_MAX_OUTPUT_TOKENS) || 1500),
    3000
  );

  // ISS-007: Configurable concurrency for GPT-5 vs default
  // GPT-5: Higher concurrency (default 6) to reduce batching
  // Default: Lower concurrency (default 3) for safety
  const gpt5RegenConcurrency = parallelRegenEnabled
    ? Math.min(
        Math.max(1, Number(process.env.GPT5_REGEN_CONCURRENCY) || 6),
        8
      )
    : 3;
  const defaultRegenConcurrency = Math.min(
    Math.max(1, Number(process.env.DEFAULT_REGEN_CONCURRENCY) || 3),
    8
  );
  
  // Use GPT-5-specific concurrency if GPT-5, else use default
  // Clamp concurrency to not exceed K (no point in more concurrency than candidates)
  const REGEN_CONCURRENCY = Math.min(
    isGpt5 ? gpt5RegenConcurrency : defaultRegenConcurrency,
    K
  );

  const candidates: RegenCandidate[] = [];

  // ✅ D) Helper: Check if we've exceeded time budget
  const checkTimeBudget = (): boolean => {
    const elapsed = Date.now() - regenStartTime;
    if (elapsed > maxTimeMs) {
      console.warn(
        `[regen] ⚠️  Time budget exceeded (${elapsed}ms > ${maxTimeMs}ms), using best available candidate`
      );
      return true;
    }
    return false;
  };

  try {
    // ISS-007: Attempt n=K if supported (GPT-4 supports n parameter)
    // This path is unchanged - GPT-4 still uses efficient n=K batch generation
    if (!isGpt5 && K > 1) {
      const requestId = trackCallStart("regen");
      const regenStart = Date.now();
      
      // ISS-007: Log GPT-4 batch generation start
      console.log(
        `[REGEN][START] GPT-4 batch regen: K=${K}, n=${K}, ` +
        `model=${modelToUse}, mode=${context.mode}, label=${label}`
      );
      
      let completion;
      try {
        completion = await openai.chat.completions.create({
          model: modelToUse,
          ...buildSamplingParams(modelToUse, { temperature: 0.9 }), // Higher for diversity
          n: K,
          response_format: { type: "json_object" },
          ...getTokenLimitParam(modelToUse, regenMaxOutputTokens),
          messages: [
            {
              role: "system",
              content: "You are a translation variant generator.",
            },
            { role: "user", content: promptText },
          ],
        });

        // ISS-001: Safety logging for regen (n=K case)
        const completionTokens = completion.usage?.completion_tokens;
        const finishReason = completion.choices[0]?.finish_reason;
        const likelyCapped =
          finishReason === "length" ||
          (completionTokens !== undefined &&
            completionTokens >= regenMaxOutputTokens * 0.98);

        console.log(`[REGEN]`, JSON.stringify({
          model: modelToUse,
          cap: regenMaxOutputTokens,
          n: K,
          promptTokens: completion.usage?.prompt_tokens ?? null,
          completionTokens: completionTokens ?? null,
          totalTokens: completion.usage?.total_tokens ?? null,
          latencyMs: Date.now() - regenStart,
          finishReason: finishReason ?? null,
          likelyCapped,
        }));

        trackCallEnd(requestId, {
          status: "ok",
          latencyMs: Date.now() - regenStart,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          model: modelToUse,
          ...buildSamplingParams(modelToUse, { temperature: 0.9 }),
          maxTokens: regenMaxOutputTokens,
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
          ...buildSamplingParams(modelToUse, { temperature: 0.9 }),
        });
        throw error;
      }

      // ISS-007: Log GPT-4 batch completion
      const gpt4BatchLatency = Date.now() - regenStart;
      console.log(
        `[REGEN][COMPLETE] GPT-4 batch regen finished: ` +
        `K=${K}, n=${K}, totalWallTimeMs=${gpt4BatchLatency}, ` +
        `choices=${completion.choices.length}, model=${modelToUse}`
      );
      
      for (const choice of completion.choices) {
        const text = choice.message?.content?.trim() ?? "{}";
        try {
          const parsed = JSON.parse(text);
          const validated = RegenCandidateSchema.safeParse(parsed);
          if (validated.success) {
            candidates.push(validated.data);
          } else {
            // ISS-001: Log Zod validation failures
            console.warn(`[REGEN][VALIDATION_FAIL]`, JSON.stringify({
              model: modelToUse,
              cap: regenMaxOutputTokens,
              error: "Zod validation failed",
              textPreview: text.length > 400
                ? `${text.slice(0, 200)}...${text.slice(-200)}`
                : text,
              fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
            }));
          }
        } catch (e) {
          // ISS-001: Parse failure handling for regen (n=K case)
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error(`[REGEN][PARSE_FAIL]`, JSON.stringify({
            error: errorMessage,
            model: modelToUse,
            cap: regenMaxOutputTokens,
            completionTokens: completion.usage?.completion_tokens ?? null,
            finishReason: choice.finish_reason ?? null,
            textLength: text.length,
            textPreview: text.length > 400
              ? `${text.slice(0, 200)}...${text.slice(-200)}`
              : text,
            fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
          }));
        }
      }
    } else {
      // Fall back to loop (GPT-5 doesn't support n parameter, or K=1)
      // PART 1 FIX: Bounded parallelization for GPT-5 regen
      if (K === 1 || !isGpt5) {
        // Single call or non-GPT-5: keep sequential behavior
        for (let i = 0; i < K; i++) {
          const requestId = trackCallStart("regen");
          const regenStart = Date.now();
          let completion;
          try {
            // ISS-013: Parse callback for stop sequence fallback (sequential case)
            const parseCallback = (text: string) => {
              return JSON.parse(text);
            };
            
            // ISS-012: Use safe sampling params with retry-on-unsupported-param
            // ISS-017: Pass instrumentation for OpenAI call tracking
            // ISS-018: Pass metadata for raw output logging
            completion = await chatCompletionsWithRetry(
              openai,
              {
                model: modelToUse,
                ...buildSamplingParams(modelToUse, { temperature: 0.9 }),
                response_format: { type: "json_object" },
                ...getTokenLimitParam(modelToUse, regenMaxOutputTokens),
                messages: [
                  {
                    role: "system",
                    content: "You are a translation variant generator.",
                  },
                  { role: "user", content: promptText },
                ],
              },
              parseCallback, // ISS-013: Pass parse callback for fallback retry
              undefined, // ISS-017: Pass instrumentation (not available in this context)
              "regen", // ISS-017: Call kind
              undefined // ISS-018: Metadata (not available in RegenContext)
            );
            
            // ISS-012: Log completion token count for instrumentation
            if (process.env.DEBUG_SAMPLING === "1") {
              const tokenCount = getCompletionTokenCount(completion);
              if (tokenCount !== null) {
                console.log(
                  `[sampling] model=${modelToUse} completion_tokens=${tokenCount} (regen sequential, attempt=${i + 1})`
                );
              }
            }

            // ISS-001: Safety logging for regen (sequential case)
            const completionTokens = completion.usage?.completion_tokens;
            const finishReason = completion.choices[0]?.finish_reason;
            const likelyCapped =
              finishReason === "length" ||
              (completionTokens !== undefined &&
                completionTokens >= regenMaxOutputTokens * 0.98);

            console.log(`[REGEN]`, JSON.stringify({
              model: modelToUse,
              cap: regenMaxOutputTokens,
              promptTokens: completion.usage?.prompt_tokens ?? null,
              completionTokens: completionTokens ?? null,
              totalTokens: completion.usage?.total_tokens ?? null,
              latencyMs: Date.now() - regenStart,
              finishReason: finishReason ?? null,
              likelyCapped,
            }));

            trackCallEnd(requestId, {
              status: "ok",
              latencyMs: Date.now() - regenStart,
              promptTokens: completion.usage?.prompt_tokens,
              completionTokens: completion.usage?.completion_tokens,
              totalTokens: completion.usage?.total_tokens,
              model: modelToUse,
              temperature: isGpt5 ? undefined : 0.9,
              maxTokens: regenMaxOutputTokens,
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
            } else {
              // ISS-001: Log Zod validation failures
              console.warn(`[REGEN][VALIDATION_FAIL]`, JSON.stringify({
                model: modelToUse,
                cap: regenMaxOutputTokens,
                error: "Zod validation failed",
                textPreview: text.length > 400
                  ? `${text.slice(0, 200)}...${text.slice(-200)}`
                  : text,
                fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
              }));
            }
          } catch (e) {
            // ISS-001: Parse failure handling for regen (sequential case)
            const errorMessage = e instanceof Error ? e.message : String(e);
            const completionTokens = completion.usage?.completion_tokens;
            const finishReason = completion.choices[0]?.finish_reason;
            console.error(`[REGEN][PARSE_FAIL]`, JSON.stringify({
              error: errorMessage,
              model: modelToUse,
              cap: regenMaxOutputTokens,
              completionTokens: completionTokens ?? null,
              finishReason: finishReason ?? null,
              textLength: text.length,
              textPreview: text.length > 400
                ? `${text.slice(0, 200)}...${text.slice(-200)}`
                : text,
              fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
            }));
          }
        }
      } else {
        // ✅ GPT-5 with K > 1: Use bounded parallelization
        // ISS-007: Processes K candidates with configurable concurrency
        // Helper function for a single regen attempt
        const regenStartWallTime = Date.now();
        console.log(
          `[REGEN][START] GPT-5 parallel regen: K=${K}, concurrency=${REGEN_CONCURRENCY}, ` +
          `model=${modelToUse}, mode=${context.mode}, label=${label}`
        );
        const runOneRegenAttempt = async (
          attemptIndex: number
        ): Promise<RegenCandidate | null> => {
          const requestId = trackCallStart("regen");
          const regenStart = Date.now();
          const candidateStartTime = Date.now();
          
          // ISS-007: Log candidate start
          if (process.env.DEBUG_REGEN === "1") {
            console.log(
              `[REGEN][CANDIDATE_START] candidate=${attemptIndex + 1}/${K}, ` +
              `concurrency=${REGEN_CONCURRENCY}, model=${modelToUse}`
            );
          }
          
          try {
            const completion = await chatCompletionsWithRetry(openai, {
              model: modelToUse,
              response_format: { type: "json_object" },
              ...getTokenLimitParam(modelToUse, regenMaxOutputTokens),
              messages: [
                {
                  role: "system",
                  content: "You are a translation variant generator.",
                },
                { role: "user", content: promptText },
              ],
            });

            // ISS-001: Safety logging for regen (parallel case)
            const completionTokens = completion.usage?.completion_tokens;
            const finishReason = completion.choices[0]?.finish_reason;
            const likelyCapped =
              finishReason === "length" ||
              (completionTokens !== undefined &&
                completionTokens >= regenMaxOutputTokens * 0.98);

            console.log(`[REGEN]`, JSON.stringify({
              model: modelToUse,
              cap: regenMaxOutputTokens,
              promptTokens: completion.usage?.prompt_tokens ?? null,
              completionTokens: completionTokens ?? null,
              totalTokens: completion.usage?.total_tokens ?? null,
              latencyMs: Date.now() - regenStart,
              finishReason: finishReason ?? null,
              likelyCapped,
            }));

            trackCallEnd(requestId, {
              status: "ok",
              latencyMs: Date.now() - regenStart,
              promptTokens: completion.usage?.prompt_tokens,
              completionTokens: completion.usage?.completion_tokens,
              totalTokens: completion.usage?.total_tokens,
              model: modelToUse,
              maxTokens: regenMaxOutputTokens,
            });

            const text =
              completion.choices[0]?.message?.content?.trim() ?? "{}";
            try {
              const parsed = JSON.parse(text);
            const validated = RegenCandidateSchema.safeParse(parsed);
            if (validated.success) {
              // ISS-007: Log candidate completion
              const candidateLatency = Date.now() - candidateStartTime;
              if (process.env.DEBUG_REGEN === "1") {
                console.log(
                  `[REGEN][CANDIDATE_COMPLETE] candidate=${attemptIndex + 1}/${K}, ` +
                  `latencyMs=${candidateLatency}, tokens=${completionTokens ?? "unknown"}, ` +
                  `outcome=pass`
                );
              }
              return validated.data;
            } else {
                // ISS-001: Log Zod validation failures
                console.warn(`[REGEN][VALIDATION_FAIL]`, JSON.stringify({
                  model: modelToUse,
                  cap: regenMaxOutputTokens,
                  error: "Zod validation failed",
                  textPreview: text.length > 400
                    ? `${text.slice(0, 200)}...${text.slice(-200)}`
                    : text,
                  fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
                }));
              }
            } catch (e) {
              // ISS-001: Parse failure handling for regen (parallel case)
              const errorMessage = e instanceof Error ? e.message : String(e);
              const completionTokens = completion.usage?.completion_tokens;
              const finishReason = completion.choices[0]?.finish_reason;
              console.error(`[REGEN][PARSE_FAIL]`, JSON.stringify({
                error: errorMessage,
                model: modelToUse,
                cap: regenMaxOutputTokens,
                completionTokens: completionTokens ?? null,
                finishReason: finishReason ?? null,
                textLength: text.length,
                textPreview: text.length > 400
                  ? `${text.slice(0, 200)}...${text.slice(-200)}`
                  : text,
                fullText: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : undefined,
              }));
            }
            return null;
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
            });
            // Don't throw - return null to allow other attempts to succeed
            return null;
          }
        };

        // ISS-007: Process with bounded concurrency
        // If concurrency >= K, all candidates run in parallel (single "batch")
        // If concurrency < K, candidates run in batches
        // ✅ D) Escape hatch: Check time budget between batches
        const totalBatches = Math.ceil(K / REGEN_CONCURRENCY);
        let batchNumber = 0;
        
        for (
          let start = 0;
          start < K;
          start += REGEN_CONCURRENCY
        ) {
          batchNumber++;
          // Check time budget before starting new batch
          if (checkTimeBudget()) {
            console.warn(
              `[REGEN][BATCH_SKIP] Time budget exceeded before batch ${batchNumber}/${totalBatches}, ` +
              `using ${candidates.length} candidates so far`
            );
            break; // Use candidates generated so far
          }

          const batchSize = Math.min(REGEN_CONCURRENCY, K - start);
          const batchStartTime = Date.now();
          
          // ISS-007: Log batch start
          console.log(
            `[REGEN][BATCH_START] batch=${batchNumber}/${totalBatches}, ` +
            `candidates=${start + 1}-${start + batchSize}/${K}, ` +
            `concurrency=${batchSize}, model=${modelToUse}`
          );
          
          const batchPromises = Array.from({ length: batchSize }, (_, j) =>
            runOneRegenAttempt(start + j)
          );

          const settled = await Promise.allSettled(batchPromises);
          const batchLatency = Date.now() - batchStartTime;
          let batchPassed = 0;
          let batchFailed = 0;
          
          for (const result of settled) {
            if (result.status === "fulfilled" && result.value !== null) {
              candidates.push(result.value);
              batchPassed++;
            } else {
              batchFailed++;
            }
          }
          
          // ISS-007: Log batch completion
          console.log(
            `[REGEN][BATCH_COMPLETE] batch=${batchNumber}/${totalBatches}, ` +
            `latencyMs=${batchLatency}, passed=${batchPassed}, failed=${batchFailed}, ` +
            `totalCandidates=${candidates.length}/${K}`
          );
        }
        
        // ISS-007: Log overall regen completion
        const totalRegenWallTime = Date.now() - regenStartWallTime;
        console.log(
          `[REGEN][COMPLETE] GPT-5 parallel regen finished: ` +
          `K=${K}, concurrency=${REGEN_CONCURRENCY}, ` +
          `totalWallTimeMs=${totalRegenWallTime}, ` +
          `candidatesGenerated=${candidates.length}, ` +
          `batches=${batchNumber}/${totalBatches}, model=${modelToUse}`
        );
      }
    }
  } catch (error) {
    console.error(`[regenerateVariantWithSalvage] Generation error:`, error);
    throw error;
  }

  // ✅ D) Escape hatch: Check time budget and mark as degraded if exceeded
  const totalRegenTime = Date.now() - regenStartTime;
  const timeExceeded = totalRegenTime > maxTimeMs;
  const degradationReason = timeExceeded
    ? `regen_time_exceeded_${totalRegenTime}ms`
    : undefined;

  if (candidates.length === 0) {
    throw new Error(
      `Failed to generate any valid candidates for variant ${label}`
    );
  }

  // ✅ D) If time exceeded, use first available candidate (best-effort)
  if (timeExceeded && candidates.length > 0) {
    console.warn(
      `[regen] ⚠️  Using degraded result: Time budget exceeded (${totalRegenTime}ms > ${maxTimeMs}ms)`
    );
    // Return first candidate with degraded flag - validation will happen but may fail gate
    const degradedCandidate = candidates[0];
    
    // ISS-014: Compute c_subject_form_used locally from Variant C text (time-exceeded case)
    let cSubjectFormUsed: string | undefined = degradedCandidate.c_subject_form_used;
    if (label === "C") {
      const detected = detectSubjectForm(degradedCandidate.text);
      const normalized = normalizeSubjectForm(detected);
      if (normalized) {
        cSubjectFormUsed = normalized;
      } else if (degradedCandidate.c_subject_form_used) {
        cSubjectFormUsed = degradedCandidate.c_subject_form_used;
      }
    }
    
    return {
      ...degradedCandidate,
      c_subject_form_used: cSubjectFormUsed,
      degraded: true,
      degradationReason,
    };
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
  // ✅ D) Mark as degraded if we had to use fallback
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
    const fallbackCandidate = scored[0].candidate;
    
    // ISS-014: Compute c_subject_form_used locally from Variant C text (fallback case)
    let cSubjectFormUsed: string | undefined = fallbackCandidate.c_subject_form_used;
    if (label === "C") {
      const detected = detectSubjectForm(fallbackCandidate.text);
      const normalized = normalizeSubjectForm(detected);
      if (normalized) {
        cSubjectFormUsed = normalized;
      } else if (fallbackCandidate.c_subject_form_used) {
        cSubjectFormUsed = fallbackCandidate.c_subject_form_used;
      }
    }
    
    return {
      ...fallbackCandidate,
      c_subject_form_used: cSubjectFormUsed,
      degraded: true,
      degradationReason: `all_candidates_failed_hard_constraints`,
    };
  }

  // Stage 2 + 3: Select best candidate by dissimilarity + fluency
  const best = selectBestCandidate(
    validCandidates,
    fixedVariantsWithStructure,
    context.targetLanguage,
    context.mode
  );

  // ISS-014: Compute c_subject_form_used locally from Variant C text
  const bestText = best.text;
  let cSubjectFormUsed: string | undefined = best.c_subject_form_used;
  
  if (label === "C") {
    const detected = detectSubjectForm(bestText);
    const normalized = normalizeSubjectForm(detected);
    
    // ISS-014: Prefer local computation over model-provided value
    if (normalized) {
      cSubjectFormUsed = normalized;
      
      // ISS-014: Debug logging
      if (process.env.DEBUG_SUBJECT_FORM === "1") {
        const modelProvided = best.c_subject_form_used;
        console.log(`[SUBJECT_FORM][regen]`, JSON.stringify({
          variantLabel: label,
          computed: normalized,
          modelProvided: modelProvided || null,
          textSnippet: bestText.slice(0, 80),
          match: modelProvided === normalized,
        }));
      }
    } else if (best.c_subject_form_used) {
      // Fallback: use model-provided if local detection failed
      cSubjectFormUsed = best.c_subject_form_used;
      
      if (process.env.DEBUG_SUBJECT_FORM === "1") {
        console.warn(`[SUBJECT_FORM][regen]`, JSON.stringify({
          variantLabel: label,
          computed: null,
          modelProvided: best.c_subject_form_used,
          textSnippet: bestText.slice(0, 80),
          warning: "local_detection_failed_using_model_value",
        }));
      }
    }
  }
  
  const resultWithSubjectForm = {
    ...best,
    c_subject_form_used: cSubjectFormUsed,
  };
  
  // ✅ D) Return with degradation flag if time exceeded
  return timeExceeded
    ? { ...resultWithSubjectForm, degraded: true, degradationReason }
    : resultWithSubjectForm;

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
  mode: TranslationRangeMode,
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
  mode: TranslationRangeMode;
  prevLine?: string;
  nextLine?: string;
  label: "A" | "B" | "C";
  recipe: VariantRecipe;
  recipes: VariantRecipesBundle;
  anchors: Anchor[] | undefined;
  fixedVariants: FixedVariant[];
  gateReason: string;
  desiredOpenerType?: OpenerType;
}

/**
 * Parse gate failure reason into targeted regeneration constraints
 */
function parseGateReason(
  gateReason: string,
  sourceText: string
): { constraints: string[]; mustAvoid: string[] } {
  const constraints: string[] = [];
  const mustAvoid: string[] = [];
  
  // Parse common failure patterns
  if (gateReason.includes("opening_bigram_collision") || gateReason.includes("share the same opening content bigram")) {
    constraints.push("Start with DIFFERENT content words (first 2 non-stopword tokens must differ from existing variants)");
  }
  
  if (gateReason.includes("comparison_marker_collision") || gateReason.includes("comparison marker")) {
    mustAvoid.push("Comparison markers (like/as/comme/como/como si/comme si/as if)");
    constraints.push("Express relation using direct metaphor, plain statement, or fragment WITHOUT comparison markers");
  }
  
  if (gateReason.includes("walk_verb_collision") || gateReason.includes("walk-verb")) {
    mustAvoid.push("Walk-verb bucket (walk/stroll/wander/march/caminar/cammino/camminare)");
    constraints.push("Use different motion framing (move/go/come, or reframe without explicit motion verb)");
  }
  
  if (gateReason.includes("signature_match") || gateReason.includes("signature")) {
    constraints.push("Use a DIFFERENT structural template (your signature must differ from existing variants)");
  }
  
  if (gateReason.includes("opener_duplicate") || gateReason.includes("opener")) {
    constraints.push("Use a DIFFERENT opener type (subject opener pattern must differ)");
  }
  
  if (gateReason.includes("jaccard") || gateReason.includes("overlap")) {
    // Extract overlap percentage if available
    const overlapMatch = gateReason.match(/(\d+)%/);
    const overlap = overlapMatch ? overlapMatch[1] : "high";
    constraints.push(`Reduce token overlap with other variants (current: ${overlap}%, target: significantly lower)`);
  }
  
  if (gateReason.includes("short_line_char_similarity")) {
    constraints.push("Use MORE DIFFERENT wording (character-level similarity too high)");
    constraints.push("Change sentence structure and word choice more dramatically");
  }
  
  if (gateReason.includes("short_line_opening_match")) {
    constraints.push("Start with COMPLETELY DIFFERENT words (first 10-15 characters must differ)");
  }
  
  if (gateReason.includes("short_line_diversity_lever")) {
    constraints.push("Add structural differences (use different punctuation patterns or contractions vs existing variants)");
  }
  
  // Fidelity gate failures
  if (gateReason.includes("number") && gateReason.includes("missing")) {
    const numberMatch = gateReason.match(/Missing numbers?: ([^\n;]+)/);
    if (numberMatch) {
      constraints.push(`MUST include these numbers: ${numberMatch[1]}`);
    } else {
      // Extract numbers from source
      const sourceNumbers = sourceText.match(/\b\d{1,4}\b|\d+%|[$€£¥]\d+/g);
      if (sourceNumbers) {
        constraints.push(`MUST include these numbers: ${sourceNumbers.join(", ")}`);
      }
    }
  }
  
  if (gateReason.includes("negation") && gateReason.includes("missing")) {
    constraints.push("MUST preserve negation (source has 'not'/'never'/etc., variant must also have negation)");
  }
  
  if (gateReason.includes("proper noun") || gateReason.includes("proper nouns")) {
    const nounMatch = gateReason.match(/Missing proper nouns?: ([^\n;]+)/);
    if (nounMatch) {
      constraints.push(`MUST include these proper nouns: ${nounMatch[1]}`);
    }
  }
  
  if (gateReason.includes("terminal intent") || (gateReason.includes("?") || gateReason.includes("!"))) {
    if (sourceText.trim().endsWith("?")) {
      constraints.push("MUST end with question mark (?) - source is a question");
    } else if (sourceText.trim().endsWith("!")) {
      constraints.push("MUST end with exclamation mark (!) - source is an exclamation");
    }
  }
  
  return { constraints, mustAvoid };
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
  
  // Parse gate reason into targeted constraints
  const { constraints, mustAvoid } = parseGateReason(gateReason, lineText);

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

  // Stance plan for C (keep quality instructions, no output requirements)
  const stancePlanText =
    label === "C" && recipe.stance_plan
      ? `
CRITICAL STANCE PLAN (poem-level, MUST follow exactly):
- Subject form: ${recipe.stance_plan.subject_form} (will be detected automatically from your translation)
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
    ? `FORBIDDEN: Subject form MUST NOT be "i" in ${mode} mode.`
    : ""
}`
      : "";

  // Archetype-specific rules (keep quality instructions, no output requirements)
  const archetypeRules =
    label === "B"
      ? `
VARIANT B ARCHETYPE RULES (prismatic_reimagining):
- MUST materially change one central image/metaphor element vs the original variants
- NOT just synonyms - reframe the visual/sensory framing
- Shift imagery creatively while preserving meaning`
      : label === "C"
      ? `
VARIANT C ARCHETYPE RULES (world_voice_transposition):
- MUST shift narrator stance/world frame vs the original variants
- Change voice/perspective creatively while preserving meaning`
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

  // Build semantic anchors section only if anchors are provided
  const semanticAnchorsSection = anchors && anchors.length > 0
    ? `
═══════════════════════════════════════════════════════════════
SEMANTIC ANCHORS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════
${anchors
  .map(
    (a) => `- ${a.id}: ${a.concept_en} (source: ${a.source_tokens.join(", ")})`
  )
  .join("\n")}

Preserve these semantic concepts in your translation.`
    : "";

  // Build targeted constraints section
  const targetedConstraintsSection = constraints.length > 0 || mustAvoid.length > 0
    ? `
═══════════════════════════════════════════════════════════════
TARGETED FIXES (based on failure reason)
═══════════════════════════════════════════════════════════════
${mustAvoid.length > 0
    ? `DO NOT USE:\n${mustAvoid.map(item => `✗ ${item}`).join("\n")}\n`
    : ""}
${constraints.length > 0
    ? `MUST DO:\n${constraints.map(item => `✓ ${item}`).join("\n")}`
    : ""}
`
    : `
═══════════════════════════════════════════════════════════════
FAILURE CONTEXT
═══════════════════════════════════════════════════════════════
Original failure reason: ${gateReason}
`;

  return `You are regenerating variant ${label} for a poetry translation line.
${targetedConstraintsSection}

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
${semanticAnchorsSection}

${archetypeRules}

OUTPUT FORMAT (JSON only, no markdown):
{
  "text": "your translation here"
}

CRITICAL: Return ONLY the translation text in the "text" field. No labels (Variant A:), no explanations, no meta-commentary, no multi-line paragraphs.
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
