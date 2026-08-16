/**
 * Stopwords Module
 *
 * Provides language-specific stopword sets for Jaccard similarity calculations
 * in the diversity gate. Stopwords are filtered during tokenization to focus
 * on meaningful content words.
 */

import { detectScript } from "@/lib/text/script";

// =============================================================================
// English Stopwords
// =============================================================================
export const EN_STOPWORDS = new Set([
  // Pronouns
  "i",
  "im",
  "i'm",
  "me",
  "my",
  "mine",
  "myself",
  "we",
  "us",
  "our",
  "ours",
  "ourselves",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "it",
  "its",
  "itself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
  // Articles
  "a",
  "an",
  "the",
  // Prepositions
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "with",
  "by",
  "from",
  "under",
  "over",
  "through",
  "into",
  "onto",
  "upon",
  "about",
  "between",
  "among",
  "during",
  "before",
  "after",
  // Conjunctions
  "and",
  "or",
  "but",
  "so",
  "yet",
  "nor",
  // Auxiliaries / Common verbs
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "can",
  "could",
  // Demonstratives
  "this",
  "that",
  "these",
  "those",
  // Comparison markers (important for simile detection, include as stopwords)
  "as",
  "like",
  // Other common words
  "not",
  "no",
  "yes",
  "if",
  "then",
  "when",
  "where",
  "what",
  "who",
  "which",
  "all",
  "any",
  "each",
  "every",
  "some",
  "most",
  "other",
  "such",
]);

// =============================================================================
// French Stopwords
// =============================================================================
export const FR_STOPWORDS = new Set([
  // Pronouns
  "je",
  "j",
  "tu",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "elles",
  "me",
  "te",
  "se",
  "lui",
  "leur",
  "moi",
  "toi",
  "soi",
  // Articles
  "un",
  "une",
  "le",
  "la",
  "les",
  "des",
  "du",
  "de",
  "l",
  // Prepositions
  "à",
  "a",
  "de",
  "en",
  "dans",
  "sur",
  "sous",
  "avec",
  "sans",
  "pour",
  "par",
  "chez",
  "vers",
  "entre",
  "contre",
  "depuis",
  // Conjunctions
  "et",
  "ou",
  "mais",
  "donc",
  "car",
  "ni",
  "or",
  // Auxiliaries
  "est",
  "sont",
  "était",
  "être",
  "avoir",
  "ai",
  "as",
  "avons",
  "avez",
  "ont",
  // Demonstratives
  "ce",
  "cette",
  "ces",
  "cet",
  // Comparison
  "comme",
  "que",
  "qui",
  // Other
  "ne",
  "pas",
  "plus",
  "très",
  "tout",
  "tous",
  "toute",
  "toutes",
]);

// =============================================================================
// Spanish Stopwords
// =============================================================================
export const ES_STOPWORDS = new Set([
  // Pronouns
  "yo",
  "tú",
  "tu",
  "él",
  "el",
  "ella",
  "nosotros",
  "nosotras",
  "vosotros",
  "vosotras",
  "ellos",
  "ellas",
  "usted",
  "ustedes",
  "me",
  "te",
  "se",
  "nos",
  "os",
  "lo",
  "la",
  "los",
  "las",
  "le",
  "les",
  // Articles
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "el",
  "la",
  "los",
  "las",
  // Prepositions
  "a",
  "de",
  "en",
  "con",
  "por",
  "para",
  "sin",
  "sobre",
  "bajo",
  "entre",
  "desde",
  "hasta",
  "hacia",
  "según",
  "durante",
  // Conjunctions
  "y",
  "e",
  "o",
  "u",
  "pero",
  "sino",
  "aunque",
  "porque",
  "que",
  // Auxiliaries / Common verbs
  "es",
  "son",
  "está",
  "están",
  "era",
  "eran",
  "ser",
  "estar",
  "ha",
  "han",
  "he",
  "has",
  "haber",
  "tiene",
  "tienen",
  "tener",
  // Demonstratives
  "este",
  "esta",
  "estos",
  "estas",
  "ese",
  "esa",
  "esos",
  "esas",
  "aquel",
  "aquella",
  "aquellos",
  "aquellas",
  // Comparison
  "como",
  "tan",
  "más",
  "menos",
  // Other
  "no",
  "sí",
  "si",
  "muy",
  "todo",
  "todos",
  "toda",
  "todas",
  "qué",
  "que",
  "quién",
  "quien",
  "cuál",
  "cual",
]);

