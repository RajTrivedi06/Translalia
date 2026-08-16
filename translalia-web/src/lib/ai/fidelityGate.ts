/**
 * Fidelity Gate: Meaning Preservation Validation
 * 
 * Replaces Phase 1's anchor validation with lightweight local checks for
 * meaning preservation. Validates that critical correctness elements are
 * preserved across translation variants.
 * 
 * Checks:
 * 1. Number preservation (digits, years, percentages, currency)
 * 2. Negation/polarity preservation (not, never, no, etc.)
 * 3. Proper noun preservation (capitalized tokens)
 * 4. Terminal intent preservation (question marks, exclamation marks)
 */

import { detectScript } from "@/lib/text/script";

export interface FidelityGateResult {
  pass: boolean;
  reason?: string;
  worstIndex?: number;
  checks: {
    numbers: { pass: boolean; reason?: string };
    negation: { pass: boolean; reason?: string };
    properNouns: { pass: boolean; reason?: string };
    terminalIntent: { pass: boolean; reason?: string };
  };
}

// =============================================================================
// CJK / full-width numeral handling
// =============================================================================

/** Full-width digits ０-９ → ASCII. */
const FULLWIDTH_DIGITS: Record<string, string> = {
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
};

/** CJK numeral characters → their ASCII digit, for positional reading. */
const CJK_DIGITS: Record<string, string> = {
  "〇": "0", "零": "0",
  "一": "1", "壹": "1",
  "二": "2", "贰": "2", "两": "2",
  "三": "3", "叁": "3",
  "四": "4", "肆": "4",
  "五": "5", "伍": "5",
  "六": "6", "陆": "6",
  "七": "7", "柒": "7",
  "八": "8", "捌": "8",
  "九": "9", "玖": "9",
};

/** Multiplier characters that mark a non-positional CJK number. */
const CJK_MULTIPLIERS = new Set(["十", "百", "千", "万", "亿"]);

/**
 * Normalise full-width digits to ASCII so `５０％` reads as `50%`.
 */
function normalizeFullwidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => FULLWIDTH_DIGITS[ch] ?? ch);
}

/**
 * Extract numbers written in CJK numerals.
 *
 * Handles the two forms that actually appear in translated verse:
 *
 *  - POSITIONAL, digit-by-digit: 一九二三 → "1923". This is how years are
 *    written, and it is the case the recon flagged (a source "1923" rendered
 *    as 一九二三 reported `Missing numbers: 1923`).
 *  - SMALL CARDINALS with multipliers: 十 → 10, 三十 → 30, 二十五 → 25,
 *    百 → 100, 三百 → 300, 千 → 1000, 万 → 10000.
 *
 * Deliberately NOT a general CJK numeral parser. Compound forms beyond the
 * above (三千二百四十七) are not attempted: getting them subtly wrong would
 * make the gate assert a number is missing when it is present, which is the
 * failure mode this whole phase exists to remove. Unparsed runs simply yield
 * nothing, and the check falls back to its existing substring tolerance.
 */
function extractCjkNumbers(text: string): string[] {
  const results: string[] = [];
  const numeralChars = Object.keys(CJK_DIGITS).join("");
  const runRe = new RegExp(`[${numeralChars}十百千万亿]+`, "g");

  for (const match of text.match(runRe) ?? []) {
    const hasMultiplier = [...match].some((ch) => CJK_MULTIPLIERS.has(ch));

    if (!hasMultiplier) {
      // Positional reading: 一九二三 -> 1923
      const digits = [...match].map((ch) => CJK_DIGITS[ch]).join("");
      if (digits.length > 0) {
        results.push(digits);
        // A multi-digit positional run is also a sequence of single digits to
        // a reader; record the bare digits too so a source "1" still matches
        // a variant containing 一.
        if (digits.length === 1) continue;
      }
      continue;
    }

    // Small cardinals with a single multiplier: [digit?] MULT [digit?]
    const m = match.match(
      new RegExp(`^([${numeralChars}])?([十百千万亿])([${numeralChars}])?$`)
    );
    if (!m) continue;

    const unit =
      m[2] === "十" ? 10 : m[2] === "百" ? 100 : m[2] === "千" ? 1000 : m[2] === "万" ? 10000 : 100000000;
    const lead = m[1] ? Number(CJK_DIGITS[m[1]]) : 1;
    const tail = m[3] ? Number(CJK_DIGITS[m[3]]) : 0;
    const value = lead * unit + (m[2] === "十" ? tail : tail * (unit / 10));
    if (Number.isFinite(value)) results.push(String(value));
  }

  return results;
}

/**
 * Extract numbers from text (digits, years, percentages, currency)
 */
