/**
 * Phase 2: Structural Signature for Template Clone Detection
 *
 * Provides language-aware structural analysis to detect template clones
 * that share the same opener type, length bucket, and punctuation profile.
 * This catches variants like "On the bus, silence..." even when Jaccard is low.
 */

// =============================================================================
// Language-Aware Lexicons
// =============================================================================

/**
 * Pronouns by language (first/second/third person, including contractions)
 */
const PRONOUNS: Record<string, string[]> = {
  en: ["i", "im", "i'm", "me", "my", "we", "us", "our", "you", "your", "he", "him", "his", "she", "her", "they", "them", "their", "it", "its"],
  es: ["yo", "me", "mi", "nosotros", "nosotras", "nos", "tú", "tu", "te", "vos", "él", "ella", "ellos", "ellas", "lo", "la", "los", "las"],
  fr: ["je", "j", "me", "moi", "nous", "tu", "te", "toi", "vous", "il", "elle", "ils", "elles", "le", "la", "les"],
  pt: ["eu", "me", "mim", "nós", "nos", "tu", "te", "você", "vocês", "ele", "ela", "eles", "elas", "o", "a", "os", "as"],
  de: ["ich", "mir", "mich", "wir", "uns", "du", "dir", "dich", "ihr", "euch", "er", "sie", "es", "ihn", "ihm"],
  it: ["io", "me", "mi", "noi", "ci", "tu", "te", "ti", "voi", "vi", "lui", "lei", "loro", "lo", "la", "li", "le"],
};

/**
 * Prepositions by language
 */
const PREPOSITIONS: Record<string, string[]> = {
  en: ["on", "in", "at", "to", "from", "with", "by", "for", "of", "about", "through", "over", "under", "between", "among", "during", "before", "after"],
  es: ["en", "a", "de", "con", "por", "para", "desde", "hasta", "sobre", "bajo", "entre", "durante", "ante", "tras"],
  fr: ["en", "à", "de", "dans", "sur", "sous", "avec", "sans", "pour", "par", "chez", "vers", "entre", "contre", "depuis"],
  pt: ["em", "a", "de", "com", "por", "para", "desde", "até", "sobre", "sob", "entre", "durante", "após", "antes"],
  de: ["in", "an", "auf", "aus", "bei", "mit", "nach", "von", "zu", "für", "über", "unter", "durch", "gegen", "ohne", "um", "zwischen"],
  it: ["in", "a", "da", "di", "con", "su", "per", "tra", "fra", "sopra", "sotto", "durante", "verso", "entro"],
};

/**
 * Determiners/articles by language (for NOUN_PHRASE detection)
 */
