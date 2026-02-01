/**
 * Rhyme & Sound Analysis Library
 *
 * Exports utilities for analyzing and suggesting rhyme, sound patterns,
 * and rhythm in poetry translations.
 */

export {
  fetchRhymes,
  fetchRhymesForWords,
  fetchRhymesForLineEndings,
  getRhymeSound,
  doWordsRhyme,
  findRhymePairs,
  clearRhymeCache,
} from "./rhymeService";

export {
  countWordSyllables,
  countSyllables,
  getStressPattern,
  getSimpleStressPattern,
  detectAlliteration,
  detectAssonance,
  detectConsonance,
  analyzeLineSound,
  compareRhythm,
  extractLineEnding,
  extractLineEndings,
  type AlliterationMatch,
  type AssonanceMatch,
  type ConsonanceMatch,
  type LineAnalysis,
} from "./soundAnalysis";
