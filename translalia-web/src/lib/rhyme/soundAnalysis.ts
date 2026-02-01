/**
 * Sound Analysis - Syllable counting and pattern detection
 *
 * Provides utilities for analyzing the sonic qualities of text:
 * - Syllable counting
 * - Stress pattern detection
 * - Alliteration detection
 * - Assonance detection
 * - Consonance detection
 */

// ============================================================================
// Types
// ============================================================================

export interface AlliterationMatch {
  /** The repeated consonant sound */
  consonant: string;
  /** Words that share this sound */
  words: string[];
  /** Positions of words in the line */
  positions: number[];
}

export interface AssonanceMatch {
  /** The repeated vowel sound */
  vowel: string;
  /** Words that share this sound */
  words: string[];
  /** Positions of words in the line */
  positions: number[];
}

export interface ConsonanceMatch {
  /** The repeated consonant (at word endings) */
  consonant: string;
  /** Words that share this ending consonant */
  words: string[];
  /** Positions of words in the line */
  positions: number[];
}

export interface LineAnalysis {
  text: string;
  syllableCount: number;
  stressPattern: string;
  alliteration: AlliterationMatch[];
  assonance: AssonanceMatch[];
  consonance: ConsonanceMatch[];
}

// ============================================================================
// Syllable Counting
// ============================================================================

/**
 * Count syllables in a word using heuristics
 *
 * This is a simplified English syllable counter. For production,
 * consider using the 'syllable' npm package for better accuracy.
 */
export function countWordSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized.length === 0) return 0;
  if (normalized.length <= 2) return 1;

  // Special cases
  const silentE = /[aeiou][^aeiou]e$/;
  const doubleVowels = /[aeiou]{2,}/g;

  let syllables = 0;

  // Count vowel groups
  const vowelGroups = normalized.match(/[aeiouy]+/g) || [];
  syllables = vowelGroups.length;

  // Subtract for silent e at the end (unless it's the only vowel)
  if (silentE.test(normalized) && syllables > 1) {
    syllables--;
  }

  // Subtract for common double vowels that are single sounds
  const doubleMatches = normalized.match(doubleVowels) || [];
  for (const match of doubleMatches) {
    // These double vowels are typically one syllable
    if (
      ["ai", "au", "ay", "ea", "ee", "ei", "ey", "ie", "oa", "oo", "ou", "ow", "oy", "ue", "ui"].includes(
        match
      )
    ) {
      syllables--;
    }
  }

  // Add for -le endings (table, apple)
  if (/[^aeiou]le$/.test(normalized)) {
    syllables++;
  }

  // Subtract for -ed endings that don't add a syllable
  if (/[^td]ed$/.test(normalized)) {
    syllables--;
  }

  // Minimum of 1 syllable
  return Math.max(1, syllables);
}

/**
 * Count total syllables in a line of text
 */
export function countSyllables(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.reduce((total, word) => total + countWordSyllables(word), 0);
}

// ============================================================================
// Stress Pattern Detection
// ============================================================================

/**
 * Simple rules for determining if a word is likely stressed
 * This is a heuristic - accurate stress requires a pronunciation dictionary
 */
function isStressedWord(word: string): boolean {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");

  // Unstressed function words
  const unstressedWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "of",
    "to",
    "in",
    "on",
    "at",
    "by",
    "for",
    "with",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "am",
    "has",
    "have",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "can",
    "may",
    "might",
    "must",
    "it",
    "its",
    "he",
    "she",
    "they",
    "we",
    "you",
    "i",
    "my",
    "your",
    "his",
    "her",
    "their",
    "our",
    "this",
    "that",
    "these",
    "those",
    "which",
    "who",
    "whom",
    "what",
    "when",
    "where",
    "how",
    "why",
    "if",
    "so",
    "than",
    "then",
  ]);

  return !unstressedWords.has(lower) && lower.length > 0;
}

/**
 * Get stress pattern for a line of text
 * Returns pattern like "da-DUM da-DUM" (da = unstressed, DUM = stressed)
 */
