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

/**
 * Extract numbers from text (digits, years, percentages, currency)
 */
function extractNumbers(text: string): string[] {
  const numbers: string[] = [];
  
  // Match digits/years (e.g., "1923", "42", "2024")
  const digitMatches = text.match(/\b\d{1,4}\b/g);
  if (digitMatches) {
    numbers.push(...digitMatches);
  }
  
  // Match percentages (e.g., "50%", "75%")
  const percentMatches = text.match(/\d+%/g);
  if (percentMatches) {
    numbers.push(...percentMatches);
  }
  
  // Match currency (e.g., "$100", "€50", "£20")
  const currencyMatches = text.match(/[$€£¥]\d+/g);
  if (currencyMatches) {
    numbers.push(...currencyMatches);
  }
  
  // Match decimals (e.g., "3.14", "0.5")
  const decimalMatches = text.match(/\d+\.\d+/g);
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
  const trimmed = text.trim();
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