const DETERMINERS: Record<string, string[]> = {
  en: ["the", "a", "an", "this", "that", "these", "those"],
  es: ["el", "la", "los", "las", "un", "una", "unos", "unas", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas"],
  fr: ["le", "la", "les", "l", "un", "une", "des", "ce", "cet", "cette", "ces"],
  pt: ["o", "a", "os", "as", "um", "uma", "uns", "umas", "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas"],
  de: ["der", "die", "das", "ein", "eine", "einer", "eines", "einem", "einen", "dieser", "diese", "dieses", "jener", "jene", "jenes"],
  it: ["il", "lo", "la", "i", "gli", "le", "l", "un", "uno", "una", "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle"],
};

/**
 * Common nouns ending in "-ing" that should NOT be classified as gerunds
 */
const NOUN_ING_DENYLIST = new Set([
  "thing", "nothing", "something", "anything", "everything",
  "morning", "evening", "spring", "ring", "king", "wing",
  "building", "ceiling", "feeling", "being", "meaning",
]);

// =============================================================================
// Language Detection
// =============================================================================

/**
 * Detect language from hint (same pattern as stopwords.ts)
 */
function detectLanguage(langHint?: string): string {
  if (!langHint) return "en";

  const hint = langHint.toLowerCase().trim();

  if (/^(fr|french|français|francais)/.test(hint)) return "fr";
  if (/^(es|spanish|español|espanol|castellano)/.test(hint)) return "es";
  if (/^(de|german|deutsch)/.test(hint)) return "de";
  if (/^(pt|portuguese|português|portugues)/.test(hint)) return "pt";
  if (/^(it|italian|italiano)/.test(hint)) return "it";

  return "en"; // Default to English
}

// =============================================================================
// Text Normalization
// =============================================================================

/**
 * Lightweight normalization for structural analysis.
 * Handles quotes, dashes, casing, whitespace.
 */
export function normalizeTextLight(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'") // Curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"') // Curly double quotes → straight
    .replace(/[\u2013\u2014\u2015]/g, "-") // En/em dash → hyphen
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize text for structural analysis.
 * Returns word tokens with surrounding punctuation stripped (keeps internal apostrophes).
 */
export function tokenizeLight(text: string): string[] {
  const normalized = normalizeTextLight(text);

  // Split on whitespace
  const rawTokens = normalized.split(/\s+/);

  // Strip surrounding punctuation but keep internal apostrophes
  const tokens = rawTokens
    .map((t) => t.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
    .filter((t) => t.length > 0);

  return tokens;
}

/**
 * Count non-punctuation tokens (for length bucketing).
 * Does NOT remove stopwords - just counts word tokens.
 */
export function countNonPunctTokens(text: string): number {
  return tokenizeLight(text).length;
}

// =============================================================================
// Punctuation Profile
// =============================================================================

export interface PunctuationProfile {
  commas: number;
  dashes: number;
  colons: number;
  semicolons: number;
}

/**
 * Extract punctuation profile (counts of key punctuation marks).
 */
export function punctuationProfile(text: string): PunctuationProfile {
  const normalized = normalizeTextLight(text);

  return {
    commas: (normalized.match(/,/g) || []).length,
    dashes: (normalized.match(/-/g) || []).length,
    colons: (normalized.match(/:/g) || []).length,
    semicolons: (normalized.match(/;/g) || []).length,
  };
}

// =============================================================================
// Opener Type Classification
// =============================================================================

export type OpenerType = "PRON" | "PREP" | "NOUN_PHRASE" | "GERUND" | "OTHER";

/**
 * Classify the opener type of a text based on its first token.
 * Language-aware using pronoun/preposition/determiner lexicons.
 */
export function openerType(text: string, langHint?: string): OpenerType {
  const tokens = tokenizeLight(text);
  if (tokens.length === 0) return "OTHER";

  const firstToken = tokens[0];
  const lang = detectLanguage(langHint);

  // Check pronouns
  const pronouns = PRONOUNS[lang] || PRONOUNS.en;
  if (pronouns.includes(firstToken)) {
    return "PRON";
  }

  // Check prepositions
  const preps = PREPOSITIONS[lang] || PREPOSITIONS.en;
  if (preps.includes(firstToken)) {
    return "PREP";
  }

  // Check determiners (articles) for NOUN_PHRASE
  const dets = DETERMINERS[lang] || DETERMINERS.en;
  if (dets.includes(firstToken)) {
    return "NOUN_PHRASE";
  }

  // GERUND heuristic (English only, non-brittle)
  if (lang === "en" && firstToken.endsWith("ing") && !NOUN_ING_DENYLIST.has(firstToken)) {
    return "GERUND";
  }

  return "OTHER";
}

// =============================================================================
// Length Bucketing
// =============================================================================

export type LengthBucket = "short" | "med" | "long";

/**
 * Bucket text length by non-punctuation token count.
 * Does NOT remove stopwords - uses all word tokens.
 */
export function lengthBucket(text: string): LengthBucket {
  const count = countNonPunctTokens(text);

  if (count <= 6) return "short";
  if (count <= 14) return "med";
  return "long";
}

// =============================================================================
// Tense/Aspect Approximation (Optional)
// =============================================================================

/**
 * Cheap tense/aspect approximation (English only).
 * Returns "PROGRESSIVE", "PAST", "PRESENT", or "UNKNOWN".
 * Non-English: always "UNKNOWN".
 */
export function tenseAspectApprox(text: string, langHint?: string): string {
  const lang = detectLanguage(langHint);

  if (lang !== "en") {
    return "UNKNOWN";
  }

  const normalized = normalizeTextLight(text);

  // Progressive: "was/were/am/is/are/'m/'s/'re" + "ing"
  if (/\b(was|were|am|is|are|i'm|he's|she's|it's|you're|we're|they're)\s+\w+ing\b/.test(normalized)) {
    return "PROGRESSIVE";
  }

  // Past: common past tense markers
  if (/\b(was|were|had|did)\b/.test(normalized)) {
    return "PAST";
  }

  // Present: common present tense markers
  if (/\b(am|is|are|do|does|have|has)\b/.test(normalized)) {
    return "PRESENT";
  }

  return "UNKNOWN";
}

// =============================================================================
// Structural Signature
// =============================================================================

export interface StructuralSignature {
  signature: string;
  openerType: OpenerType;
  lengthBucket: LengthBucket;
  punctuation: PunctuationProfile;
  tenseAspect: string;
}

/**
 * Compute structural signature for template clone detection.
 * Returns stable key combining opener, length, punctuation, and tense.
 */
export function structuralSignature(text: string, langHint?: string): StructuralSignature {
  const opener = openerType(text, langHint);
  const length = lengthBucket(text);
  const punct = punctuationProfile(text);
  const tense = tenseAspectApprox(text, langHint);

  const signature = `${opener}|${length}|c${punct.commas}d${punct.dashes}k${punct.colons}s${punct.semicolons}|${tense}`;

  return {
    signature,
    openerType: opener,
    lengthBucket: length,
    punctuation: punct,
    tenseAspect: tense,
  };
}

/**
 * Check if two signatures match (for template clone detection).
 */
export function signaturesMatch(sig1: string, sig2: string): boolean {
  return sig1 === sig2;
}