// =============================================================================
// German Stopwords
// =============================================================================
export const DE_STOPWORDS = new Set([
  // Pronouns
  "ich",
  "du",
  "er",
  "sie",
  "es",
  "wir",
  "ihr",
  "Sie",
  "mich",
  "dich",
  "sich",
  "uns",
  "euch",
  "mir",
  "dir",
  "ihm",
  "ihr",
  "ihnen",
  "mein",
  "dein",
  "sein",
  "unser",
  "euer",
  // Articles
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "eines",
  "einem",
  "einen",
  // Prepositions
  "in",
  "an",
  "auf",
  "aus",
  "bei",
  "mit",
  "nach",
  "von",
  "zu",
  "für",
  "über",
  "unter",
  "durch",
  "gegen",
  "ohne",
  "um",
  "zwischen",
  // Conjunctions
  "und",
  "oder",
  "aber",
  "denn",
  "weil",
  "dass",
  "wenn",
  "als",
  "ob",
  // Auxiliaries
  "ist",
  "sind",
  "war",
  "waren",
  "sein",
  "haben",
  "hat",
  "hatte",
  "hatten",
  "wird",
  "werden",
  "wurde",
  "wurden",
  "kann",
  "können",
  "muss",
  "müssen",
  // Demonstratives
  "dieser",
  "diese",
  "dieses",
  "jener",
  "jene",
  "jenes",
  // Comparison
  "wie",
  "so",
  "als",
  // Other
  "nicht",
  "kein",
  "keine",
  "ja",
  "nein",
  "auch",
  "noch",
  "schon",
  "sehr",
  "nur",
  "immer",
  "all",
  "alle",
  "alles",
]);

// =============================================================================
// Portuguese Stopwords
// =============================================================================
export const PT_STOPWORDS = new Set([
  // Pronouns
  "eu",
  "tu",
  "ele",
  "ela",
  "nós",
  "vós",
  "eles",
  "elas",
  "você",
  "vocês",
  "me",
  "te",
  "se",
  "nos",
  "vos",
  "o",
  "a",
  "os",
  "as",
  "lhe",
  "lhes",
  // Articles
  "um",
  "uma",
  "uns",
  "umas",
  "o",
  "a",
  "os",
  "as",
  // Prepositions
  "de",
  "em",
  "a",
  "com",
  "por",
  "para",
  "sem",
  "sobre",
  "sob",
  "entre",
  "desde",
  "até",
  "após",
  "durante",
  // Conjunctions
  "e",
  "ou",
  "mas",
  "porém",
  "contudo",
  "porque",
  "que",
  "se",
  // Auxiliaries / Common verbs
  "é",
  "são",
  "está",
  "estão",
  "era",
  "eram",
  "ser",
  "estar",
  "tem",
  "têm",
  "tinha",
  "tinham",
  "ter",
  "há",
  // Demonstratives
  "este",
  "esta",
  "estes",
  "estas",
  "esse",
  "essa",
  "esses",
  "essas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  // Comparison
  "como",
  "tão",
  "mais",
  "menos",
  // Other
  "não",
  "sim",
  "muito",
  "todo",
  "todos",
  "toda",
  "todas",
  "quê",
  "que",
  "quem",
  "qual",
  "quais",
]);

// =============================================================================
// Italian Stopwords
// =============================================================================
export const IT_STOPWORDS = new Set([
  // Pronouns
  "io",
  "tu",
  "lui",
  "lei",
  "Lei",
  "noi",
  "voi",
  "loro",
  "mi",
  "ti",
  "ci",
  "vi",
  "si",
  "lo",
  "la",
  "li",
  "le",
  "gli",
  // Articles
  "un",
  "uno",
  "una",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "l",
  // Prepositions
  "di",
  "a",
  "da",
  "in",
  "con",
  "su",
  "per",
  "tra",
  "fra",
  "sopra",
  "sotto",
  "durante",
  "verso",
  // Conjunctions
  "e",
  "ed",
  "o",
  "ma",
  "però",
  "perché",
  "che",
  "se",
  // Auxiliaries / Common verbs
  "è",
  "sono",
  "era",
  "erano",
  "essere",
  "avere",
  "ha",
  "hanno",
  "ho",
  "hai",
  // Demonstratives
  "questo",
  "questa",
  "questi",
  "queste",
  "quello",
  "quella",
  "quelli",
  "quelle",
  // Comparison
  "come",
  "così",
  "più",
  "meno",
  // Other
  "non",
  "sì",
  "no",
  "molto",
  "tutto",
  "tutti",
  "tutta",
  "tutte",
  "che",
  "chi",
  "quale",
  "quali",
]);

// =============================================================================
// Language Detection and Selection
// =============================================================================

/**
 * Language hint patterns for detection
 */
const LANGUAGE_PATTERNS: Array<{ pattern: RegExp; stopwords: Set<string> }> = [
  // French
  {
    pattern: /french|français|francais|fra?$/i,
    stopwords: FR_STOPWORDS,
  },
  // Spanish
  {
    pattern: /spanish|español|espanol|castellano|spa?$/i,
    stopwords: ES_STOPWORDS,
  },
  // German
  {
    pattern: /german|deutsch|deu?$/i,
    stopwords: DE_STOPWORDS,
  },
  // Portuguese
  {
    pattern: /portuguese|português|portugues|por?$/i,
    stopwords: PT_STOPWORDS,
  },
  // Italian
  {
    pattern: /italian|italiano|ita?$/i,
    stopwords: IT_STOPWORDS,
  },
  // English (last as fallback matches are common)
  {
    pattern: /english|eng?$/i,
    stopwords: EN_STOPWORDS,
  },
];

