/**
 * Shared Method 2 Translation Function
 *
 * This is the core Method 2 pipeline that can be called from:
 * - Interactive API route: /api/workshop/translate-line-with-recipes
 * - Background translation: processStanza() when translationMethod === "method-2"
 *
 * Implements the full P6-P8 Recipe-Driven Prismatic Variants pipeline:
 * - Generates variants using sophisticated recipe system with lens configurations
 * - Runs distinctness gate to ensure diversity
 * - Regenerates variants if needed using feature-contrastive constraints
 * - Post-processes to add word-level alignment for Workshop UX compatibility
 * - Returns identical structure to /translate-line for seamless integration
 */

import { openai } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import {
  getOrCreateVariantRecipes,
  type ViewpointRangeMode,
  type VariantRecipesBundle,
  extractRecipeCacheInfo,
} from "@/lib/ai/variantRecipes";
import { buildRecipeAwarePrismaticPrompt } from "@/lib/ai/workshopPrompts";
import { buildTranslatorPersonality } from "@/lib/ai/translatorPersonality";
import {
  checkDistinctness,
  type TranslationVariant,
} from "@/lib/ai/diversityGate";
import { regenerateVariantWithSalvage } from "@/lib/ai/regen";
import {
  makeLineAuditBase,
  attachPhase1Metrics,
  attachGateMetrics,
  attachRegenMetrics,
  auditToLogLine,
  pushAuditToThreadState,
  type Phase1Result,
  type RegenInfo,
} from "@/lib/ai/audit";
import {
  validateAnchors,
  validateAnchorRealizations,
  validateSelfReportMetadata,
  type Anchor,
} from "@/lib/ai/anchorsValidation";
import type { AlignedWord } from "@/lib/ai/alignmentGenerator";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";
import { enqueueAlignmentJob } from "@/lib/workshop/alignmentQueue";
import type { LineQualityMetadata } from "@/types/translationJob";
import { trackCallStart, trackCallEnd } from "@/lib/ai/openaiInstrumentation";

export interface TranslateLineWithRecipesOptions {
  threadId: string;
  lineIndex: number;
  lineText: string;
  fullPoem: string;
  stanzaIndex?: number;
  prevLine?: string;
  nextLine?: string;
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  // Audit fields (optional, for background translations)
  auditUserId?: string;
  auditProjectId?: string | null;
}

/**
 * Extended response that includes quality metadata
 */
export interface TranslateLineWithRecipesResponse
  extends LineTranslationResponse {
  qualityMetadata?: LineQualityMetadata;
}

/**
 * Core Method 2 translation pipeline
 */
