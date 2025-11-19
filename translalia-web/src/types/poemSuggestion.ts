/**
 * Types for poem-level (macro) AI suggestions in the Notebook phase
 *
 * These suggestions help students think about the whole translation
 * after they've completed line-by-line work in the Workshop phase.
 */

export type SuggestionCategory =
  | "rhyme_strategy"
  | "tone_register"
  | "meaning_expansion"
  | "rhythm_meter"
  | "imagery_style"
  | "form_structure";

export interface PoemSuggestionOption {
  id: string;
  title: string; // e.g., "Match source rhyme scheme"
  description: string; // e.g., "Your translation uses AABB but source uses ABAB..."
  rationale: string; // Why this might be worth exploring
  action: string; // What the student should try (e.g., "Look at lines 3-4 and try ABAB rhyme")
  difficulty: "easy" | "medium" | "challenging"; // How much work this requires
}

export interface PoemSuggestion {
  id: string;
  category: SuggestionCategory;
  categoryLabel: string; // Display name (e.g., "Rhyme Strategy")
  categoryIcon?: string; // Lucide icon name
  options: PoemSuggestionOption[];
  sourceAnalysis: string; // What we noticed in the source poem
  yourTranslation: string; // What we noticed in the translation
  isApplicable: boolean; // Should we show this suggestion?
  applicabilityReason?: string; // Why it does/doesn't apply
}

export interface PoemMacroAnalysis {
  sourceText?: string;
  translationText?: string;
  rhymeScheme?: string; // e.g., "ABAB" or "none"
  rhymeType?: "perfect" | "slant" | "internal" | "none";
  hasRhyme: boolean;
  toneDescriptors?: string[]; // e.g., ["formal", "archaic", "melancholic"]
  imageryPatterns?: string[]; // e.g., ["nature", "light", "decay"]
  metricalPattern?: string; // e.g., "iambic pentameter" or "free verse"
  lineVariability?: number; // 0-1: how varied are line lengths?
  keyMetaphors?: string[]; // e.g., ["rose", "night"]
}

export interface PoetryMacroCritiqueResponse {
  sourceAnalysis: PoemMacroAnalysis;
  translationAnalysis: PoemMacroAnalysis;
  suggestions: PoemSuggestion[];
  overallObservations: string; // General thoughts about the translation
  studentPromptsToConsider: string[]; // Reflective questions
}

export interface PoemSuggestionsRequest {
  threadId: string;
  sourcePoem: string;
  translationPoem: string;
  guideAnswers?: Record<string, unknown>; // User's zone, intent, stance, etc.
}
