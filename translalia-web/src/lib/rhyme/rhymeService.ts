/**
 * Rhyme Service - Datamuse API integration with caching
 *
 * Provides rhyme lookups using the Datamuse API:
 * - Perfect rhymes (rel_rhy)
 * - Near/slant rhymes (rel_nry)
 * - Approximate rhymes (rel_nry with scoring)
 *
 * Includes in-memory caching to avoid repeated API calls.
 */

import type { RhymeResult, RhymeDictionaryData } from "@/types/rhymeWorkshop";

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 1000;

interface CacheEntry {
  data: RhymeResult;
  timestamp: number;
}

const rhymeCache = new Map<string, CacheEntry>();

function getCacheKey(word: string): string {
  return word.toLowerCase().trim();
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

function pruneCache(): void {
  if (rhymeCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries
    const entries = Array.from(rhymeCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE / 2);
    for (const [key] of toRemove) {
      rhymeCache.delete(key);
    }
  }
}

// ============================================================================
// Datamuse API
// ============================================================================

const DATAMUSE_BASE_URL = "https://api.datamuse.com/words";

interface DatamuseWord {
  word: string;
  score: number;
  numSyllables?: number;
}

/**
 * Fetch perfect rhymes for a word from Datamuse API
 */
async function fetchPerfectRhymes(
  word: string,
  maxResults: number = 10
): Promise<string[]> {
  try {
    const url = `${DATAMUSE_BASE_URL}?rel_rhy=${encodeURIComponent(word)}&max=${maxResults}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache for 1 hour in Next.js
    });

    if (!response.ok) {
      console.warn(`[rhymeService] Datamuse API error: ${response.status}`);
      return [];
    }

    const data: DatamuseWord[] = await response.json();
    return data.map((item) => item.word);
  } catch (error) {
    console.error("[rhymeService] Failed to fetch perfect rhymes:", error);
    return [];
  }
}

/**
 * Fetch near/slant rhymes for a word from Datamuse API
 */
async function fetchNearRhymes(
  word: string,
  maxResults: number = 10
): Promise<string[]> {
  try {
    const url = `${DATAMUSE_BASE_URL}?rel_nry=${encodeURIComponent(word)}&max=${maxResults}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(`[rhymeService] Datamuse API error: ${response.status}`);
      return [];
    }

    const data: DatamuseWord[] = await response.json();
    return data.map((item) => item.word);
  } catch (error) {
    console.error("[rhymeService] Failed to fetch near rhymes:", error);
    return [];
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch rhymes for a single word (with caching)
 */
export async function fetchRhymes(word: string): Promise<RhymeResult> {
  const cacheKey = getCacheKey(word);

  // Check cache first
  const cached = rhymeCache.get(cacheKey);
  if (cached && !isExpired(cached)) {
    return cached.data;
  }

  // Fetch from API (parallel requests)
  const [perfectRhymes, nearRhymes] = await Promise.all([
    fetchPerfectRhymes(word),
    fetchNearRhymes(word),
  ]);

  const result: RhymeResult = {
    word: word.toLowerCase().trim(),
    perfectRhymes,
    nearRhymes,
  };

  // Store in cache
  rhymeCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  pruneCache();

  return result;
}

/**
 * Fetch rhymes for multiple words in parallel
 */
export async function fetchRhymesForWords(
  words: string[]
): Promise<RhymeResult[]> {
  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase().trim()))];
  return Promise.all(uniqueWords.map(fetchRhymes));
}

/**
 * Extract the last word from each line and fetch rhymes for them
 */