/**
 * Pick the appropriate stopword set based on target language hint.
 *
 * @param targetLanguageHint - Language name or code (e.g., "Spanish", "Español", "es", "German")
 *        Also handles BCP-47 tags like "es-MX", "pt-BR", "fr-CA"
 * @returns The appropriate stopword set (defaults to English)
 */
export function pickStopwords(targetLanguageHint?: string): Set<string> {
  // Unchanged behaviour, kept for the call sites this phase does not own:
  // an unmatched hint still falls back to English. Prefer
  // `resolveStopwordsForText` in new code — it can tell "English" apart from
  // "we have no idea".
  return matchStopwordsByHint(targetLanguageHint) ?? EN_STOPWORDS;
}

/** Immutable empty set, returned when we have no usable stopword list. */
const NO_STOPWORDS: ReadonlySet<string> = new Set<string>();

export interface ResolvedStopwords {
  stopwords: Set<string>;
  /**
   * False when the hint matched no known language AND the text is not written
   * in a script our lists cover. Callers MUST skip stopword-dependent logic
   * when this is false rather than run English stopwords against the text.
   */
  known: boolean;
  /** Human-readable language label, or "unknown". */
  language: string;
}

/**
 * Resolve stopwords for a piece of TEXT, given a (possibly useless) language
 * hint.
 *
 * Why text-aware rather than hint-only: in production the hint is the literal
 * placeholder `"the target language"` for every thread, because nothing
 * populates `answers.targetLanguage` (recon §5, ledger F-01-005). A hint-only
 * "unknown → empty set" rule would therefore strip stopword filtering from
 * EVERY thread including all the Latin ones, changing their content-token
 * counts, their length-aware Jaccard thresholds, and so their gate outcomes.
 * That would break the "Latin behaviour is frozen" guarantee this phase is
 * held to.
 *
 * So the fallback is narrowed by script instead of widened by hint:
 *
 *  - hint matches a known language  → that list, known: true
 *  - hint unknown, text is Latin    → English list, known: true
 *                                     (unchanged from today — an imprecision
 *                                     that predates this work, not the bug)
 *  - hint unknown, text is CJK/Thai → EMPTY set, known: false
 *
 * Only the third case is new, and it is exactly the case that was broken:
 * scoring Chinese against English stopwords, where nothing ever matches, so
 * every Chinese function word (的 在 中) counted as a content token.
 */
export function resolveStopwordsForText(
  text: string,
  targetLanguageHint?: string
): ResolvedStopwords {
  const matched = matchStopwordsByHint(targetLanguageHint);
  if (matched) {
    return {
      stopwords: matched,
      known: true,
      language: getStopwordsLanguage(matched),
    };
  }

  const script = detectScript(text);
  if (script === "latin" || script === "other") {
    // Preserve today's behaviour exactly for spaced scripts.
    return { stopwords: EN_STOPWORDS, known: true, language: "English" };
  }

  return {
    stopwords: NO_STOPWORDS as Set<string>,
    known: false,
    language: "unknown",
  };
}

/**
 * Hint-only match. Returns null when nothing matches, instead of silently
 * defaulting to English — that default is applied by the callers above, where
 * it can be made conditional.
 */
function matchStopwordsByHint(
  targetLanguageHint?: string
): Set<string> | null {
  if (!targetLanguageHint) return null;

  const hint = targetLanguageHint.trim();

  for (const { pattern, stopwords } of LANGUAGE_PATTERNS) {
    if (pattern.test(hint)) return stopwords;
  }

  const bcp47Match = hint.match(/^([a-z]{2,3})[-_]/i);
  if (bcp47Match) {
    const baseCodeMap: Record<string, Set<string>> = {
      fr: FR_STOPWORDS,
      es: ES_STOPWORDS,
      de: DE_STOPWORDS,
      pt: PT_STOPWORDS,
      it: IT_STOPWORDS,
      en: EN_STOPWORDS,
      fra: FR_STOPWORDS,
      spa: ES_STOPWORDS,
      deu: DE_STOPWORDS,
      por: PT_STOPWORDS,
      ita: IT_STOPWORDS,
      eng: EN_STOPWORDS,
    };
    const mapped = baseCodeMap[bcp47Match[1].toLowerCase()];
    if (mapped) return mapped;
  }

  const shortCode = hint.slice(0, 3).toLowerCase();
  if (shortCode.startsWith("fr")) return FR_STOPWORDS;
  if (shortCode.startsWith("es")) return ES_STOPWORDS;
  if (shortCode.startsWith("de")) return DE_STOPWORDS;
  if (shortCode.startsWith("pt")) return PT_STOPWORDS;
  if (shortCode.startsWith("it")) return IT_STOPWORDS;

  return null;
}

/**
 * Get the language name for a stopword set (for debugging)
 */
export function getStopwordsLanguage(stopwords: Set<string>): string {
  if (stopwords.size === 0) return "unknown";
  if (stopwords === FR_STOPWORDS) return "French";
  if (stopwords === ES_STOPWORDS) return "Spanish";
  if (stopwords === DE_STOPWORDS) return "German";
  if (stopwords === PT_STOPWORDS) return "Portuguese";
  if (stopwords === IT_STOPWORDS) return "Italian";
  return "English";
}