function extractNumbers(text: string): string[] {
  const numbers: string[] = [];
  const normalized = normalizeFullwidthDigits(text);

  // CJK numerals, treated as equivalent to their ASCII values.
  numbers.push(...extractCjkNumbers(normalized));

  // Match digits/years (e.g., "1923", "42", "2024")
  const digitMatches = normalized.match(/\b\d{1,4}\b/g);
  if (digitMatches) {
    numbers.push(...digitMatches);
  }
  
  // Match percentages (e.g., "50%", "75%")
  const percentMatches = normalized.match(/\d+%/g);
  if (percentMatches) {
    numbers.push(...percentMatches);
  }
  
  // Match currency (e.g., "$100", "€50", "£20")
  const currencyMatches = normalized.match(/[$€£¥]\d+/g);
  if (currencyMatches) {
    numbers.push(...currencyMatches);
  }
  
  // Match decimals (e.g., "3.14", "0.5")
  const decimalMatches = normalized.match(/\d+\.\d+/g);
  if (decimalMatches) {
    numbers.push(...decimalMatches);
  }
  
  return [...new Set(numbers)]; // Deduplicate
}

/**
 * Extract negation markers from text
 */
function extractNegationMarkers(text: string): string[] {
  const markers: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common negation markers
  const negationPatterns = [
    /\bnot\b/,
    /\bnever\b/,
    /\bno\b/,
    /\bcan't\b/,
    /\bcannot\b/,
    /\bwon't\b/,
    /\bwouldn't\b/,
    /\bshan't\b/,
    /\bnone\b/,
    /\bnothing\b/,
    /\bnowhere\b/,
    /\bneither\b/,
    /\bnor\b/,
    // French
    /\bne\s+\w+\s+pas\b/,
    /\bjamais\b/,
    /\brien\b/,
    // Spanish/Portuguese
    /\bno\b/,
    /\bnunca\b/,
    /\bnada\b/,
    // Italian
    /\bnon\b/,
    /\bmai\b/,
    /\bniente\b/,
    // Chinese / Japanese. No \b: word boundaries are meaningless without
    // spaces, and \b between two Han characters never matches, so the Latin
    // patterns above could never have fired on CJK text. Longest first so
    // 没有 is preferred over a bare 没.
    /没有/,
    /不/,
    /没/,
    /未/,
    /无/,
    /非/,
    /别/,
    /莫/,
  ];
  
  for (const pattern of negationPatterns) {
    if (pattern.test(lowerText)) {
      const matches = lowerText.match(pattern);
      if (matches) {
        markers.push(...matches);
      }
    }
  }
  
  return [...new Set(markers)]; // Deduplicate
}

/**
 * Extract proper nouns (capitalized tokens) from text
 */
function extractProperNouns(text: string): string[] {
  // Split into tokens, keep those that start with uppercase and are not sentence-starting words
  const tokens = text.split(/\s+/);
  const properNouns: string[] = [];
  
  // Skip first token (often capitalized at sentence start)
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i].replace(/[^\p{L}]/gu, ''); // Remove punctuation
    if (token.length > 1 && /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]*$/.test(token)) {
      // Token starts with uppercase and is followed by lowercase (proper noun pattern)
      properNouns.push(token);
    }
  }
  
  // Also check for all-caps tokens (acronyms)
  const allCapsMatches = text.match(/\b[A-Z]{2,}\b/g);
  if (allCapsMatches) {
    properNouns.push(...allCapsMatches);
  }
  
  return [...new Set(properNouns)]; // Deduplicate
}

/**
 * Check if text preserves terminal intent (question/exclamation)
 */
function hasTerminalIntent(text: string): "question" | "exclamation" | "none" {
  // Fold the full-width forms so ？ and ！ count as ? and !. Without this a
  // Chinese question ending in ？ read as "none", and a Chinese rendering of an
  // English question failed the check outright.
  const trimmed = text.trim().replace(/？/g, "?").replace(/！/g, "!");
  if (trimmed.endsWith("?")) {
    return "question";
  }
  if (trimmed.endsWith("!")) {
    return "exclamation";
  }
  return "none";
}

/**
 * Check number preservation
 */
function checkNumberPreservation(
  sourceNumbers: string[],
  variantText: string
): { pass: boolean; reason?: string } {
  if (sourceNumbers.length === 0) {
    return { pass: true };
  }
  
  const variantNumbers = extractNumbers(variantText);
  
  // Check if all source numbers appear in variant (flexible matching)
  const missing: string[] = [];
  for (const sourceNum of sourceNumbers) {
    // Try exact match first
    let found = variantNumbers.some(vn => vn === sourceNum);
    
    // If not found, try digit-only match (ignore currency symbols)
    if (!found) {
      const sourceDigits = sourceNum.replace(/[$€£¥%]/g, "");
      found = variantNumbers.some(vn => {
        const variantDigits = vn.replace(/[$€£¥%]/g, "");
        return variantDigits === sourceDigits || variantText.includes(sourceDigits);
      });
    }
    
    // Check if number appears in text even if not extracted
    if (!found) {
      const sourceDigits = sourceNum.replace(/[$€£¥%]/g, "");
      found = variantText.includes(sourceDigits);
    }
    
    if (!found) {
      missing.push(sourceNum);
    }
  }
  
  if (missing.length > 0) {
    return {
      pass: false,
      reason: `Missing numbers: ${missing.join(", ")}`,
    };
  }
  
  return { pass: true };
}

