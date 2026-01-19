/**
 * Phase 4: Synthetic Personality Mapping (Optional)
 *
 * Derives small style knobs from translationIntent/Zone to reduce "generic AI poet" drift.
 * Injects derived persona into prompts without requiring UI changes.
 * Optionally stores persona in thread state for debugging (if PERSIST_SYNTHETIC_PERSONA=1).
 */

import type { GuideAnswers } from "@/store/guideSlice";
import type { TranslationRangeMode } from "./variantRecipes";

// =============================================================================
// Types
// =============================================================================

export interface SyntheticPersonality {
  vocabulary: "plain" | "street" | "elevated" | "regional";
  sentenceLength: "short" | "varied" | "long";
  rhythmDensity: "low" | "medium" | "high";
  intimacy: "low" | "medium" | "high";
  slangTolerance: "low" | "medium" | "high";
  imageryDensity: "low" | "medium" | "high";
  notes: string[]; // short bullet notes
}

// =============================================================================
// Mapping Logic
// =============================================================================

/**
 * Derive synthetic personality from guide answers and mode.
 * Uses rule-based mapping with keyword detection in translationIntent and Zone.
 */
export function deriveSyntheticPersonality(
  guideAnswers: GuideAnswers,
  mode: TranslationRangeMode
): SyntheticPersonality {
  const intent = (guideAnswers.translationIntent || "").toLowerCase();
  const zone = (guideAnswers.translationZone || "").toLowerCase();
  const style = (guideAnswers.style?.vibes || []).map((v) => v.toLowerCase()).join(" ");

  // Initialize defaults
  let vocabulary: SyntheticPersonality["vocabulary"] = "plain";
  let sentenceLength: SyntheticPersonality["sentenceLength"] = "varied";
  let rhythmDensity: SyntheticPersonality["rhythmDensity"] = "medium";
  let intimacy: SyntheticPersonality["intimacy"] = "medium";
  let slangTolerance: SyntheticPersonality["slangTolerance"] = "medium";
  let imageryDensity: SyntheticPersonality["imageryDensity"] = "medium";
  const notes: string[] = [];

  // =============================================================================
  // Intent-based mapping
  // =============================================================================

  // Colloquial / Conversational / Street
  if (
    /colloquial|conversational|street|casual|everyday|spoken/.test(intent) ||
    /colloquial|conversational|street|casual/.test(style)
  ) {
    vocabulary = "street";
    slangTolerance = "high";
    sentenceLength = "varied";
    intimacy = "high";
    notes.push("Colloquial/conversational tone detected");
  }

  // Minimal / Clear / Plain-language
  if (/minimal|clear|plain|simple|direct|straightforward/.test(intent)) {
    vocabulary = "plain";
    sentenceLength = "short";
    imageryDensity = "medium"; // Not zero - keep some poetic quality
    rhythmDensity = "low";
    notes.push("Minimal/plain-language approach");
  }

  // Lyrical / Poetic / Elevated
  if (
    /lyrical|poetic|elevated|literary|refined|artistic/.test(intent) ||
    /lyrical|poetic|elevated/.test(style)
  ) {
    vocabulary = "elevated";
    rhythmDensity = "high";
    imageryDensity = "high";
    sentenceLength = "long";
    notes.push("Lyrical/elevated register");
  }

  // Regional / Local
  if (/regional|local|dialect|vernacular/.test(intent) || /regional/.test(zone)) {
    vocabulary = "regional";
    slangTolerance = "high";
    notes.push("Regional/vernacular flavor");
  }

  // =============================================================================
  // Zone-based overrides
  // =============================================================================

  // Plain American English / Standard English
  if (/plain american|standard english|general american/.test(zone)) {
    vocabulary = "plain";
    slangTolerance = "low";
    notes.push("Zone: Plain/standard English override");
  }

  // Regional varieties
  if (
    /scottish|irish|australian|south african|caribbean|appalachian|southern/.test(zone)
  ) {
    vocabulary = "regional";
    slangTolerance = "high";
    notes.push("Zone: Regional variety detected");
  }

  // British English (slightly elevated default)
  if (/british english|uk english/.test(zone)) {
    if (vocabulary === "plain") {
      vocabulary = "elevated"; // British default leans slightly more formal
    }
    notes.push("Zone: British English detected");
  }

  // =============================================================================
  // Mode-based adjustments
  // =============================================================================

  if (mode === "adventurous") {
    // Allow more creativity
    if (imageryDensity === "medium") imageryDensity = "high";
    if (sentenceLength === "short") sentenceLength = "varied";
    notes.push("Adventurous mode: increased imagery/variation");
  } else if (mode === "focused") {
    // Reduce drift, keep tighter
    if (imageryDensity === "high") imageryDensity = "medium";
    if (slangTolerance === "high") slangTolerance = "medium";
    notes.push("Focused mode: reduced drift");
  }

  // =============================================================================
  // Audience adjustments
  // =============================================================================

  const audience = (guideAnswers.audience?.audience || "").toLowerCase();
  if (/young adult|teen|children/.test(audience)) {
    if (vocabulary === "elevated") vocabulary = "plain";
    sentenceLength = "short";
    slangTolerance = "high";
    notes.push("Audience: Younger readers, simplified");
  }

  if (/academic|scholarly|literary critics/.test(audience)) {
    vocabulary = "elevated";
    rhythmDensity = "high";
    imageryDensity = "high";
    notes.push("Audience: Academic/scholarly, elevated");
  }

  return {
    vocabulary,
    sentenceLength,
    rhythmDensity,
    intimacy,
    slangTolerance,
    imageryDensity,
    notes,
  };
}

// =============================================================================
// Prompt Injection
// =============================================================================

/**
 * Format synthetic personality as prompt injection block (concise)
 */
export function formatPersonalityForPrompt(persona: SyntheticPersonality): string {
  return `
STYLE KNOBS (derived from intent/zone):
- Vocabulary: ${persona.vocabulary}
- Sentence length: ${persona.sentenceLength}
- Rhythm density: ${persona.rhythmDensity}
- Intimacy: ${persona.intimacy}
- Slang tolerance: ${persona.slangTolerance}
- Imagery density: ${persona.imageryDensity}
${persona.notes.length > 0 ? `Notes: ${persona.notes.join("; ")}` : ""}
`.trim();
}

// =============================================================================
// Optional Persistence (if PERSIST_SYNTHETIC_PERSONA=1)
// =============================================================================

/**
 * Store synthetic personality in thread state for debugging.
 * Only persists if PERSIST_SYNTHETIC_PERSONA=1 environment variable is set.
 */
export async function persistSyntheticPersonality(
  threadId: string,
  persona: SyntheticPersonality
): Promise<void> {
  // Only persist if explicitly enabled
  if (process.env.PERSIST_SYNTHETIC_PERSONA !== "1") {
    return;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { supabaseServer } = await import("@/lib/supabaseServer");
    const supabase = await supabaseServer();

    // Fetch current state
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("state")
      .eq("id", threadId)
      .single();

    if (fetchError || !thread) {
      console.warn(
        `[persistSyntheticPersonality] Failed to fetch thread ${threadId}`
      );
      return;
    }

    const state = (thread.state as Record<string, unknown>) || {};

    // Update state with persona
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...state,
          synthetic_personality: persona,
        },
      })
      .eq("id", threadId);

    if (updateError) {
      console.warn(
        `[persistSyntheticPersonality] Failed to update thread ${threadId}:`,
        updateError
      );
    }
  } catch (error) {
    console.warn("[persistSyntheticPersonality] Error:", error);
  }
}
