"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { GuideAnswers } from "@/store/guideSlice";
import { z } from "zod";

// Validation schemas for each answer type
// These are lenient to allow partial/in-progress answers during form filling
const TargetLanguageSchema = z.object({
  lang: z.string().optional(),
  variety: z.string().optional(),
  script: z.string().optional(),
}).passthrough();

const AudienceSchema = z.object({
  audience: z.string().optional(),
  goal: z.array(z.string()).optional(),
}).passthrough();

const StanceSchema = z.object({
  closeness: z.enum(["close", "in_between", "natural"]).optional(),
}).passthrough();

const StyleSchema = z.object({
  vibes: z.array(z.string()).optional(), // Allow empty array during typing
}).passthrough();

const TranslanguagingSchema = z.object({
  allow: z.boolean().optional(),
  scopes: z.array(z.string()).optional(),
}).passthrough();

const PolicySchema = z.object({
  must_keep: z.array(z.string()).optional(),
  no_go: z.array(z.string()).optional(),
}).passthrough();

const FormSchema = z.object({
  line_breaks: z.string().optional(),
  rhyme: z.string().optional(),
  line_length: z.string().optional(),
}).passthrough();

const StyleAnchorsSchema = z.array(z.string()).optional();

const GuideAnswersSchema = z.object({
  translationIntent: z.string().nullable().optional(),
  targetLanguage: TargetLanguageSchema.optional(),
  audience: AudienceSchema.optional(),
  stance: StanceSchema.optional(),
  style: StyleSchema.optional(),
  translanguaging: TranslanguagingSchema.optional(),
  policy: PolicySchema.optional(),
  form: FormSchema.optional(),
  style_anchors: StyleAnchorsSchema.optional(),
}).passthrough();

export type UpdateGuideStateResult =
  | { success: true }
  | { success: false; error: string };

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
): Promise<{ success: true; answers: GuideAnswers } | { success: false; error: string }> {
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
