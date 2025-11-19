/**
 * Type definitions for line-level translation with alignment
 */

export interface AlignedWord {
  /** Original word or phrase (can be multi-word: "sat on") */
  original: string;
  /** Translation (can be multi-word: "se sentó en") */
  translation: string;
  /** Part of speech */
  partOfSpeech: string;
  /** Position in original line (0-indexed) */
  position: number;
}

export interface LineTranslationMetadata {
  /** Literalness score: 0-1 scale (1 = very literal, 0 = very creative) */
  literalness: number;
  /** Character count of the translation */
  characterCount: number;
  /** Whether the translation preserves rhyme scheme */
  preservesRhyme?: boolean;
  /** Whether the translation preserves meter/rhythm */
  preservesMeter?: boolean;
}

export interface LineTranslationVariant {
  /** Variant number: 1, 2, or 3 */
  variant: 1 | 2 | 3;
  /** Complete translated line text */
  fullText: string;
  /** Aligned words/phrases mapping original to translation */
  words: AlignedWord[];
  /** Metadata about this translation variant */
  metadata: LineTranslationMetadata;
}

export interface LineTranslationResponse {
  /** Original line text */
  lineOriginal: string;
  /** Three translation variants */
  translations: [
    LineTranslationVariant,
    LineTranslationVariant,
    LineTranslationVariant
  ];
  /** Model used for generation */
  modelUsed: string;
}