export async function translateLineWithRecipesInternal({
  threadId,
  lineIndex,
  lineText,
  fullPoem,
  stanzaIndex,
  prevLine,
  nextLine,
  guideAnswers,
  sourceLanguage,
  targetLanguage,
  model: modelOverride,
  auditUserId,
  auditProjectId,
}: TranslateLineWithRecipesOptions): Promise<TranslateLineWithRecipesResponse> {
  console.log("[HIT] translateLineWithRecipesInternal");

  // Handle empty lines
  if (!lineText.trim()) {
    const emptyResponse: LineTranslationResponse = {
      lineOriginal: lineText,
      translations: [
        {
          variant: 1,
          fullText: "",
          words: [],
          metadata: { literalness: 1.0, characterCount: 0 },
        },
        {
          variant: 2,
          fullText: "",
          words: [],
          metadata: { literalness: 1.0, characterCount: 0 },
        },
        {
          variant: 3,
          fullText: "",
          words: [],
          metadata: { literalness: 1.0, characterCount: 0 },
        },
      ],
      modelUsed: modelOverride ?? TRANSLATOR_MODEL,
    };
    return emptyResponse;
  }

  // Determine viewpoint range mode
  const mode: ViewpointRangeMode =
    guideAnswers.viewpointRangeMode ?? "balanced";

  // Get or create variant recipes (cached per thread + context)
  let recipes: VariantRecipesBundle;
  let recipeCache;
  try {
    console.time(`[TIMING][line=${lineIndex}] recipe`);
    recipes = await getOrCreateVariantRecipes(
      threadId,
      guideAnswers,
      {
        fullPoem,
        sourceLanguage,
        targetLanguage,
      },
      mode
    );
    console.timeEnd(`[TIMING][line=${lineIndex}] recipe`);
    recipeCache = extractRecipeCacheInfo(recipes);
  } catch (recipeError: unknown) {
    const message =
      recipeError instanceof Error ? recipeError.message : String(recipeError);

    // If recipe generation contention, throw retryable error
    if (message.includes("RECIPE_GENERATION_CONTENTION")) {
      const error = new Error("Recipe generation in progress. Please retry.");
      // Mark as retryable for error handling
      Object.assign(error, { retryable: true });
      throw error;
    }

    console.error("[translateLineWithRecipesInternal] Recipe error:", message);
    throw new Error(`Failed to generate recipes: ${message}`);
  }

  // Build translator personality
  const personality = buildTranslatorPersonality(guideAnswers);

  // Build context string
  const contextParts: string[] = [];
  const translationZone = guideAnswers.translationZone?.trim();
  const translationIntent = guideAnswers.translationIntent?.trim();

  if (translationZone) {
    contextParts.push(`Translation Zone: ${translationZone}`);
  }
  if (translationIntent) {
    contextParts.push(`Translation Intent: ${translationIntent}`);
  }

  const contextStr = contextParts.length > 0 ? contextParts.join("\n") : "";

  // Build recipe-aware prismatic prompt
  const { system: systemPrompt, user: userPrompt } =
    buildRecipeAwarePrismaticPrompt({
      sourceText: lineText,
      recipes,
      personality,
      context: contextStr,
    });

  const auditMask = maskPrompts(systemPrompt, userPrompt);

  // Generate initial variants
  const model =
    modelOverride ?? guideAnswers.translationModel ?? TRANSLATOR_MODEL;
  let completion;

  // GPT-5 models don't support custom temperature - only default (1) is allowed
  const isGpt5 = model.startsWith("gpt-5");

  const requestId = trackCallStart("main-gen", {
    lineIndex,
    stanzaIndex,
    threadId,
  });
  const mainGenStart = Date.now();

  try {
    console.time(`[TIMING][line=${lineIndex}] main-gen`);
    completion = isGpt5
      ? await openai.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        })
      : await openai.chat.completions.create({
          model,
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
    console.timeEnd(`[TIMING][line=${lineIndex}] main-gen`);

    trackCallEnd(requestId, {
      status: "ok",
      latencyMs: Date.now() - mainGenStart,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model,
      temperature: isGpt5 ? undefined : 0.7,
    });
  } catch (error: unknown) {
    const errorObj = error as {
      name?: string;
      status?: number;
      message?: string;
    };
    trackCallEnd(requestId, {
      status: "error",
      latencyMs: Date.now() - mainGenStart,
      errorName: errorObj.name,
      httpStatus: errorObj.status,
      errorMessageShort: errorObj.message?.slice(0, 100),
      model,
      temperature: isGpt5 ? undefined : 0.7,
    });
    console.error("[translateLineWithRecipesInternal] OpenAI error:", error);
    throw new Error("Translation service error");
  }

  const text = completion.choices[0]?.message?.content ?? "{}";

  // Audit initial generation (if audit fields provided)
  if (auditUserId !== undefined) {
    insertPromptAudit({
      createdBy: auditUserId,
      projectId: auditProjectId ?? null,
      threadId,
      stage: "workshop-translate-line-recipes",
      provider: "openai",
      model,
      params: {
        lineIndex,
        lineLength: lineText.length,
        method: "p6-p8-recipes",
      },
      promptSystemMasked: auditMask.promptSystemMasked,
      promptUserMasked: auditMask.promptUserMasked,
      responseExcerpt: text.slice(0, 400),
    }).catch(() => undefined);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseError) {
    console.error(
      "[translateLineWithRecipesInternal] Parse error:",
      parseError
    );
    throw new Error("Failed to parse translation response");
  }

  // Extract variants and Phase 1 fields
  // BACKWARD COMPATIBILITY: Accept both `text` (v2) and `translation` (v1) field names.
  // Phase 1 fields (anchors, anchor_realizations, self-report metadata) are optional.
  const responseObj = parsed as {
    anchors?: Anchor[];
    variants?: Array<{
      label?: string;
      text?: string;
      translation?: string;
      anchor_realizations?: Record<string, string>;
      b_image_shift_summary?: string;
      c_world_shift_summary?: string;
      c_subject_form_used?: string;
    }>;
  };
  const rawVariants = responseObj.variants || [];
  const anchors = responseObj.anchors;

  if (rawVariants.length < 3) {
    console.error(
      "[translateLineWithRecipesInternal] Insufficient variants:",
      rawVariants.length
    );
    throw new Error("Translation service returned incomplete results");
  }

  // Prepare variants for validation
  // BACKWARD COMPATIBILITY: Prefer `text` (v2) over `translation` (v1) field.
  const variants: Array<
    TranslationVariant & {
      anchor_realizations?: Record<string, string>;
      b_image_shift_summary?: string;
      c_world_shift_summary?: string;
      c_subject_form_used?: string;
    }
  > = rawVariants.slice(0, 3).map((v, i) => ({
    label: (v.label || ["A", "B", "C"][i]) as "A" | "B" | "C",
    text: v.text ?? v.translation ?? "",
    anchor_realizations: v.anchor_realizations,
    b_image_shift_summary: v.b_image_shift_summary,
    c_world_shift_summary: v.c_world_shift_summary,
    c_subject_form_used: v.c_subject_form_used,
  }));

  // ========================================================================
  // PHASE 1 VALIDATION: Anchors + Self-Report Metadata
  // ========================================================================
  // This gate runs BEFORE the existing diversity gate to enforce mechanical
  // constraints on archetypes. If Phase 1 fails, we regenerate the target
  // variant deterministically.

  let phase1FailureReason: string | null = null;
  let phase1WorstIndex: number | null = null;

  // Only run Phase 1 validation if anchors are present (backward compatible)
  if (anchors && anchors.length > 0) {
    // 1) Validate anchors array
    const anchorsCheck = validateAnchors(anchors);
    if (!anchorsCheck.valid) {
      phase1FailureReason = `anchors_invalid: ${anchorsCheck.reason}`;
      // Prefer regenerating C (most likely to have anchor issues), then B, then A
      phase1WorstIndex = 2;

      if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_PHASE1 === "1") {
        console.log("[DEBUG_PHASE1][anchors.invalid]", {
          reason: anchorsCheck.reason,
          invalidAnchorIds: anchorsCheck.invalidAnchorIds,
        });
      }
    }

    // 2) Validate anchor realizations for each variant
    if (!phase1FailureReason) {
      const anchorIds = anchors.map((a) => a.id);

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const realizationsCheck = validateAnchorRealizations(
          variant.text,
          variant.anchor_realizations,
          anchorIds,
          targetLanguage
        );

        if (!realizationsCheck.valid) {
          phase1FailureReason = `anchors_missing_realization: ${realizationsCheck.reason}`;
          phase1WorstIndex = i;

          if (
            process.env.DEBUG_GATE === "1" ||
            process.env.DEBUG_PHASE1 === "1"
          ) {
            console.log("[DEBUG_PHASE1][realizations.invalid]", {
              variantIndex: i,
              variantLabel: variant.label,
              reason: realizationsCheck.reason,
            });
          }

          break; // Stop at first failure
        }
      }
    }

    // 3) Validate self-report metadata for B and C
    if (!phase1FailureReason) {
      const recipeC = recipes.recipes.find((r) => r.label === "C");
      const stancePlanSubjectForm = recipeC?.stance_plan?.subject_form;
      const anchorIds = anchors.map((a) => a.id);

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const label = variant.label;

        const metadataCheck = validateSelfReportMetadata(
          variant,
          label,
          anchorIds,
          mode,
          stancePlanSubjectForm
        );

        if (!metadataCheck.valid) {
          phase1FailureReason = `self_report_invalid: ${metadataCheck.reason}`;
          phase1WorstIndex = metadataCheck.invalidVariants?.[0] ?? i;

          if (
            process.env.DEBUG_GATE === "1" ||
            process.env.DEBUG_PHASE1 === "1"
          ) {
            console.log("[DEBUG_PHASE1][self_report.invalid]", {
              variantIndex: i,
              variantLabel: label,
              reason: metadataCheck.reason,
            });
          }

          break; // Stop at first failure
        }
      }
    }

    // If Phase 1 failed, log and prepare for regeneration
    if (phase1FailureReason && phase1WorstIndex !== null) {
      console.log(
        `[translateLineWithRecipesInternal] Phase 1 validation failed: ${phase1FailureReason}, will regenerate variant ${phase1WorstIndex}`
      );
    } else if (
      process.env.DEBUG_GATE === "1" ||
      process.env.DEBUG_PHASE1 === "1"
    ) {
      console.log("[DEBUG_PHASE1][pass]", {
        anchorsCount: anchors.length,
        anchorIds: anchors.map((a) => a.id),
        mode,
      });
    }
  }

  // ========================================================================
  // PHASE 2: Initial validation results
  // ========================================================================
  // Run distinctness gate (mode-scaled) - Phase 2
  // Only run if Phase 1 passed (to avoid double regeneration)
  console.time(`[TIMING][line=${lineIndex}] gate`);
  const initialGateResult = phase1FailureReason
    ? { pass: false, worstIndex: phase1WorstIndex, reason: phase1FailureReason }
    : checkDistinctness(variants, {
        mode,
        targetLanguage,
        sourceText: lineText,
      });
  console.timeEnd(`[TIMING][line=${lineIndex}] gate`);

  // Build initial state object
  const initial: {
    variants: typeof variants;
    phase1Result: Phase1Result | undefined;
    gateResult: typeof initialGateResult;
  } = {
    variants: [...variants], // Copy to avoid mutation issues
    phase1Result: phase1FailureReason
      ? {
          pass: false,
          failed: [phase1FailureReason.split(":")[0]],
          reason: phase1FailureReason,
        }
      : anchors && anchors.length > 0
      ? { pass: true }
      : undefined,
    gateResult: initialGateResult,
  };

  // ========================================================================
  // PHASE 3: Regeneration (if needed)
  // ========================================================================
  // Regenerate at most one variant if needed (Phase 3: Multi-sample salvage)
  // Track regen metrics for audit
  let actualRegenPerformed = false;
  let actualRegenStrategy: "single" | "salvage" | undefined;
  let actualRegenSampleCount: number | undefined;
  let actualRegenHardPassCount: number | undefined;
  let actualRegenWorstIndex: number | undefined;
  let actualRegenVariantLabel: "A" | "B" | "C" | undefined;

  // Post-regen state (only set if regen happens)
  let postRegen: {
    variants: typeof variants;
    gateResult: ReturnType<typeof checkDistinctness>;
  } | null = null;

  if (!initial.gateResult.pass && initial.gateResult.worstIndex !== null) {
    const idx = initial.gateResult.worstIndex;
    const label = variants[idx]?.label;
    const recipeForLabel = recipes.recipes.find((r) => r.label === label);
    const originalText = variants[idx]?.text;

    if (label && recipeForLabel && anchors) {
      try {
        // Build fixed variants array (other two variants that passed)
        const fixedVariants = variants
          .filter((_, i) => i !== idx)
          .map((v) => ({
            label: v.label,
            text: v.text,
          }));

        // Get stance plan subject form for C validation
        const recipeC = recipes.recipes.find((r) => r.label === "C");
        const stancePlanSubjectForm = recipeC?.stance_plan?.subject_form;

        // Call multi-sample salvage with K=6 for balanced/adventurous, K=1 for focused
        console.time(`[TIMING][line=${lineIndex}] regen`);
        const regenResult = await regenerateVariantWithSalvage(
          idx,
          fixedVariants,
          recipeForLabel,
          recipes,
          {
            lineText,
            sourceLanguage,
            targetLanguage,
            mode,
            prevLine,
            nextLine,
            stancePlanSubjectForm,
          },
          anchors,
          initial.gateResult.reason || "distinctness_check_failed",
          model // Pass user's selected model
        );
        console.timeEnd(`[TIMING][line=${lineIndex}] regen`);

        // Capture regen metrics
        actualRegenPerformed = true;
        actualRegenStrategy = mode === "focused" ? "single" : "salvage";
        actualRegenSampleCount = regenResult.candidatesGenerated;
        actualRegenHardPassCount = regenResult.candidatesValid;
        actualRegenWorstIndex = idx;
        actualRegenVariantLabel = label;

        // Update variant with regenerated result
        variants[idx] = {
          label,
          text: regenResult.text,
          anchor_realizations: regenResult.anchor_realizations,
          b_image_shift_summary: regenResult.b_image_shift_summary,
          c_world_shift_summary: regenResult.c_world_shift_summary,
          c_subject_form_used: regenResult.c_subject_form_used,
        };

        // Debug: check if regen returned the same text
        const regenChangedText = regenResult.text !== originalText;

        // Re-check distinctness after regeneration (best-effort)
        // This becomes the final gate result if regen happened
        const recheckResult = checkDistinctness(variants, {
          mode,
          targetLanguage,
          sourceText: lineText,
        });

        // Store post-regen state
        postRegen = {
          variants: [...variants], // Copy to avoid mutation issues
          gateResult: recheckResult,
        };

        if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_REGEN === "1") {
          console.log("[DEBUG_GATE][workshop.recheck]", {
            regenIndex: idx,
            regenChangedText,
            candidatesGenerated: regenResult.candidatesGenerated,
            candidatesValid: regenResult.candidatesValid,
            selectedReason: regenResult.selectedReason,
            recheckPass: recheckResult.pass,
            recheckReason: recheckResult.reason,
            recheckMaxOverlap: recheckResult.details?.maxOverlap,
          });
        }

        if (!recheckResult.pass) {
          console.warn(
            `[translateLineWithRecipesInternal] Recheck after regen still failed: ${recheckResult.reason}`
          );
          // Continue anyway - best-effort, no extra regen loop
        }
      } catch (regenError) {
        console.error(
          `[translateLineWithRecipesInternal] Regeneration failed for ${label}:`,
          regenError
        );
        // Keep original variant if regeneration fails
      }
    } else if (!anchors) {
      console.warn(
        `[translateLineWithRecipesInternal] Cannot regenerate without anchors (backward compatibility mode)`
      );
      // Skip regeneration if no anchors (backward compatibility)
    }
  }

  // ========================================================================
  // PHASE 3.5: Finalize results - single source of truth
  // ========================================================================
  // At this point, variants are finalized (after main-gen, gate, and regen if needed).
  // We can now write the text to DB immediately and enqueue alignment for background processing.

  // Define final results - ONLY use these for DB write, audit, and ready decision
  // Note: Phase 1 doesn't change after regen (only gate changes), so always use initial
  const finalVariants = postRegen?.variants ?? initial.variants;
  const finalGateResult = postRegen?.gateResult ?? initial.gateResult;
  const finalPhase1Result = initial.phase1Result; // Phase 1 doesn't change after regen

  // Compute quality tier based on FINAL results
  // pass: phase1 pass AND final gate pass
  // salvage: phase1 pass BUT final gate failed (even after regen)
  // failed: phase1 failed hard (and no regen possible, or regen failed)
  let qualityTier: "pass" | "salvage" | "failed";
  if (finalPhase1Result?.pass) {
    // Phase 1 passed
    if (finalGateResult.pass) {
      qualityTier = "pass"; // All checks passed
    } else {
      qualityTier = "salvage"; // Phase 1 passed but gate failed (even after regen)
    }
  } else {
    // Phase 1 failed
    qualityTier = "failed"; // Hard failure
  }

  // Build quality metadata using FINAL results only
  const qualityMetadata: LineQualityMetadata = {
    phase1Pass: finalPhase1Result?.pass ?? false,
    phase1FailureReason: finalPhase1Result?.reason,
    gatePass: finalGateResult.pass,
    gateReason: finalGateResult.reason || undefined,
    regenPerformed: actualRegenPerformed,
    regenStrategy: actualRegenStrategy,
    quality_tier: qualityTier,
  };

  // Alignment is optional for Method 2 (only needed if drag-and-drop UI is used)
  // For now, we skip alignment for Method 2 to reduce latency
  // If alignment is needed in the future, uncomment this:
  // enqueueAlignmentJob({
  //   threadId,
  //   lineIndex,
  //   stanzaIndex: stanzaIndex ?? 0,
  //   lineText,
  //   variantTexts: finalVariants.map((v) => v.text),
  //   sourceLanguage,
  //   targetLanguage,
  // }).catch((error) => {
  //   console.error(
  //     `[translateLineWithRecipesInternal] Failed to enqueue alignment for line ${lineIndex}:`,
  //     error
  //   );
  //   // Non-fatal - alignment can be retried later
  // });

  // Create empty alignments for now (will be filled by background worker)
  const alignments: AlignedWord[][] = [[], [], []];

  // ========================================================================
  // PHASE 4: AUDIT LOGGING + DEBUG OUTPUT
  // ========================================================================

  // Create audit base
  const audit = makeLineAuditBase({
    threadId,
    lineIndex,
    stanzaIndex,
    mode,
    model,
    recipeCache: recipeCache || {
      cacheHit: "miss",
      schemaVersion: "v5",
    },
  });

  // Attach Phase 1 metrics - use FINAL result only
  if (finalPhase1Result) {
    attachPhase1Metrics(audit, finalPhase1Result);
  }

  // Attach gate metrics - use FINAL result only (fixes the bug!)
  attachGateMetrics(audit, finalGateResult);

  // Attach regen metrics (if regeneration was performed)
  // Use FINAL gate result reason (after recheck if regen happened)
  if (actualRegenPerformed) {
    const regenInfo: RegenInfo = {
      performed: true,
      worstIndex: actualRegenWorstIndex,
      variantLabel: actualRegenVariantLabel,
      reason: finalGateResult.reason, // Use FINAL result, not initial
      strategy: actualRegenStrategy,
      sampleCount: actualRegenSampleCount,
      hardPassCount: actualRegenHardPassCount,
    };
    attachRegenMetrics(audit, regenInfo);
  }

  // Log audit (if DEBUG_AUDIT=1)
  if (process.env.DEBUG_AUDIT === "1") {
    console.log("[AUDIT]", auditToLogLine(audit));
  }

  // Persist audit (if PERSIST_METHOD2_AUDIT=1)
  if (process.env.PERSIST_METHOD2_AUDIT === "1") {
    pushAuditToThreadState(threadId, audit, 50).catch((err) => {
      console.warn(
        "[translateLineWithRecipesInternal] Failed to persist audit:",
        err
      );
    });
  }

  // Build final response (matching LineTranslationResponse structure)
  // Note: words arrays are empty - alignment will be added by background worker
  // Use FINAL variants (after regen if it happened)
  const result: TranslateLineWithRecipesResponse = {
    lineOriginal: lineText,
    translations: [
      {
        variant: 1,
        fullText: finalVariants[0]?.text || "",
        words: alignments[0] || [], // Empty - will be filled by alignment worker
        metadata: {
          literalness: 0.8, // Recipe A typically more literal
          characterCount: finalVariants[0]?.text.length || 0,
        },
      },
      {
        variant: 2,
        fullText: finalVariants[1]?.text || "",
        words: alignments[1] || [], // Empty - will be filled by alignment worker
        metadata: {
          literalness: 0.5, // Recipe B typically balanced
          characterCount: finalVariants[1]?.text.length || 0,
        },
      },
      {
        variant: 3,
        fullText: finalVariants[2]?.text || "",
        words: alignments[2] || [], // Empty - will be filled by alignment worker
        metadata: {
          literalness: 0.2, // Recipe C typically more creative
          characterCount: finalVariants[2]?.text.length || 0,
        },
      },
    ],
    modelUsed: model,
    qualityMetadata, // Include quality metadata in response (uses FINAL results)
  };

  return result;
}
