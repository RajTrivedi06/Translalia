/**
 * Types for the Rhyme & Sound Instruction System
 *
 * This module defines types for instructive rhyme, sound pattern,
 * and rhythm suggestions that teach students HOW to achieve
 * poetic effects, not just describe them.
 */

import { z } from "zod";

// ============================================================================
// Rhyme Workshop Types
// ============================================================================

export type RhymeType = "perfect_rhyme" | "slant_rhyme" | "internal_rhyme";

export interface RewriteOption {
  /** The suggested new text for the line */
  text: string;
  /** Technique used (e.g., "End-word substitution", "Line inversion") */
  technique: string;
  /** Trade-off explanation */
  tradeOff: string;
  /** Syllable counts for comparison */
  syllables?: {
    current: number;
    suggested: number;
    source: number;
  };
}

export interface RhymeSuggestion {
  /** Type of rhyme being suggested */
  type: RhymeType;
  /** Line indices that should rhyme [line1, line2] */
  targetLines: [number, number];
  /** The target rhyme sound (e.g., "-ight") */
  targetSound: string;
  /** Instructive explanation of how to achieve the rhyme */
  instruction: string;
  /** Current text of the lines */
  currentLines: {
    line1: string;
    line2: string;
  };
  /** List of candidate rhyming words */
  candidateWords: string[];
  /** Words that are semantically relevant with reasons */
  semanticallyRelevant: Record<string, string>;
  /** Specific rewrite suggestions */
  suggestedRewrites: RewriteOption[];
  /** Overall recommendation */
  recommendation: string;
}

// ============================================================================
// Sound Pattern Types
// ============================================================================

export type SoundPatternType = "alliteration" | "assonance" | "consonance";

export interface SoundOption {
  /** The suggested text */
  text: string;
  /** Number of sound repetitions */
  soundCount: number;
  /** Explanatory note */
  note: string;
}

export interface SoundPatternSuggestion {
  /** Type of sound pattern */
  type: SoundPatternType;
  /** Line index this applies to */
  lineIndex: number;
  /** Description of the source pattern (e.g., "'sanftes Schweigen' - double 's' sound") */
  sourcePattern: string;
  /** Target sound to achieve (e.g., "s consonant", "long 'o' vowel") */
  targetSound: string;
  /** Current text of the line */
  currentText: string;
  /** Analysis of current state */
  analysis?: string;
  /** Alternative suggestions */
  options: SoundOption[];
  /** Recommended option with explanation */
  recommendation: string;
}

// ============================================================================
// Rhythm Workshop Types
// ============================================================================

export interface LineRhythmData {
  /** The text being analyzed */
  text: string;
  /** Number of syllables */
  syllables: number;
  /** Stress pattern (e.g., "da-DUM da-DUM") */
  stress: string;
}

export interface RhythmAlternative {
  /** Suggested text */
  text: string;
  /** Syllable count */
  syllables: number;
  /** Stress pattern */
  stress: string;
  /** How well it matches source */
  match: "exact" | "close" | "compressed" | "expanded";
  /** Optional explanatory note */
  note?: string;
}

export interface RhythmSuggestion {
  /** Line index this applies to */
  lineIndex: number;
  /** Analysis of source and current translation */
  analysis: {
    source: LineRhythmData;
    current: LineRhythmData;
  };
  /** Description of the rhythmic issue */
  issue: string;
  /** Alternative suggestions */
  alternatives: RhythmAlternative[];
  /** Overall recommendation */
  recommendation: string;
}

// ============================================================================
// Combined Response Type
// ============================================================================

export interface RhymeWorkshopResponse {
  /** Rhyme-related suggestions */
  rhymeWorkshop: RhymeSuggestion[];
  /** Sound pattern suggestions (alliteration, assonance, consonance) */
  soundWorkshop: SoundPatternSuggestion[];
  /** Rhythm and meter suggestions */
  rhythmWorkshop: RhythmSuggestion[];
}

// ============================================================================
// Request Types
// ============================================================================