export function getStressPattern(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);

  const pattern = words
    .map((word) => {
      const syllables = countWordSyllables(word);
      const stressed = isStressedWord(word);

      if (syllables === 1) {
        return stressed ? "DUM" : "da";
      }

      // For multi-syllable words, create alternating pattern
      // (this is a simplification - real stress patterns vary)
      const parts: string[] = [];
      for (let i = 0; i < syllables; i++) {
        // First syllable stressed for most English words
        parts.push(i === 0 && stressed ? "DUM" : "da");
      }
      return parts.join("-");
    })
    .join(" ");

  return pattern;
}

/**
 * Get a simplified stress pattern notation
 * Returns pattern like "/ x / x" (/ = stressed, x = unstressed)
 */
export function getSimpleStressPattern(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);

  return words
    .map((word) => {
      const stressed = isStressedWord(word);
      return stressed ? "/" : "x";
    })
    .join(" ");
}

// ============================================================================
// Alliteration Detection
// ============================================================================

/**
 * Detect alliteration (repeated initial consonant sounds) in text
 */
export function detectAlliteration(text: string): AlliterationMatch[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const consonantGroups = new Map<string, { words: string[]; positions: number[] }>();

  // Consonant clusters that create alliteration
  const consonantPatterns = [
    /^(sh|ch|th|wh|ph|sch|str|spr|scr|spl|squ|thr|chr)/i,
    /^([bcdfghjklmnpqrstvwxyz])/i,
  ];

  words.forEach((word, index) => {
    const cleaned = word.replace(/[^a-z]/gi, "").toLowerCase();
    if (!cleaned) return;

    // Check if word starts with a vowel (no alliteration for vowels in this context)
    if (/^[aeiou]/i.test(cleaned)) return;

    let consonant = "";
    for (const pattern of consonantPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        consonant = match[1].toLowerCase();
        break;
      }
    }

    if (consonant) {
      if (!consonantGroups.has(consonant)) {
        consonantGroups.set(consonant, { words: [], positions: [] });
      }
      const group = consonantGroups.get(consonant)!;
      group.words.push(word);
      group.positions.push(index);
    }
  });

  // Only return groups with 2+ words (actual alliteration)
  const results: AlliterationMatch[] = [];
  for (const [consonant, group] of consonantGroups) {
    if (group.words.length >= 2) {
      results.push({
        consonant,
        words: group.words,
        positions: group.positions,
      });
    }
  }

  return results;
}

// ============================================================================
// Assonance Detection
// ============================================================================

/**
 * Get the primary vowel sound from a word
 */
function getPrimaryVowelSound(word: string): string | null {
  const cleaned = word.replace(/[^a-z]/gi, "").toLowerCase();

  // Common vowel sound patterns (ordered by specificity)
  const vowelPatterns = [
    { pattern: /oo/, sound: "oo" },
    { pattern: /ee/, sound: "ee" },
    { pattern: /ea/, sound: "ee" },
    { pattern: /ai/, sound: "ay" },
    { pattern: /ay/, sound: "ay" },
    { pattern: /ei/, sound: "ay" },
    { pattern: /ey/, sound: "ay" },
    { pattern: /oa/, sound: "oh" },
    { pattern: /ow/, sound: "oh" },
    { pattern: /ou/, sound: "ow" },
    { pattern: /oi/, sound: "oy" },
    { pattern: /oy/, sound: "oy" },
    { pattern: /au/, sound: "aw" },
    { pattern: /aw/, sound: "aw" },
    { pattern: /ie/, sound: "ee" },
    { pattern: /[aeiou]/, sound: null }, // Will extract single vowel
  ];

  for (const { pattern, sound } of vowelPatterns) {
    if (pattern.test(cleaned)) {
      if (sound) return sound;
      // Extract single vowel
      const match = cleaned.match(/[aeiou]/);
      return match ? match[0] : null;
    }
  }

  return null;
}

