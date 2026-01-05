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
    viewpointRangeMode: z
      .enum(["focused", "balanced", "adventurous"])
      .optional(),
    translationModel: z
      .enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-5", "gpt-5-mini"])
      .optional(),
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

    // Fetch current thread state
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("id, state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    // Merge updates with existing guide_answers
    const currentState = (thread.state as any) || {};
    const currentAnswers = (currentState.guide_answers as GuideAnswers) || {};
    const mergedAnswers: GuideAnswers = {
      ...currentAnswers,
      ...updates,
    };

    // Update the state
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...currentState,
          guide_answers: mergedAnswers,
        },
      })
      .eq("id", threadId);

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
      .select("state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    const currentState = (thread.state as any) || {};
    const answers = (currentState.guide_answers as GuideAnswers) || {};

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
      .select("id, state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !thread) {
      return { success: false, error: "Thread not found or unauthorized" };
    }

    // Convert SimplePoemStanzas to StanzaDetectionResult format
    const stanzaDetectionResult = convertToStanzaDetectionResult(stanzas);

    // Merge poem state with existing state
    const currentState = (thread.state as any) || {};
    const updatedState = {
      ...currentState,
      raw_poem: rawPoem,
      poem_stanzas: stanzaDetectionResult,
    };

    // Update the state
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: updatedState,
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

    // If RPC doesn't exist, fall back to read-modify-write with warning
    if (
      updateError?.message?.includes("function") ||
      updateError?.code === "42883"
    ) {
      console.warn(
        "[patchThreadStateField] exec_sql RPC not available, falling back to read-modify-write"
      );
      return patchThreadStateFieldFallback(
        threadId,
        fieldPath,
        value,
        supabase,
        user.id
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

/**
 * Fallback for patchThreadStateField when RPC is not available.
 * Uses read-modify-write but logs a warning.
 */
async function patchThreadStateFieldFallback(
  threadId: string,
  fieldPath: string[],
  value: unknown,
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<UpdateGuideStateResult> {
  // Fetch current state
  const { data: thread, error: fetchError } = await supabase
    .from("chat_threads")
    .select("state")
    .eq("id", threadId)
    .eq("created_by", userId)
    .single();

  if (fetchError || !thread) {
    return { success: false, error: "Thread not found or unauthorized" };
  }

  // Build nested path update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentState = (thread.state as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let target: any = currentState;

  // Navigate to parent of final key
  for (let i = 0; i < fieldPath.length - 1; i++) {
    if (!target[fieldPath[i]]) {
      target[fieldPath[i]] = {};
    }
    target = target[fieldPath[i]];
  }

  // Set the final key
  target[fieldPath[fieldPath.length - 1]] = value;

  // Write back
  const { error: updateError } = await supabase
    .from("chat_threads")
    .update({ state: currentState })
    .eq("id", threadId);

  if (updateError) {
    console.error("[patchThreadStateFieldFallback] Update error:", updateError);
    return { success: false, error: "Failed to patch state field" };
  }

  return { success: true };
}