export async function fetchRhymesForLineEndings(
  lines: string[]
): Promise<RhymeDictionaryData> {
  const lineEndings = lines.map((line) => {
    const words = line.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || "";
    // Remove punctuation from the end
    return lastWord.replace(/[.,!?;:'"]+$/, "").toLowerCase();
  });

  const lineEndingRhymes = await fetchRhymesForWords(lineEndings);

  return { lineEndingRhymes };
}

/**
 * Get rhyme sound/ending for a word
 * Extracts common rhyme patterns like "-ight", "-tion", "-ness"
 */
export function getRhymeSound(word: string): string {
  const normalized = word.toLowerCase().trim().replace(/[.,!?;:'"]+$/, "");

  // Common rhyme endings (ordered by specificity)
  const patterns = [
    // 4+ chars
    { pattern: /tion$/, sound: "-tion" },
    { pattern: /ness$/, sound: "-ness" },
    { pattern: /ment$/, sound: "-ment" },
    { pattern: /ight$/, sound: "-ight" },
    { pattern: /ough$/, sound: "-ough" },
    { pattern: /ound$/, sound: "-ound" },
    { pattern: /ould$/, sound: "-ould" },
    { pattern: /ance$/, sound: "-ance" },
    { pattern: /ence$/, sound: "-ence" },
    // 3 chars
    { pattern: /ing$/, sound: "-ing" },
    { pattern: /ess$/, sound: "-ess" },
    { pattern: /ful$/, sound: "-ful" },
    { pattern: /ous$/, sound: "-ous" },
    { pattern: /ive$/, sound: "-ive" },
    { pattern: /ate$/, sound: "-ate" },
    { pattern: /ine$/, sound: "-ine" },
    { pattern: /ove$/, sound: "-ove" },
    { pattern: /ade$/, sound: "-ade" },
    { pattern: /ide$/, sound: "-ide" },
    { pattern: /ose$/, sound: "-ose" },
    { pattern: /aze$/, sound: "-aze" },
    { pattern: /ize$/, sound: "-ize" },
    { pattern: /ear$/, sound: "-ear" },
    { pattern: /air$/, sound: "-air" },
    { pattern: /are$/, sound: "-are" },
    { pattern: /ore$/, sound: "-ore" },
    { pattern: /our$/, sound: "-our" },
    { pattern: /ure$/, sound: "-ure" },
    { pattern: /eer$/, sound: "-eer" },
    { pattern: /ow$/, sound: "-ow" },
    { pattern: /ay$/, sound: "-ay" },
    { pattern: /ey$/, sound: "-ey" },
    { pattern: /ee$/, sound: "-ee" },
    { pattern: /oo$/, sound: "-oo" },
  ];

  for (const { pattern, sound } of patterns) {
    if (pattern.test(normalized)) {
      return sound;
    }
  }

  // Fallback: use last 3 characters
  if (normalized.length >= 3) {
    return `-${normalized.slice(-3)}`;
  }
  if (normalized.length >= 2) {
    return `-${normalized.slice(-2)}`;
  }
  return `-${normalized}`;
}

/**
 * Check if two words rhyme (perfect rhyme)
 */
export function doWordsRhyme(word1: string, word2: string): boolean {
  const sound1 = getRhymeSound(word1);
  const sound2 = getRhymeSound(word2);
  return sound1 === sound2;
}

/**
 * Find lines that should rhyme based on a rhyme scheme
 * e.g., "ABAB" returns [[0, 2], [1, 3]]
 */
export function findRhymePairs(rhymeScheme: string): [number, number][] {
  const pairs: [number, number][] = [];
  const schemeChars = rhymeScheme.toUpperCase().split("");

  // Group lines by their scheme letter
  const linesByLetter = new Map<string, number[]>();
  for (let i = 0; i < schemeChars.length; i++) {
    const letter = schemeChars[i];
    if (!linesByLetter.has(letter)) {
      linesByLetter.set(letter, []);
    }
    linesByLetter.get(letter)!.push(i);
  }

  // Create pairs from groups (first line paired with each subsequent)
  for (const [, lines] of linesByLetter) {
    if (lines.length >= 2) {
      for (let i = 1; i < lines.length; i++) {
        pairs.push([lines[0], lines[i]]);
      }
    }
  }

  return pairs;
}

/**
 * Clear the rhyme cache (useful for testing)
 */
export function clearRhymeCache(): void {
  rhymeCache.clear();
}