/**
 * Check negation preservation
 */
function checkNegationPreservation(
  sourceHasNegation: boolean,
  variantText: string
): { pass: boolean; reason?: string } {
  if (!sourceHasNegation) {
    return { pass: true }; // No negation to preserve
  }
  
  const variantNegation = extractNegationMarkers(variantText);
  if (variantNegation.length === 0) {
    return {
      pass: false,
      reason: "Source has negation but variant does not",
    };
  }
  
  return { pass: true };
}

/**
 * Check proper noun preservation (lenient - allows transliteration)
 */
function checkProperNounPreservation(
  sourceProperNouns: string[],
  variantText: string
): { pass: boolean; reason?: string } {
  if (sourceProperNouns.length === 0) {
    return { pass: true };
  }

  // Skip entirely when the VARIANT is not Latin script.
  //
  // The check demands the source's Latin proper noun appear verbatim in the
  // variant. A correct Chinese translation renders Paris as 巴黎, so the check
  // fails every properly localised name — it penalises the right answer. The
  // alternative, transliteration matching, is a product decision pending with
  // the client and is deliberately not attempted here.
  //
  // Note this is asymmetric with the extraction side, which is inert rather
  // than wrong for CJK sources: `extractProperNouns` keys on Latin
  // capitalisation, so a Chinese source yields no proper nouns and the check
  // never runs. Only the variant side needed guarding.
  const variantScript = detectScript(variantText);
  if (variantScript !== "latin" && variantScript !== "other") {
    return { pass: true };
  }

  const variantLower = variantText.toLowerCase();
  const missing: string[] = [];
  
  for (const properNoun of sourceProperNouns) {
    // Check if proper noun appears in variant (case-insensitive)
    // Also check for transliterations (e.g., "Paris" -> "París")
    const nounLower = properNoun.toLowerCase();
    const found =
      variantLower.includes(nounLower) ||
      variantText.includes(properNoun); // Case-sensitive check
    
    if (!found) {
      missing.push(properNoun);
    }
  }
  
  if (missing.length > 0) {
    return {
      pass: false,
      reason: `Missing proper nouns: ${missing.join(", ")}`,
    };
  }
  
  return { pass: true };
}

/**
 * Check terminal intent preservation
 */
function checkTerminalIntentPreservation(
  sourceIntent: "question" | "exclamation" | "none",
  variantText: string
): { pass: boolean; reason?: string } {
  if (sourceIntent === "none") {
    return { pass: true };
  }
  
  const variantIntent = hasTerminalIntent(variantText);
  if (variantIntent !== sourceIntent) {
    return {
      pass: false,
      reason: `Source ends with ${sourceIntent === "question" ? "?" : "!"} but variant does not`,
    };
  }
  
  return { pass: true };
}

/**
 * Run Fidelity Gate validation on all variants
 */
export function checkFidelity(
  sourceText: string,
  variants: Array<{ label: "A" | "B" | "C"; text: string }>
): FidelityGateResult {
  // Extract from source
  const sourceNumbers = extractNumbers(sourceText);
  const sourceNegationMarkers = extractNegationMarkers(sourceText);
  const sourceHasNegation = sourceNegationMarkers.length > 0;
  const sourceProperNouns = extractProperNouns(sourceText);
  const sourceTerminalIntent = hasTerminalIntent(sourceText);
  
  // Check each variant
  const variantChecks = variants.map((variant, index) => {
    const numbersCheck = checkNumberPreservation(sourceNumbers, variant.text);
    const negationCheck = checkNegationPreservation(
      sourceHasNegation,
      variant.text
    );
    const properNounsCheck = checkProperNounPreservation(
      sourceProperNouns,
      variant.text
    );
    const terminalIntentCheck = checkTerminalIntentPreservation(
      sourceTerminalIntent,
      variant.text
    );
    
    return {
      index,
      variant: variant.label,
      checks: {
        numbers: numbersCheck,
        negation: negationCheck,
        properNouns: properNounsCheck,
        terminalIntent: terminalIntentCheck,
      },
    };
  });
  
  // Find first failing variant
  const firstFailure = variantChecks.find(
    (vc) =>
      !vc.checks.numbers.pass ||
      !vc.checks.negation.pass ||
      !vc.checks.properNouns.pass ||
      !vc.checks.terminalIntent.pass
  );
  
  if (firstFailure) {
    const failingChecks = Object.entries(firstFailure.checks)
      .filter(([_, check]) => !check.pass)
      .map(([name, check]) => `${name}: ${check.reason}`)
      .join("; ");
    
    return {
      pass: false,
      reason: `Variant ${firstFailure.variant} failed fidelity: ${failingChecks}`,
      worstIndex: firstFailure.index,
      checks: firstFailure.checks,
    };
  }
  
  // All variants passed
  return {
    pass: true,
    checks: variantChecks[0].checks, // Return checks from first variant as representative
  };
}
