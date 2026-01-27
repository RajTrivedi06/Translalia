"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { GuideAnswers } from "@/store/guideSlice";
import type { SimplePoemStanzas } from "@/lib/utils/stanzaUtils";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import { z } from "zod";

// Validation schemas for each answer type
// These are lenient to allow partial/in-progress answers during form filling
const TargetLanguageSchema = z
  .object({
    lang: z.string().optional(),
    variety: z.string().optional(),
    script: z.string().optional(),
  })
  .passthrough();

const AudienceSchema = z
  .object({
    audience: z.string().optional(),
    goal: z.array(z.string()).optional(),
  })
  .passthrough();

const StanceSchema = z
  .object({
    closeness: z.enum(["close", "in_between", "natural"]).optional(),
  })
  .passthrough();

const StyleSchema = z
  .object({
    vibes: z.array(z.string()).optional(), // Allow empty array during typing
  })
  .passthrough();

const TranslanguagingSchema = z
  .object({
    allow: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
  })
  .passthrough();

const PolicySchema = z
  .object({
    must_keep: z.array(z.string()).optional(),
    no_go: z.array(z.string()).optional(),
  })
  .passthrough();

const FormSchema = z
  .object({
    line_breaks: z.string().optional(),
    rhyme: z.string().optional(),
    line_length: z.string().optional(),
  })
  .passthrough();

const StyleAnchorsSchema = z.array(z.string()).optional();

const GuideAnswersSchema = z
  .object({
    translationIntent: z.string().nullable().optional(),
    translationRangeMode: z
      .enum(["focused", "balanced", "adventurous"])
      .optional(),
    translationModel: z
      .enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-5", "gpt-5-mini"])
      .optional(),
    translationMethod: z.enum(["method-1", "method-2"]).optional(),
    targetLanguage: TargetLanguageSchema.optional(),
    audience: AudienceSchema.optional(),
    stance: StanceSchema.optional(),
    style: StyleSchema.optional(),
    translanguaging: TranslanguagingSchema.optional(),
    policy: PolicySchema.optional(),
    form: FormSchema.optional(),
    style_anchors: StyleAnchorsSchema.optional(),
  })
  .passthrough();

export type UpdateGuideStateResult =
  | { success: true }
  | { success: false; error: string };

interface SavePoemStateParams {
  threadId: string;
  rawPoem: string;
  stanzas: SimplePoemStanzas;
}

/**
 * Converts SimplePoemStanzas (client-side format) to StanzaDetectionResult (backend format)
 */
function convertToStanzaDetectionResult(
  simple: SimplePoemStanzas
): StanzaDetectionResult {
  return {
    stanzas: simple.stanzas.map((stanza) => ({
      number: stanza.number,
      text: stanza.text,
      lines: stanza.lines,
      lineCount: stanza.lines.length,
      startLineIndex: 0, // Will be calculated if needed by backend
    })),
    totalStanzas: simple.totalStanzas,
    detectionMethod: "local",
    reasoning: "Client-side 4-line stanza detection",
  };
}

/**
 * Updates the guide answers in the chat_threads.state column.
 * Merges new updates with existing guide_answers.
 */
