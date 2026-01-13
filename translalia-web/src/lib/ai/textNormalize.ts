/**
 * Text Normalization Utilities for Phase 1 Validation
 *
 * Provides robust normalization functions to avoid false validation failures
 * due to punctuation, quotes, dashes, and other formatting variations.
 */

/**
 * Normalize text for containment checks.
 * Handles:
 * - Curly quotes → straight quotes
 * - Unicode dashes → hyphen
 * - Punctuation (except apostrophes) → spaces
 * - Lowercase
 * - Collapse whitespace
 *
 * This allows "bus," to match "bus", and handles dash/quote variants like
 * "late-night" vs "late—night" or "he's" vs "he's".
 *
 * @param text - Text to normalize
 * @returns Normalized text suitable for substring containment checks
 */
export function normalizeForContainment(text: string): string {
  return (
    text
      // Normalize curly quotes to straight quotes
      .replace(/[\u2018\u2019]/g, "'") // Single curly quotes
      .replace(/[\u201C\u201D]/g, '"') // Double curly quotes
      // Normalize various dashes to hyphen
      .replace(/[\u2013\u2014\u2015]/g, "-") // En dash, em dash, horizontal bar
      // Replace punctuation (except apostrophes) with spaces
      .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
      // Lowercase
      .toLowerCase()
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Check if normalized haystack contains normalized needle as a substring.
 * Case-insensitive, punctuation-tolerant.
 *
 * @param haystack - Text to search in
 * @param needle - Substring to find
 * @returns True if needle is found in haystack (after normalization)
 */
export function containsNormalized(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeForContainment(haystack);
  const normalizedNeedle = normalizeForContainment(needle);

  return normalizedHaystack.includes(normalizedNeedle);
}

/**
 * Extract tokens from text (for stopword filtering).
 * Splits on whitespace and filters empty strings.
 *
 * @param text - Text to tokenize
 * @returns Array of tokens
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeForContainment(text);
  return normalized.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Check if a token is meaningful (not just punctuation or whitespace).
 *
 * @param token - Token to check
 * @returns True if token contains at least one alphanumeric character
 */
export function isMeaningfulToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token);
}

/**
 * Check if a string is stopword-only after tokenization.
 * Requires a stopword set for the target language.
 *
 * @param text - Text to check
 * @param stopwords - Set of stopwords for the target language
 * @returns True if all non-empty tokens are stopwords
 */
export function isStopwordOnly(text: string, stopwords: Set<string>): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return true;

  const nonStopwords = tokens.filter((t) => !stopwords.has(t.toLowerCase()));
  return nonStopwords.length === 0;
}

/**
 * Validate that a realization string is meaningful (Phase 1 requirement).
 *
 * Rules:
 * - Must be at least 2 chars (relaxed for acronyms or digits)
 * - Must contain at least one alphanumeric character
 * - Must not be stopword-only
 *
 * @param realization - The anchor realization string
 * @param stopwords - Set of stopwords for the target language
 * @returns { valid: boolean, reason?: string }
 */
export function validateRealizationMeaningfulness(
  realization: string,
  stopwords: Set<string>
): { valid: boolean; reason?: string } {
  const trimmed = realization.trim();

  // Check length (at least 2 chars, or 1 if it's an acronym or has a digit)
  if (trimmed.length < 2 && !/\d|[A-Z]{1,3}/.test(trimmed)) {
    return { valid: false, reason: "too short (< 2 chars)" };
  }

  // Check for at least one alphanumeric character
  if (!isMeaningfulToken(trimmed)) {
    return { valid: false, reason: "no alphanumeric characters" };
  }

  // Check if stopword-only
  if (isStopwordOnly(trimmed, stopwords)) {
    return { valid: false, reason: "stopword-only" };
  }

  return { valid: true };
}