/**
 * Detect assonance (repeated vowel sounds) in text
 */
export function detectAssonance(text: string): AssonanceMatch[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const vowelGroups = new Map<string, { words: string[]; positions: number[] }>();

  words.forEach((word, index) => {
    const vowelSound = getPrimaryVowelSound(word);
    if (!vowelSound) return;

    if (!vowelGroups.has(vowelSound)) {
      vowelGroups.set(vowelSound, { words: [], positions: [] });
    }
    const group = vowelGroups.get(vowelSound)!;
    group.words.push(word);
    group.positions.push(index);
  });

  // Only return groups with 2+ words
  const results: AssonanceMatch[] = [];
  for (const [vowel, group] of vowelGroups) {
    if (group.words.length >= 2) {
      results.push({
        vowel,
        words: group.words,
        positions: group.positions,
      });
    }
  }

  return results;
}

// ============================================================================
// Consonance Detection
// ============================================================================

/**
 * Get the ending consonant sound from a word
 */
function getEndingConsonant(word: string): string | null {
  const cleaned = word.replace(/[^a-z]/gi, "").toLowerCase();
  if (!cleaned) return null;

  // Check for ending consonant clusters
  const clusters = [
    /(?:ng|nk|nt|nd|mp|mb|sk|sp|st|ft|pt|ct|ck|sh|ch|th|ph)$/,
    /([bcdfghjklmnpqrstvwxz])$/,
  ];

  for (const pattern of clusters) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * Detect consonance (repeated ending consonant sounds) in text
 */
export function detectConsonance(text: string): ConsonanceMatch[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const consonantGroups = new Map<string, { words: string[]; positions: number[] }>();

  words.forEach((word, index) => {
    const consonant = getEndingConsonant(word);
    if (!consonant) return;

    if (!consonantGroups.has(consonant)) {
      consonantGroups.set(consonant, { words: [], positions: [] });
    }
    const group = consonantGroups.get(consonant)!;
    group.words.push(word);
    group.positions.push(index);
  });

  // Only return groups with 2+ words
  const results: ConsonanceMatch[] = [];
  for (const [consonant, group] of consonantGroups) {
    if (group.words.length >= 2) {
      results.push({
        consonant,
        words: group.words,
        positions: group.positions,
      });
    }
  }

  return results;
}

// ============================================================================
// Complete Line Analysis
// ============================================================================

/**
 * Perform complete sound analysis on a line of text
 */
export function analyzeLineSound(text: string): LineAnalysis {
  return {
    text,
    syllableCount: countSyllables(text),
    stressPattern: getStressPattern(text),
    alliteration: detectAlliteration(text),
    assonance: detectAssonance(text),
    consonance: detectConsonance(text),
  };
}

/**
 * Compare two lines for rhythmic similarity
 */
export function compareRhythm(
  line1: string,
  line2: string
): {
  syllableDiff: number;
  line1Syllables: number;
  line2Syllables: number;
  rhythmMatch: "exact" | "close" | "different";
} {
  const s1 = countSyllables(line1);
  const s2 = countSyllables(line2);
  const diff = Math.abs(s1 - s2);

  let rhythmMatch: "exact" | "close" | "different";
  if (diff === 0) {
    rhythmMatch = "exact";
  } else if (diff <= 2) {
    rhythmMatch = "close";
  } else {
    rhythmMatch = "different";
  }

  return {
    syllableDiff: diff,
    line1Syllables: s1,
    line2Syllables: s2,
    rhythmMatch,
  };
}

/**
 * Extract the last word from a line (for rhyme analysis)
 */
export function extractLineEnding(line: string): string {
  const words = line.trim().split(/\s+/);
  const lastWord = words[words.length - 1] || "";
  return lastWord.replace(/[.,!?;:'"]+$/, "").toLowerCase();
}

/**
 * Extract line endings from multiple lines
 */
export function extractLineEndings(lines: string[]): string[] {
  return lines.map(extractLineEnding);
}
