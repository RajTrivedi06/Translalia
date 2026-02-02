/**
 * Types for Conversational Notebook AI Suggestions
 *
 * These types support a step-by-step guided conversation where Translalia
 * offers to help the student with their translation at the poem level.
 *
 * The three steps are:
 * 1. Identify formal features (rhyme scheme, alliteration, repetition, etc.)
 * 2. Suggest adjustments to imitate those features
 * 3. Personalized suggestions based on student's choices and diary notes
 */

import { z } from "zod";

// ============================================================================
// Step 1: Formal Features Identification
// ============================================================================

export interface FormalFeature {
  /** Type of feature (rhyme, alliteration, repetition, etc.) */
  type: "rhyme_scheme" | "alliteration" | "repetition" | "sentence_structure" | "meter" | "assonance" | "consonance" | "anaphora" | "other";
  /** Human-readable name */
  name: string;
  /** Description of the feature found */
  description: string;
  /** Examples from the source text */
  examples: string[];
  /** Lines where this feature appears */
  lineNumbers?: number[];
}

export interface FormalFeaturesAnalysis {
  /** The rhyme scheme if detected (e.g., "ABAB", "AABB", "none") */
  rhymeScheme: string | null;
  /** Description of the rhyme scheme */
  rhymeSchemeDescription?: string;
  /** Other formal features found */
  otherFeatures: FormalFeature[];
  /** Overall summary of the poem's formal structure */
  summary: string;
}

// ============================================================================
// Step 2: Adjustment Suggestions
// ============================================================================

export interface AdjustmentSuggestion {
  /** Which feature this adjustment addresses */
  featureType: FormalFeature["type"];
  /** What line(s) to adjust */
  targetLines: number[];
  /** Current text of the line(s) */
  currentText: string;
  /** Suggested new text */
  suggestedText: string;
  /** Explanation of what changes and why */
  explanation: string;
  /** How difficult this adjustment is */
  difficulty: "easy" | "medium" | "challenging";
  /** Trade-offs or considerations */
  tradeOff?: string;
}

export interface AdjustmentSuggestionsResponse {
  /** List of suggested adjustments */
  adjustments: AdjustmentSuggestion[];
  /** General guidance for imitating the source's formal features */
  generalGuidance: string;
  /** Whether perfect imitation is possible/advisable */
  imitationFeasibility: "full" | "partial" | "not_recommended";
  /** Explanation of why certain features may be hard to imitate */
  feasibilityExplanation?: string;
}

// ============================================================================
// Step 3: Personalized Suggestions
// ============================================================================

export interface PersonalizedInsight {
  /** What the AI noticed about the student's approach */
  observation: string;
  /** What seems to interest the student */
  interests: string[];
  /** What the student seems to be trying to achieve */
  aims: string[];
}

export interface PersonalizedSuggestion {
  /** Title of the suggestion */
  title: string;
  /** Detailed description */
  description: string;
  /** Why this might be interesting for this student */
  rationale: string;
  /** Specific lines or areas to focus on */
  focusArea?: string;
  /** How to implement this suggestion */
  howTo?: string;
}

export interface PersonalizedSuggestionsResponse {
  /** The AI's analysis of the student's approach */
  insight: PersonalizedInsight;
  /** Up to 3 personalized suggestions */
  suggestions: PersonalizedSuggestion[];
  /** Encouraging closing message */
  encouragement: string;
}

// ============================================================================
// Combined Types
// ============================================================================

export type SuggestionStep = "identify" | "adjust" | "personalize";

export interface NotebookSuggestionState {
  /** Current step in the conversation */
  currentStep: SuggestionStep | null;
  /** Step 1 results */
  formalFeatures: FormalFeaturesAnalysis | null;
  /** Step 2 results */
  adjustments: AdjustmentSuggestionsResponse | null;
  /** Step 3 results */
  personalized: PersonalizedSuggestionsResponse | null;
  /** Loading state for each step */
  loading: Record<SuggestionStep, boolean>;
  /** Error state for each step */
  errors: Record<SuggestionStep, string | null>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface NotebookSuggestionRequest {
  threadId: string;
  step: SuggestionStep;
  sourcePoem: string;
  translationPoem: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  /** For step 3: translation diary/notes */
  translationDiary?: string;
  /** For step 3: per-line notes */
  lineNotes?: Record<number, string>;
  /** For step 2/3: previous step results */
  formalFeatures?: FormalFeaturesAnalysis;
  /** For step 2: which lines the user wants help rhyming together */
  selectedLines?: number[];
}

export interface NotebookSuggestionResponse {
  ok: boolean;
  step: SuggestionStep;
  formalFeatures?: FormalFeaturesAnalysis;
  adjustments?: AdjustmentSuggestionsResponse;
  personalized?: PersonalizedSuggestionsResponse;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const FormalFeatureSchema = z.object({
  type: z.enum([
    "rhyme_scheme",
    "alliteration",
    "repetition",
    "sentence_structure",
    "meter",
    "assonance",
    "consonance",
    "anaphora",
    "other",
  ]),
  name: z.string().min(1),
  description: z.string().min(1),
  examples: z.array(z.string()),
  lineNumbers: z.array(z.number().int().min(0)).optional(),
});

export const FormalFeaturesAnalysisSchema = z.object({
  rhymeScheme: z.string().nullable(),
  rhymeSchemeDescription: z.string().optional(),
  otherFeatures: z.array(FormalFeatureSchema),
  summary: z.string().min(1),
});

export const AdjustmentSuggestionSchema = z.object({
  featureType: z.enum([
    "rhyme_scheme",
    "alliteration",
    "repetition",
    "sentence_structure",
    "meter",
    "assonance",
    "consonance",
    "anaphora",
    "other",
  ]),
  targetLines: z.array(z.number().int().min(0)),
  currentText: z.string(),
  suggestedText: z.string().min(1),
  explanation: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "challenging"]),
  tradeOff: z.string().optional(),
});

export const AdjustmentSuggestionsResponseSchema = z.object({
  adjustments: z.array(AdjustmentSuggestionSchema),
  generalGuidance: z.string().min(1),
  imitationFeasibility: z.enum(["full", "partial", "not_recommended"]),
  feasibilityExplanation: z.string().optional(),
});

export const PersonalizedInsightSchema = z.object({
  observation: z.string().min(1),
  interests: z.array(z.string()),
  aims: z.array(z.string()),
});

export const PersonalizedSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  focusArea: z.string().optional(),
  howTo: z.string().optional(),
});

export const PersonalizedSuggestionsResponseSchema = z.object({
  insight: PersonalizedInsightSchema,
  suggestions: z.array(PersonalizedSuggestionSchema).max(3),
  encouragement: z.string().min(1),
});

export const NotebookSuggestionRequestSchema = z.object({
  threadId: z.string().uuid(),
  step: z.enum(["identify", "adjust", "personalize"]),
  sourcePoem: z.string().min(1),
  translationPoem: z.string().min(1),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().optional(),
  translationDiary: z.string().optional(),
  lineNotes: z.record(z.string(), z.string()).optional(),
  formalFeatures: FormalFeaturesAnalysisSchema.optional(),
  selectedLines: z.array(z.number().int().min(0)).optional(),
});