export interface RhymeWorkshopRequest {
  threadId: string;
  lineIndex: number;
  sourceLine: string;
  currentTranslation: string;
  previousLine?: string | null;
  nextLine?: string | null;
  fullSourcePoem: string;
  fullTranslation: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** Optional: detected rhyme scheme of the source poem */
  sourceRhymeScheme?: string;
  /** Optional: lines that should rhyme with the current line */
  rhymeTargetLines?: number[];
}

// ============================================================================
// Rhyme Dictionary Types (for Datamuse API)
// ============================================================================

export interface RhymeResult {
  /** The word being looked up */
  word: string;
  /** Perfect rhymes (e.g., "night" -> ["light", "sight", "bright"]) */
  perfectRhymes: string[];
  /** Near/slant rhymes */
  nearRhymes: string[];
}

export interface RhymeDictionaryData {
  /** Rhyme results for each line-ending word */
  lineEndingRhymes: RhymeResult[];
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const RewriteOptionSchema = z.object({
  text: z.string().min(1),
  technique: z.string().min(1),
  tradeOff: z.string().min(1),
  syllables: z
    .object({
      current: z.number().int().min(0),
      suggested: z.number().int().min(0),
      source: z.number().int().min(0),
    })
    .optional(),
});

export const RhymeSuggestionSchema = z.object({
  type: z.enum(["perfect_rhyme", "slant_rhyme", "internal_rhyme"]),
  targetLines: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  targetSound: z.string().min(1),
  instruction: z.string().min(1),
  currentLines: z.object({
    line1: z.string(),
    line2: z.string(),
  }),
  candidateWords: z.array(z.string().min(1)),
  semanticallyRelevant: z.record(z.string(), z.string()),
  suggestedRewrites: z.array(RewriteOptionSchema),
  recommendation: z.string().min(1),
});

export const SoundOptionSchema = z.object({
  text: z.string().min(1),
  soundCount: z.number().int().min(0),
  note: z.string(),
});

export const SoundPatternSuggestionSchema = z.object({
  type: z.enum(["alliteration", "assonance", "consonance"]),
  lineIndex: z.number().int().min(0),
  sourcePattern: z.string().min(1),
  targetSound: z.string().min(1),
  currentText: z.string(),
  analysis: z.string().optional(),
  options: z.array(SoundOptionSchema),
  recommendation: z.string().min(1),
});

export const LineRhythmDataSchema = z.object({
  text: z.string(),
  syllables: z.number().int().min(0),
  stress: z.string(),
});

export const RhythmAlternativeSchema = z.object({
  text: z.string().min(1),
  syllables: z.number().int().min(0),
  stress: z.string(),
  match: z.enum(["exact", "close", "compressed", "expanded"]),
  note: z.string().optional(),
});

export const RhythmSuggestionSchema = z.object({
  lineIndex: z.number().int().min(0),
  analysis: z.object({
    source: LineRhythmDataSchema,
    current: LineRhythmDataSchema,
  }),
  issue: z.string().min(1),
  alternatives: z.array(RhythmAlternativeSchema),
  recommendation: z.string().min(1),
});

export const RhymeWorkshopResponseSchema = z.object({
  rhymeWorkshop: z.array(RhymeSuggestionSchema),
  soundWorkshop: z.array(SoundPatternSuggestionSchema),
  rhythmWorkshop: z.array(RhythmSuggestionSchema),
});

export const RhymeWorkshopRequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  sourceLine: z.string().min(1),
  currentTranslation: z.string().min(1),
  previousLine: z.string().optional().nullable(),
  nextLine: z.string().optional().nullable(),
  fullSourcePoem: z.string().min(1),
  fullTranslation: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  sourceRhymeScheme: z.string().optional(),
  rhymeTargetLines: z.array(z.number().int().min(0)).optional(),
});

// Type exports from schemas
export type RewriteOptionInput = z.infer<typeof RewriteOptionSchema>;
export type RhymeSuggestionInput = z.infer<typeof RhymeSuggestionSchema>;
export type SoundPatternSuggestionInput = z.infer<typeof SoundPatternSuggestionSchema>;
export type RhythmSuggestionInput = z.infer<typeof RhythmSuggestionSchema>;
export type RhymeWorkshopResponseInput = z.infer<typeof RhymeWorkshopResponseSchema>;
export type RhymeWorkshopRequestInput = z.infer<typeof RhymeWorkshopRequestSchema>;