export async function updateGuideState(
  threadId: string,
  updates: Partial<GuideAnswers>
): Promise<UpdateGuideStateResult> {
  try {
    // Validate input
    if (!threadId || typeof threadId !== "string") {
      return { success: false, error: "Invalid threadId" };
    }

    // Validate updates structure
    try {
      GuideAnswersSchema.partial().parse(updates);
    } catch (validationError) {
      console.error("[updateGuideState] Validation error:", validationError);
      return { success: false, error: "Invalid answer format" };
    }

    // Get authenticated user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthenticated" };
    }

    // Fetch current thread state and columns
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("id, state, translation_model, translation_method, translation_intent, translation_zone, source_language_variety")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    // Merge updates with existing guide_answers (from columns, with JSONB fallback for legacy)
    const currentState = (thread.state as any) || {};
    const currentAnswers: GuideAnswers = {
      translationModel: thread.translation_model ?? currentState.guide_answers?.translationModel ?? null,
      translationMethod: thread.translation_method ?? currentState.guide_answers?.translationMethod ?? "method-2",
      translationIntent: thread.translation_intent ?? currentState.guide_answers?.translationIntent ?? null,
      translationZone: thread.translation_zone ?? currentState.guide_answers?.translationZone ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? currentState.guide_answers?.sourceLanguageVariety ?? null,
      // Legacy fields from JSONB if needed
      ...(currentState.guide_answers || {}),
    };
    const mergedAnswers: GuideAnswers = {
      ...currentAnswers,
      ...updates,
      // Ensure translationMethod defaults to "method-2" if not set
      translationMethod:
        updates.translationMethod ??
        currentAnswers.translationMethod ??
        "method-2",
    };

    // ✅ LOG: State write activity (before write)
    const translationJob = currentState.translation_job;
    const jobVersion = translationJob?.version ?? "none";
    const chunks = translationJob?.chunks || {};
    const chunk0Lines = chunks[0]?.lines?.length ?? "none";
    const chunk1Lines = chunks[1]?.lines?.length ?? "none";
    const activeIndices = translationJob?.active || [];
    const queueLength = translationJob?.queue?.length ?? "none";
    const activeLength = activeIndices.length;
    const activeDisplay = activeLength > 0 ? `[${activeIndices.join(",")}]` : "[]";
    const writingVersion = translationJob?.version ?? "none";
    const prevSeenVersion = translationJob?.version ?? "none"; // Same as what we read
    
    console.log(
      `[STATE_WRITE] writer=updateGuideState threadId=${threadId} jobVersion=${jobVersion} ` +
      `chunks[0].lines=${chunk0Lines} chunks[1].lines=${chunk1Lines} ` +
      `queue.length=${queueLength} active=${activeDisplay} updating=guide_answers_columns ` +
      `versionCheck=no prevSeenVersion=${prevSeenVersion} writingVersion=${writingVersion}`
    );

    // Build update payload: ONLY write to columns, NOT to JSONB
    // This prevents clobbering recipe cache and other state fields like variant_recipes_v3
    const updatePayload: Record<string, unknown> = {
      translation_model: mergedAnswers.translationModel ?? null,
      translation_method: mergedAnswers.translationMethod ?? null,
      translation_intent: mergedAnswers.translationIntent ?? null,
      translation_zone: mergedAnswers.translationZone ?? null,
      source_language_variety: mergedAnswers.sourceLanguageVariety ?? null,
      // NOTE: Do NOT update the state JSONB here - this was clobbering recipe cache
      // Only remove guide_answers from state if it exists using atomic jsonb patch
    };

    // Update columns only (not full JSONB state)
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update(updatePayload)
      .eq("id", threadId);
    
    // If guide_answers exists in state JSONB, remove it atomically to prevent legacy issues
    if (currentState.guide_answers) {
      // Use jsonb_set to remove guide_answers without clobbering other state fields
      await supabase.rpc("patch_thread_state_field", {
        p_thread_id: threadId,
        p_path: "{guide_answers}",
        p_value: "null",
      }).catch(() => {
        // Silently ignore if RPC doesn't exist - columns are the source of truth now
      });
    }

    if (updateError) {
      console.error("[updateGuideState] Update error:", updateError);
      return { success: false, error: "Failed to update state" };
    }

    return { success: true };
  } catch (error) {
    console.error("[updateGuideState] Unexpected error:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Retrieves the current guide answers from a thread.
 */
export async function getGuideState(
  threadId: string
): Promise<
  { success: true; answers: GuideAnswers } | { success: false; error: string }
> {
  try {
    if (!threadId || typeof threadId !== "string") {
      return { success: false, error: "Invalid threadId" };
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthenticated" };
    }

    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("state, translation_model, translation_method, translation_intent, translation_zone, source_language_variety")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    // Read from columns (with JSONB fallback for legacy data)
    const currentState = (thread.state as any) || {};
    const answers: GuideAnswers = {
      translationModel: thread.translation_model ?? currentState.guide_answers?.translationModel ?? null,
      translationMethod: thread.translation_method ?? currentState.guide_answers?.translationMethod ?? "method-2",
      translationIntent: thread.translation_intent ?? currentState.guide_answers?.translationIntent ?? null,
      translationZone: thread.translation_zone ?? currentState.guide_answers?.translationZone ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? currentState.guide_answers?.sourceLanguageVariety ?? null,
      // Legacy fields from JSONB if needed
      ...(currentState.guide_answers || {}),
    };

    return { success: true, answers };
  } catch (error) {
    console.error("[getGuideState] Unexpected error:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Saves the raw poem and detected stanzas to thread state.
 * This is called before initializing the translation job to ensure
 * the backend can access the stanzas.
 */
export async function savePoemState({
  threadId,
  rawPoem,
  stanzas,
}: SavePoemStateParams): Promise<UpdateGuideStateResult> {
  try {
    if (!threadId || typeof threadId !== "string") {
      return { success: false, error: "Invalid threadId" };
    }

    if (!rawPoem || typeof rawPoem !== "string") {
      return { success: false, error: "Invalid poem text" };
    }

    if (!stanzas || !Array.isArray(stanzas.stanzas)) {
      return { success: false, error: "Invalid stanzas data" };
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthenticated" };
    }

    // Fetch current thread state
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("id, state, raw_poem")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    // Convert SimplePoemStanzas to StanzaDetectionResult format
    const stanzaDetectionResult = convertToStanzaDetectionResult(stanzas);

    // Merge poem state with existing state (keep poem_stanzas in JSONB, but raw_poem goes to column)
    const currentState = (thread.state as any) || {};
    const updatedState = {
      ...currentState,
      // Remove raw_poem from JSONB (it's now in column)
      poem_stanzas: stanzaDetectionResult,
    };

    // ✅ LOG: State write activity (before write)
    const translationJob = currentState.translation_job;
    const jobVersion = translationJob?.version ?? "none";
    const chunks = translationJob?.chunks || {};
    const chunk0Lines = chunks[0]?.lines?.length ?? "none";
    const chunk1Lines = chunks[1]?.lines?.length ?? "none";
    const activeIndices = translationJob?.active || [];
    const queueLength = translationJob?.queue?.length ?? "none";
    const activeLength = activeIndices.length;
    const activeDisplay = activeLength > 0 ? `[${activeIndices.join(",")}]` : "[]";
    const writingVersion = translationJob?.version ?? "none";
    const prevSeenVersion = translationJob?.version ?? "none"; // Same as what we read
    
    console.log(
      `[STATE_WRITE] writer=savePoemState threadId=${threadId} jobVersion=${jobVersion} ` +
      `chunks[0].lines=${chunk0Lines} chunks[1].lines=${chunk1Lines} ` +
      `queue.length=${queueLength} active=${activeDisplay} updating=raw_poem,poem_stanzas ` +
      `versionCheck=no prevSeenVersion=${prevSeenVersion} writingVersion=${writingVersion}`
    );

    // Update both column and state (raw_poem in column, poem_stanzas in JSONB)
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        raw_poem: rawPoem, // Write to column
        state: updatedState, // Keep poem_stanzas in JSONB, but raw_poem removed
      })
      .eq("id", threadId);

    if (updateError) {
      console.error("[savePoemState] Update error:", updateError);
      return { success: false, error: "Failed to update poem state" };
    }

    return { success: true };
  } catch (error) {
    console.error("[savePoemState] Unexpected error:", error);
    return { success: false, error: "Internal server error" };
  }
}

// =============================================================================
// JSONB Patch-Safe Updates
// =============================================================================

/**
 * Patch a single field in chat_threads.state using PostgreSQL jsonb_set.
 * This is atomic and doesn't overwrite other concurrent state changes.
 *
 * CRITICAL: Use this for variant_recipes_v1 updates to avoid lost updates.
 *
 * @param threadId - The thread to update
 * @param fieldPath - Path in the JSON (e.g., ['variant_recipes_v1'])
 * @param value - The value to set
 */
export async function patchThreadStateField(
  threadId: string,
  fieldPath: string[],
  value: unknown
): Promise<UpdateGuideStateResult> {
  try {
    if (!threadId || typeof threadId !== "string") {
      return { success: false, error: "Invalid threadId" };
    }

    if (!fieldPath || fieldPath.length === 0) {
      return { success: false, error: "Invalid field path" };
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthenticated" };
    }

    // Convert field path to PostgreSQL format: ['variant_recipes_v1'] -> '{variant_recipes_v1}'
    const pathStr = `{${fieldPath.join(",")}}`;
    const valueJson = JSON.stringify(value);

    // Use raw SQL with jsonb_set for atomic patch (no read-modify-write)
    // COALESCE handles null state gracefully
    const { error: updateError } = await supabase.rpc("exec_sql", {
      query: `
        UPDATE chat_threads
        SET state = jsonb_set(COALESCE(state, '{}'::jsonb), $1::text[], $2::jsonb)
        WHERE id = $3::uuid AND created_by = $4::uuid
      `,
      params: [pathStr, valueJson, threadId, user.id],
    });

    // ✅ PRIORITY 0 FIX: Hard-fail when RPC isn't available
    // The fallback was silently clobbering translation_job state during concurrent writes.
    // We now FAIL FAST instead of silently corrupting data.
    if (
      updateError?.message?.includes("function") ||
      updateError?.code === "42883"
    ) {
      const errorMsg =
        "[patchThreadStateField] CRITICAL: exec_sql RPC not available. " +
        "This would cause state clobber. Create the RPC function in Supabase or use direct jsonb_set. " +
        `Path: ${fieldPath.join(".")}`;
      console.error(errorMsg);

      // In production, fail hard to prevent data corruption
      // In development, also fail but with more context
      throw new Error(
        `ATOMIC_PATCH_UNAVAILABLE: The exec_sql RPC function is not available in your Supabase project. ` +
        `This is REQUIRED to prevent state corruption. ` +
        `Please create the RPC function or use the Supabase migration provided. ` +
        `Attempted path: ${fieldPath.join(".")}`
      );
    }

    if (updateError) {
      console.error("[patchThreadStateField] Update error:", updateError);
      return { success: false, error: "Failed to patch state field" };
    }

    return { success: true };
  } catch (error) {
    console.error("[patchThreadStateField] Unexpected error:", error);
    return { success: false, error: "Internal server error" };
  }
}

// =============================================================================
// NOTE: The dangerous patchThreadStateFieldFallback has been REMOVED.
// It was causing state clobber by doing read-modify-write without version checks.
// The exec_sql RPC function is now REQUIRED. See:
//   supabase/migrations/20240117_add_exec_sql_rpc.sql
// =============================================================================
