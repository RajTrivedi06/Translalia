/**
 * Phase 2: Structural Signature for Template Clone Detection
 *
 * Provides language-aware structural analysis to detect template clones
 * that share the same opener type, length bucket, and punctuation profile.
 * This catches variants like "On the bus, silence..." even when Jaccard is low.
 */

import { detectScript } from "@/lib/text/script";
import { segmentText } from "@/lib/text/segmentText";

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
 * Closed-class CJK openers.
 *
 * Deliberately tiny. These are function words whose opener role is
 * unambiguous without native-speaker judgement — coverage stops there. Content
 * words are NOT listed and must not be added without native-speaker input:
 * guessing at them would reintroduce the false-positive regens this exists to
 * prevent, just with more confident-looking labels.
 *
 * Matched as a PREFIX of the line rather than against a segmented token,
 * because ICU's dictionary may or may not split these the way we would (透过
 * and 通过 in particular), and for a fixed closed-class list prefix matching is
 * both deterministic and independent of the segmenter version.
 *
 * ORDER MATTERS: longest first, so 我们 wins over 我 and 透过 over a bare 透.
 */
const CJK_OPENERS: ReadonlyArray<readonly [string, OpenerType]> = [
  // Two-character forms first.
  ["透过", "PREP"],
  ["通过", "PREP"],
  ["我们", "PRON"],
  ["你们", "PRON"],
  ["他们", "PRON"],
  // Single-character forms.
  ["在", "PREP"],
  ["从", "PREP"],
  ["向", "PREP"],
  ["对", "PREP"],
  ["与", "PREP"],
  ["由", "PREP"],
  ["于", "PREP"],
  ["我", "PRON"],
  ["你", "PRON"],
  ["他", "PRON"],
  ["她", "PRON"],
  ["它", "PRON"],
  ["这", "DET"],
  ["那", "DET"],
  ["此", "DET"],
];

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
 *
 * Routes through the shared segmenter in `src/lib/text/`. For Latin this is
 * byte-identical to the whitespace split it replaced (guaranteed by the golden
 * test), because `segmentText` uses whitespace boundaries for spaced scripts —
 * the edge-punctuation strip below is preserved verbatim. For unspaced scripts
 * it is the difference between one token per line and real token counts, which
 * is what makes `lengthBucket` stop returning "short" for everything.
 */
export function tokenizeLight(text: string): string[] {
  const normalized = normalizeTextLight(text);

  // Keep word-like segments only: punctuation is measured separately by
  // `punctuationProfile` and must not inflate the token count.
  const rawTokens = segmentText(normalized)
    .filter((s) => s.wordLike)
    .map((s) => s.text);

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
  /**
   * CJK sentence terminators (。？！) only.
   *
   * ASCII `.` `?` `!` are deliberately NOT counted here. They never were, and
   * counting them now would change the signature of every Latin line that ends
   * in a full stop — i.e. all of them — which would alter Latin gate outcomes.
   * The result is an asymmetry (CJK terminators discriminate, ASCII ones do
   * not) that is accepted so Latin behaviour stays frozen.
   */
  terminators: number;
}

/**
 * Extract punctuation profile (counts of key punctuation marks).
 *
 * Counts the CJK/full-width forms alongside their ASCII equivalents. Without
 * this every Chinese line profiles as `c0d0k0s0` no matter how it is
 * punctuated — a line visibly containing ，and 。 registered as having no
 * punctuation at all, which is one of the three reasons every variant
 * collapsed to an identical structural signature.
 *
 * Grouping follows function, not codepoint family:
 *  - commas      ，(U+FF0C fullwidth) 、(U+3001 enumeration) + ASCII ,
 *  - dashes      ー(U+30FC) －(U+FF0D) + ASCII - (en/em dashes are already
 *                folded to - by normalizeTextLight)
 *  - colons      ：(U+FF1A) + ASCII :
 *  - semicolons  ；(U+FF1B) + ASCII ;
 *  - terminators 。？！ — CJK only, see the field docs
 */
export function punctuationProfile(text: string): PunctuationProfile {
  const normalized = normalizeTextLight(text);

  const count = (re: RegExp) => (normalized.match(re) || []).length;

  return {
    commas: count(/[,，、]/g),
    dashes: count(/[-ー－]/g),
    colons: count(/[:：]/g),
    semicolons: count(/[;；]/g),
    terminators: count(/[。？！]/g),
  };
}

// =============================================================================
// Opener Type Classification
// =============================================================================

/**
 * The opener types a CJK line can actually be classified as.
 *
 * Anything outside this set is unreachable for Han/Kana text: asking regen to
 * produce a NOUN_PHRASE or GERUND opener on a Chinese line is asking for
 * something `openerType` can never confirm, so the steering silently fails and
 * the mismatch is logged forever.
 */
export const CJK_REACHABLE_OPENERS: readonly OpenerType[] = [
  "PREP",
  "PRON",
  "DET",
];

/**
 * Classify a CJK line's opener against the closed-class lexicon.
 *
 * Leading punctuation and quotes are stripped first, so a line opening
 * `「在…` is classified on 在, not on the bracket.
 */
function cjkOpenerType(text: string): OpenerType {
  const trimmed = text.trim().replace(/^[^\p{L}\p{N}]+/u, "");
  if (!trimmed) return "UNKNOWN_SCRIPT";

  for (const [prefix, type] of CJK_OPENERS) {
    if (trimmed.startsWith(prefix)) return type;
  }

  // No confident classification. Say so, rather than guessing OTHER.
  return "UNKNOWN_SCRIPT";
}

export type OpenerType =
  | "PRON"
  | "PREP"
  | "NOUN_PHRASE"
  | "GERUND"
  /** CJK determiner (这/那/此). Latin determiners remain NOUN_PHRASE. */
  | "DET"
  /** Latin-script opener we recognise as none of the above. */
  | "OTHER"
  /**
   * Unspaced-script opener we cannot classify.
   *
   * Distinct from OTHER on purpose. OTHER is a *judgement* ("we looked and it
   * is not a pronoun/preposition/determiner"); UNKNOWN_SCRIPT is an *absence*
   * ("we have no lexicon for this"). Collapsing them is what made three
   * different Chinese variants look identical to the opener-equality check.
   * Callers must treat all-UNKNOWN_SCRIPT as "no signal", never as "all same".
   */
  | "UNKNOWN_SCRIPT";

/**
 * Classify the opener type of a text based on its first token.
 * Language-aware using pronoun/preposition/determiner lexicons.
 *
 * For unspaced scripts (Han/Kana) the Latin lexicons cannot see the opener at
 * all — `tokenizeLight` returns the whole line as one token, so every variant
 * scored OTHER regardless of how it actually began. Those route to the
 * closed-class CJK prefix lexicon instead, and fall back to UNKNOWN_SCRIPT
 * rather than OTHER when nothing matches.
 */
export function openerType(text: string, langHint?: string): OpenerType {
  const script = detectScript(text);
  if (script === "han" || script === "kana") {
    return cjkOpenerType(text);
  }

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

  // `t` is appended rather than inserted so the existing prefix is unchanged.
  // Latin lines always score t0 (ASCII terminators are not counted), so no
  // Latin equality relation shifts.
  const signature = `${opener}|${length}|c${punct.commas}d${punct.dashes}k${punct.colons}s${punct.semicolons}t${punct.terminators}|${tense}`;

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
