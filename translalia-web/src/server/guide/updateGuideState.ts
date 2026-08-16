"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { GuideAnswers } from "@/store/guideSlice";
import type { SimplePoemStanzas } from "@/lib/utils/stanzaUtils";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import type { TranslatedLine, TranslationJobState } from "@/types/translationJob";
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
      .enum([
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-5",
        "gpt-5-mini",
        "deepseek-v4-flash",
      ])
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
      // Legacy fields from JSONB first, so the resolved values below always win.
      ...(currentState.guide_answers || {}),
      translationModel: thread.translation_model ?? currentState.guide_answers?.translationModel ?? null,
      translationMethod: thread.translation_method ?? currentState.guide_answers?.translationMethod ?? "method-2",
      translationIntent: thread.translation_intent ?? currentState.guide_answers?.translationIntent ?? null,
      translationZone: thread.translation_zone ?? currentState.guide_answers?.translationZone ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? currentState.guide_answers?.sourceLanguageVariety ?? null,
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
    
    // If guide_answers exists in state JSONB, remove it atomically so the
    // legacy copy cannot be mistaken for the source of truth (the columns are).
    //
    // F-04-007: this was ineffective in three separate ways, all fixed here.
    //   1. It called a 3-arg signature that did not exist — the only
    //      patch_thread_state_field was 4-arg — so PostgREST could not resolve
    //      it. Migration 20260816_02 adds the 3-arg overload and a delete
    //      primitive.
    //   2. It passed p_value: "null", which is the JSON *string* "null", not
    //      JSON null. Moot now: removal does not take a value.
    //   3. jsonb_set SETS a key. Even had it resolved, guide_answers would
    //      have remained present holding a null. `#-`, via
    //      delete_thread_state_field, actually removes it.
    // And the error was never read: supabase.rpc() RETURNS an error object
    // rather than throwing, so the surrounding try/catch could not fire and
    // the failure was invisible for as long as it existed.
    if (currentState.guide_answers) {
      const { error: clearError } = await supabase.rpc(
        "delete_thread_state_field",
        {
          p_thread_id: threadId,
          p_path: ["guide_answers"],
        }
      );

      // Non-fatal: the columns are authoritative, so a stale JSONB copy is
      // untidy rather than incorrect. But it is logged now instead of
      // swallowed, which is how this stayed invisible.
      if (clearError) {
        console.warn(
          `[updateGuideState] Failed to clear legacy state.guide_answers for ` +
            `thread ${threadId}: ${clearError.message} (code ${clearError.code ?? "none"})`
        );
      }
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
      // Legacy fields from JSONB first, so the resolved values below always win.
      ...(currentState.guide_answers || {}),
      translationModel: thread.translation_model ?? currentState.guide_answers?.translationModel ?? null,
      translationMethod: thread.translation_method ?? currentState.guide_answers?.translationMethod ?? "method-2",
      translationIntent: thread.translation_intent ?? currentState.guide_answers?.translationIntent ?? null,
      translationZone: thread.translation_zone ?? currentState.guide_answers?.translationZone ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? currentState.guide_answers?.sourceLanguageVariety ?? null,
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

/**
 * Retrieves the full thread state needed to hydrate client stores.
 * Called from ThreadPageClient when localStorage is empty (new device, cleared cache).
 * Returns guide answers, poem data, and workshop progress.
 */
export async function getFullThreadState(
  threadId: string
): Promise<
  | {
      success: true;
      answers: GuideAnswers;
      rawPoem: string | null;
      poemStanzas: StanzaDetectionResult | null;
      workshopLines: Array<{ original: string; translated: string } | null> | null;
      chunkLineData: TranslatedLine[][] | null;
    }
  | { success: false; error: string }
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
      .select(
        "state, raw_poem, translation_model, translation_method, translation_intent, translation_zone, source_language_variety"
      )
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    const currentState = (thread.state as Record<string, unknown>) || {};

    // Build guide answers from columns (with JSONB fallback)
    const legacyAnswers = (currentState.guide_answers as Record<string, unknown>) || {};
    const answers: GuideAnswers = {
      // Legacy fields from JSONB first, so the resolved values below always win.
      ...legacyAnswers,
      translationModel: thread.translation_model ?? (legacyAnswers.translationModel as string) ?? null,
      translationMethod: (thread.translation_method ?? (legacyAnswers.translationMethod as string) ?? "method-2") as GuideAnswers["translationMethod"],
      translationIntent: thread.translation_intent ?? (legacyAnswers.translationIntent as string) ?? null,
      translationZone: thread.translation_zone ?? (legacyAnswers.translationZone as string) ?? null,
      sourceLanguageVariety: thread.source_language_variety ?? (legacyAnswers.sourceLanguageVariety as string) ?? null,
    };

    // Extract poem stanzas from JSONB state
    const poemStanzas = (currentState.poem_stanzas as StanzaDetectionResult) ?? null;

    // Extract workshop lines (completed translations)
    const workshopLines = (currentState.workshop_lines as Array<{ original: string; translated: string } | null>) ?? null;

    // Extract lean line-level variant data from completed chunks/stanzas
    const translationJob = currentState.translation_job as TranslationJobState | undefined;
    const chunkOrStanzaStates = translationJob?.chunks ?? translationJob?.stanzas ?? null;
    const chunkLineData = chunkOrStanzaStates
      ? Object.values(chunkOrStanzaStates)
          .filter(
            (
              chunk
            ): chunk is { status: string; lines: TranslatedLine[] } =>
              Boolean(chunk) &&
              typeof chunk.status === "string" &&
              Array.isArray(chunk.lines)
          )
          .filter((chunk) => chunk.status === "completed" && chunk.lines.length > 0)
          .map((chunk) => chunk.lines)
      : null;

    return {
      success: true,
      answers,
      rawPoem: thread.raw_poem ?? null,
      poemStanzas,
      workshopLines,
      chunkLineData,
    };
  } catch (error) {
    console.error("[getFullThreadState] Unexpected error:", error);
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

    // Dedicated RPC, not exec_sql.
    //
    // exec_sql takes a caller-supplied SQL string and runs it under SECURITY
    // DEFINER, which makes it an arbitrary-SQL-execution primitive for anyone
    // holding the `authenticated` grant (F-04-005). This call site was the
    // last thing keeping that grant necessary.
    //
    // The ownership check also moves server-side: the 3-arg overload derives
    // the owner from auth.uid() rather than accepting it as a parameter, so a
    // forged user id is no longer expressible (F-04-012).
    const { data: patched, error: updateError } = await supabase.rpc(
      "patch_thread_state_field",
      {
        p_thread_id: threadId,
        p_path: fieldPath,
        p_value: value ?? null,
      }
    );

    // Hard-fail when the RPC is missing rather than falling back to a
    // read-modify-write, which silently clobbered concurrent translation_job
    // writes. PostgREST reports an unresolvable function as PGRST202; Postgres
    // itself uses 42883.
    if (
      updateError?.code === "PGRST202" ||
      updateError?.code === "42883" ||
      updateError?.message?.toLowerCase().includes("could not find the function")
    ) {
      console.error(
        "[patchThreadStateField] CRITICAL: patch_thread_state_field(uuid, text[], jsonb) " +
          `not available. Apply supabase/migrations/20260816_02_patch_thread_state_field_authuid.sql. ` +
          `Path: ${fieldPath.join(".")}`
      );
      throw new Error(
        `ATOMIC_PATCH_UNAVAILABLE: the 3-arg patch_thread_state_field RPC is missing. ` +
          `It is REQUIRED to prevent state corruption. Apply migration ` +
          `20260816_02_patch_thread_state_field_authuid.sql. ` +
          `Attempted path: ${fieldPath.join(".")}`
      );
    }

    if (updateError) {
      console.error("[patchThreadStateField] Update error:", updateError);
      return { success: false, error: "Failed to patch state field" };
    }

    // The RPC returns false when no row matched — thread missing, or owned by
    // somebody else. That is a real failure and must not read as success.
    if (patched === false) {
      console.warn(
        `[patchThreadStateField] No row updated for thread ${threadId} ` +
          `(not found, or not owned by the caller). Path: ${fieldPath.join(".")}`
      );
      return { success: false, error: "Thread not found or not owned by caller" };
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
