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
import { buildSamplingParams } from "@/lib/ai/buildSamplingParams";
import {
  chatCompletionsWithRetry,
  getCompletionTokenCount,
} from "@/lib/ai/chatCompletionsWithRetry";
import { getTokenLimitParam } from "@/lib/ai/tokenLimitParam";
import { TRANSLATOR_MODEL } from "@/lib/models";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import {
  getOrCreateVariantRecipes,
  type TranslationRangeMode,
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
import { checkFidelity } from "@/lib/ai/fidelityGate";
import {
  computeAnchorRealizations,
  compareRealizations,
} from "./computeAnchorRealizations";
import {
  detectSubjectForm,
  normalizeSubjectForm,
} from "./detectSubjectForm";
import type { AlignedWord } from "@/lib/ai/alignmentGenerator";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";
import { enqueueAlignmentJob } from "@/lib/workshop/alignmentQueue";
import type { LineQualityMetadata } from "@/types/translationJob";
import { trackCallStart, trackCallEnd } from "@/lib/ai/openaiInstrumentation";
import {
  shouldUseStrictSchema,
  shouldFallbackToJsonObject,
  isSchemaUnsupportedError,
  MAIN_GEN_JSON_SCHEMA,
} from "./mainGenSchema";

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

  // Determine translation range mode
  const mode: TranslationRangeMode =
    guideAnswers.translationRangeMode ?? "balanced";

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

  // ISS-010: Prompt size instrumentation
  if (process.env.DEBUG_PROMPT_SIZES === "1") {
    const systemChars = systemPrompt.length;
    const userChars = userPrompt.length;
    const totalChars = systemChars + userChars;
    const estimatedTokens = Math.ceil(totalChars / 4);
    
    // Try to extract recipe block size (rough estimate)
    const recipeBlockMatch = userPrompt.match(/VARIANT RECIPES[^]*?(?=SOURCE LINE|TASK|$)/);
    const recipeBlockChars = recipeBlockMatch ? recipeBlockMatch[0].length : 0;
    
    console.log(`[PROMPT_SIZE]`, JSON.stringify({
      lineIndex,
      systemChars,
      userChars,
      recipeBlockChars,
      totalChars,
      estimatedTokens,
      timestamp: Date.now(),
    }));
  }

  const auditMask = maskPrompts(systemPrompt, userPrompt);

  // Generate initial variants
  const model =
    modelOverride ?? guideAnswers.translationModel ?? TRANSLATOR_MODEL;
  let completion;

  // GPT-5 models don't support custom temperature - only default (1) is allowed
  const isGpt5 = model.startsWith("gpt-5");

  // ISS-001: Output token cap for main-gen
  const mainGenMaxOutputTokens = Math.min(
    Math.max(300, Number(process.env.MAIN_GEN_MAX_OUTPUT_TOKENS) || 4000),
    5000
  );

  const requestId = trackCallStart("main-gen", {
    lineIndex,
    stanzaIndex,
    threadId,
  });
  const mainGenStart = Date.now();

  // ISS-009: Strict JSON schema support with fallback
  const useStrictSchema = shouldUseStrictSchema(model);
  let strictSchemaAttempted = false;
  let strictSchemaSucceeded = false;
  let fallbackUsed = false;

  // ISS-013: Parse callback for stop sequence fallback
  const parseCallback = (text: string) => {
    return JSON.parse(text);
  };

  try {
    console.time(`[TIMING][line=${lineIndex}] main-gen`);
    
    // ISS-009: Attempt strict schema if enabled and model supports it
    if (useStrictSchema) {
      strictSchemaAttempted = true;
      
      if (process.env.DEBUG_SCHEMA === "1") {
        console.log(`[MAIN_GEN][SCHEMA] Attempting strict JSON schema for model=${model}`);
      }
      
      try {
        // ISS-012: Use safe sampling params with retry-on-unsupported-param
        completion = await chatCompletionsWithRetry(
          openai,
          {
            model,
            ...buildSamplingParams(model, { temperature: 0.7 }),
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "main_gen_response",
                strict: true,
                schema: MAIN_GEN_JSON_SCHEMA,
              },
            },
            ...getTokenLimitParam(model, mainGenMaxOutputTokens),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          },
          parseCallback // ISS-013: Pass parse callback for fallback retry
        );
        
        // ISS-012: Log completion token count for instrumentation
        if (process.env.DEBUG_SAMPLING === "1") {
          const tokenCount = getCompletionTokenCount(completion);
          if (tokenCount !== null) {
            console.log(
              `[sampling] model=${model} completion_tokens=${tokenCount} (strict schema)`
            );
          }
        }
        
        strictSchemaSucceeded = true;
        
        if (process.env.DEBUG_SCHEMA === "1") {
          console.log(`[MAIN_GEN][SCHEMA] Strict schema succeeded for model=${model}`);
        }
      } catch (schemaError: unknown) {
        // ISS-009: Check if error indicates schema is unsupported
        if (isSchemaUnsupportedError(schemaError) && shouldFallbackToJsonObject()) {
          fallbackUsed = true;
          
          console.warn(`[MAIN_GEN][SCHEMA] Strict schema unsupported, falling back to json_object`, {
            model,
            error: schemaError instanceof Error ? schemaError.message : String(schemaError),
          });
          
          // Fallback to json_object
          // ISS-012: Use safe sampling params with retry-on-unsupported-param
          // ISS-017: Pass instrumentation for OpenAI call tracking
          // ISS-018: Pass metadata for raw output logging
          completion = await chatCompletionsWithRetry(
            openai,
            {
              model,
              ...buildSamplingParams(model, { temperature: 0.7 }),
              response_format: { type: "json_object" },
              ...getTokenLimitParam(model, mainGenMaxOutputTokens),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            },
            parseCallback, // ISS-013: Pass parse callback for fallback retry
            undefined, // ISS-017: Pass instrumentation (not available in this context)
            "mainGen", // ISS-017: Call kind
            { threadId, lineIndex, stanzaIndex } // ISS-018: Metadata for logging
          );
          
          // ISS-012: Log completion token count for instrumentation
          if (process.env.DEBUG_SAMPLING === "1") {
            const tokenCount = getCompletionTokenCount(completion);
            if (tokenCount !== null) {
              console.log(
                `[sampling] model=${model} completion_tokens=${tokenCount} (json_object fallback)`
              );
            }
          }
        } else {
          // Schema error but not unsupported, or fallback disabled - rethrow
          throw schemaError;
        }
      }
    } else {
      // Strict schema not enabled or model not allowlisted - use json_object
      // ISS-012: Use safe sampling params with retry-on-unsupported-param
      // ISS-017: Pass instrumentation for OpenAI call tracking
      // ISS-018: Pass metadata for raw output logging
      completion = await chatCompletionsWithRetry(
        openai,
        {
          model,
          ...buildSamplingParams(model, { temperature: 0.7 }),
          response_format: { type: "json_object" },
          ...getTokenLimitParam(model, mainGenMaxOutputTokens),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        parseCallback, // ISS-013: Pass parse callback for fallback retry
        undefined, // ISS-017: Pass instrumentation (not available in this context)
        "mainGen", // ISS-017: Call kind
        { threadId, lineIndex, stanzaIndex } // ISS-018: Metadata for logging
      );
      
      // ISS-012: Log completion token count for instrumentation
      if (process.env.DEBUG_SAMPLING === "1") {
        const tokenCount = getCompletionTokenCount(completion);
        if (tokenCount !== null) {
          console.log(
            `[sampling] model=${model} completion_tokens=${tokenCount} (json_object)`
          );
        }
      }
    }
    
    console.timeEnd(`[TIMING][line=${lineIndex}] main-gen`);

    // ISS-001: Safety logging for main-gen
    const completionTokens = completion.usage?.completion_tokens;
    const finishReason = completion.choices[0]?.finish_reason;
    const likelyCapped =
      finishReason === "length" ||
      (completionTokens !== undefined &&
        completionTokens >= mainGenMaxOutputTokens * 0.98);

    // ISS-009: Log schema usage
    console.log(`[MAIN_GEN]`, JSON.stringify({
      model,
      cap: mainGenMaxOutputTokens,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completionTokens ?? null,
      totalTokens: completion.usage?.total_tokens ?? null,
      latencyMs: Date.now() - mainGenStart,
      finishReason: finishReason ?? null,
      likelyCapped,
      strictSchemaAttempted,
      strictSchemaSucceeded,
      fallbackUsed,
    }));

    trackCallEnd(requestId, {
      status: "ok",
      latencyMs: Date.now() - mainGenStart,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model,
      temperature: isGpt5 ? undefined : 0.7,
      maxTokens: mainGenMaxOutputTokens,
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

  // Structured logging: Main-gen stage
  const mainGenLatencyMs = Date.now() - mainGenStart;
  const completionTokensForLog = completion.usage?.completion_tokens ?? 0;
  if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_TRANSLATION_STAGES === "1") {
    console.log("[TRANSLATION_STAGES][main_gen]", JSON.stringify({
      stage: "main_gen",
      lineIndex,
      latencyMs: mainGenLatencyMs,
      completionTokens: completionTokensForLog,
      model,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    }));
  }

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
    // ISS-001: Parse failure handling with detailed logging
    const completionTokens = completion.usage?.completion_tokens;
    const finishReason = completion.choices[0]?.finish_reason;
    const errorMessage =
      parseError instanceof Error ? parseError.message : String(parseError);
    const textPreview = text.length > 400
      ? `${text.slice(0, 200)}...${text.slice(-200)}`
      : text;

    console.error(`[MAIN_GEN][PARSE_FAIL]`, JSON.stringify({
      error: errorMessage,
      model,
      cap: mainGenMaxOutputTokens,
      completionTokens: completionTokens ?? null,
      finishReason: finishReason ?? null,
      textLength: text.length,
      textPreview: process.env.DEBUG_OAI_RAW_OUTPUT === "1" ? text : textPreview,
    }));

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
  > = rawVariants.slice(0, 3).map((v, i) => {
    const label = (v.label || ["A", "B", "C"][i]) as "A" | "B" | "C";
    const text = v.text ?? v.translation ?? "";
    
    // ISS-014: Compute c_subject_form_used locally from Variant C text
    let cSubjectFormUsed: string | undefined = v.c_subject_form_used;
    if (label === "C") {
      const detected = detectSubjectForm(text);
      const normalized = normalizeSubjectForm(detected);
      
      // ISS-014: Prefer local computation over model-provided value
      if (normalized) {
        cSubjectFormUsed = normalized;
        
        // ISS-014: Debug logging
        if (process.env.DEBUG_SUBJECT_FORM === "1") {
          const modelProvided = v.c_subject_form_used;
          console.log(`[SUBJECT_FORM]`, JSON.stringify({
            lineIndex,
            variantLabel: label,
            computed: normalized,
            modelProvided: modelProvided || null,
            textSnippet: text.slice(0, 80),
            match: modelProvided === normalized,
          }));
        }
      } else if (v.c_subject_form_used) {
        // Fallback: use model-provided if local detection failed
        cSubjectFormUsed = v.c_subject_form_used;
        
        if (process.env.DEBUG_SUBJECT_FORM === "1") {
          console.warn(`[SUBJECT_FORM]`, JSON.stringify({
            lineIndex,
            variantLabel: label,
            computed: null,
            modelProvided: v.c_subject_form_used,
            textSnippet: text.slice(0, 80),
            warning: "local_detection_failed_using_model_value",
          }));
        }
      }
    }
    
    return {
      label,
      text,
      anchor_realizations: v.anchor_realizations,
      b_image_shift_summary: v.b_image_shift_summary,
      c_world_shift_summary: v.c_world_shift_summary,
      c_subject_form_used: cSubjectFormUsed,
    };
  });

  // ========================================================================
  // TRANSLATION-ONLY GUARDRAILS (fastest checks first)
  // ========================================================================
  // Reject meta-commentary, labels, explanations, multi-line output
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const text = variant.text.trim();
    
    // Reject if starts with variant label
    if (/^(variant\s+[abc]:|variant\s+[abc]\s*[:\-])/i.test(text)) {
      throw new Error(`Variant ${variant.label} contains label prefix: "${text.slice(0, 50)}"`);
    }
    
    // Reject if contains AI meta-commentary
    if (/as\s+an\s+ai|i'm\s+an\s+ai|i\s+am\s+an\s+ai/i.test(text)) {
      throw new Error(`Variant ${variant.label} contains AI meta-commentary: "${text.slice(0, 50)}"`);
    }
    
    // Reject if contains multiple newlines (except legitimate poetry line breaks)
    const newlineCount = (text.match(/\n/g) || []).length;
    if (newlineCount > 2) {
      throw new Error(`Variant ${variant.label} contains too many newlines: ${newlineCount}`);
    }
    
    // Reject if text is excessively long (>3× source length, reasonable cap)
    const maxLength = Math.max(lineText.length * 3, 500);
    if (text.length > maxLength) {
      throw new Error(`Variant ${variant.label} exceeds maximum length: ${text.length} chars (max: ${maxLength})`);
    }
  }

  // ========================================================================
  // FIDELITY GATE: Meaning Preservation (cheap, per-variant checks)
  // ========================================================================
  const fidelityGateStartTime = Date.now();
  const fidelityResult = checkFidelity(lineText, variants);
  const fidelityGateLatencyMs = Date.now() - fidelityGateStartTime;
  
  // Structured logging: Fidelity Gate
  if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_TRANSLATION_STAGES === "1") {
    console.log("[TRANSLATION_STAGES][fidelity_gate]", JSON.stringify({
      stage: "fidelity_gate",
      lineIndex,
      latencyMs: fidelityGateLatencyMs,
      pass: fidelityResult.pass,
      reason: fidelityResult.reason || null,
      worstIndex: fidelityResult.worstIndex ?? null,
      checks: fidelityResult.checks,
    }));
  }
  
  if (!fidelityResult.pass) {
    // Log fidelity failure
    console.log(
      `[translateLineWithRecipesInternal] Fidelity Gate failed: ${fidelityResult.reason}`
    );
    
    // For now, log but don't block (can enable blocking later)
    // In Phase 3, this will trigger regeneration
    if (process.env.FIDELITY_GATE_BLOCKING === "1") {
      // Return early with failure (will trigger regen downstream)
      // This is placeholder for Phase 3 implementation
    }
  }

  // ========================================================================
  // PHASE 1 VALIDATION: Anchors + Self-Report Metadata (skipped if no anchors)
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
      const useLocalRealizations = process.env.ENABLE_LOCAL_ANCHOR_REALIZATIONS === "1";

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        
        // ISS-011: Compute local realizations for comparison/debugging
        const localRealizations = computeAnchorRealizations(
          variant.text,
          anchors,
          targetLanguage
        );
        
        // ISS-011: Dual-mode comparison logging
        if (process.env.DEBUG_ANCHOR_REALIZATIONS === "1") {
          const comparison = compareRealizations(
            variant.anchor_realizations,
            localRealizations,
            anchors
          );
          
          console.log(`[ANCHOR_REALIZATIONS][comparison]`, JSON.stringify({
            lineIndex,
            variantIndex: i,
            variantLabel: variant.label,
            anchorCount: comparison.anchorCount,
            modelCount: comparison.modelCount,
            localCount: comparison.localCount,
            matches: comparison.matches,
            mismatches: comparison.mismatches.length,
            modelStopwordOnly: comparison.modelStopwordOnly,
            localStopwordOnly: comparison.localStopwordOnly,
            timestamp: Date.now(),
          }));
          
          // Log detailed mismatches if debug enabled
          if (comparison.mismatches.length > 0 && process.env.DEBUG_ANCHOR_VALIDATION === "1") {
            console.log(`[ANCHOR_REALIZATIONS][mismatches]`, JSON.stringify({
              lineIndex,
              variantIndex: i,
              mismatches: comparison.mismatches,
            }));
          }
        }
        
        // ISS-011: Use local realizations if flag is enabled, else use model-provided
        const realizationsToValidate = useLocalRealizations
          ? localRealizations
          : variant.anchor_realizations;
        
        const realizationsCheck = validateAnchorRealizations(
          variant.text,
          realizationsToValidate,
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
              usedLocal: useLocalRealizations,
            });
          }

          break; // Stop at first failure
        }
        
        // ISS-011: If using local realizations, update variant with computed realizations
        if (useLocalRealizations) {
          variant.anchor_realizations = localRealizations;
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
        anchorsCount: anchors?.length ?? 0,
        anchorIds: anchors?.map((a) => a.id) ?? [],
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

    if (label && recipeForLabel) {
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
        // ✅ D) Escape hatch: Enforce max regen time (60-90s) and max rounds (1-2)
        console.time(`[TIMING][line=${lineIndex}] regen`);
        const regenStartTime = Date.now();
        const maxRegenTimeMs = Number(process.env.MAX_REGEN_TIME_MS) || 75000; // Default 75s
        const maxRegenRounds = Number(process.env.MAX_REGEN_ROUNDS) || 1; // Default 1 round
        
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
          anchors || [],
          initial.gateResult.reason || "distinctness_check_failed",
          model, // Pass user's selected model
          {
            maxTimeMs: maxRegenTimeMs,
            regenAttemptNumber: 1,
            maxRegenRounds,
          }
        );
        const regenLatencyMs = Date.now() - regenStartTime;
        console.timeEnd(`[TIMING][line=${lineIndex}] regen`);
        
        // Structured logging: Regen
        if (process.env.DEBUG_GATE === "1" || process.env.DEBUG_TRANSLATION_STAGES === "1" || process.env.DEBUG_REGEN === "1") {
          console.log("[TRANSLATION_STAGES][regen]", JSON.stringify({
            stage: "regen",
            lineIndex,
            attemptNumber: 1,
            latencyMs: regenLatencyMs,
            reason: initial.gateResult.reason || "distinctness_check_failed",
            pass: true, // If we got here, regen succeeded
            candidatesGenerated: regenResult.candidatesGenerated ?? null,
            candidatesValid: regenResult.candidatesValid ?? null,
            variantLabel: label,
          }));
        }

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
  // salvage: phase1 failed BUT translations are usable (relaxed validation)
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
    // ✅ FIX: Don't mark as "failed" just for Phase 1 validation failures
    // Translations are still usable and valid, just didn't meet all mechanical checks
    // This prevents ~50% of lines from being incorrectly marked as failed
    qualityTier = "salvage"; // Changed from "failed" - treat as salvageable
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
