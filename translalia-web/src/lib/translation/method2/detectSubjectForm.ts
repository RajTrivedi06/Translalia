/**
 * ISS-014: Local Subject Form Detection
 * 
 * Detects the subject form used in Variant C text to replace model-provided
 * c_subject_form_used, reducing token bloat and ensuring consistency.
 * 
 * Field used for: Validation to ensure Variant C uses the correct subject form
 * (we/you/I/third_person/impersonal) as specified in the stance plan.
 * Safe to compute locally because: The subject form is directly observable
 * from the text (pronouns, verb forms), and we can detect it reliably.
 */

export type SubjectForm = "we" | "I" | "you" | "third_person" | "impersonal";

/**
 * Detect subject form from Variant C translation text.
 * 
 * Conservative detection that prefers strong signals:
 * - First-person plural: "we", "our", "us"
 * - First-person singular: "I", "my", "me"
 * - Second-person: "you", "your"
 * - Third-person: he/she/it/they (or no explicit subject)
 * - Impersonal: passive voice, "one", "it" constructions
 * 
 * @param text - Variant C translation text
 * @returns Detected subject form, or null if unclear
 */
export function detectSubjectForm(text: string): SubjectForm | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  const t = text.toLowerCase().trim();
  
  // Tokenize on non-letters/apostrophes to reduce false positives
  // This avoids matching "you" inside "youth", "I" inside "it", etc.
  const tokens = t.split(/[^a-z']+/).filter(Boolean);
  
  if (tokens.length === 0) {
    return null;
  }

  // Strong signal: first token is a pronoun
  const first = tokens[0];
  
  // First-person plural: "we", "our", "us"
  if (first === "we" || first === "our" || first === "us") {
    return "we";
  }
  
  // First-person singular: "I", "my", "me"
  if (first === "i" || first === "my" || first === "me") {
    return "I";
  }
  
  // Second-person: "you", "your"
  if (first === "you" || first === "your") {
    return "you";
  }
  
  // Check for first-person plural anywhere (strong signal)
  if (tokens.includes("we") || tokens.includes("our") || tokens.includes("us")) {
    return "we";
  }
  
  // Check for first-person singular anywhere (strong signal)
  if (tokens.includes("i") || tokens.includes("my") || tokens.includes("me")) {
    return "I";
  }
  
  // Check for second-person anywhere (strong signal)
  if (tokens.includes("you") || tokens.includes("your")) {
    return "you";
  }
  
  // Check for impersonal markers: "one", passive voice indicators
  // Passive voice often indicated by "is/are/was/were" + past participle
  // or "it" constructions like "it is", "it was"
  const hasImpersonalMarkers =
    tokens.includes("one") ||
    (tokens.includes("it") && (tokens.includes("is") || tokens.includes("was") || tokens.includes("are") || tokens.includes("were")));
  
  if (hasImpersonalMarkers) {
    return "impersonal";
  }
  
  // Check for third-person pronouns: he, she, it, they, him, her, them, his, hers, their
  const thirdPersonPronouns = [
    "he", "she", "it", "they",
    "him", "her", "them",
    "his", "hers", "their",
  ];
  
  const hasThirdPerson = thirdPersonPronouns.some((pronoun) =>
    tokens.includes(pronoun)
  );
  
  if (hasThirdPerson) {
    return "third_person";
  }
  
  // If no clear signal, return null (caller can handle)
  // In practice, most translations will have a clear subject form
  return null;
}

/**
 * Normalize subject form to match validator expectations.
 * 
 * The validator expects lowercase values: "we", "i", "you", "third_person", "impersonal"
 * 
 * @param detected - Detected subject form (may be "I" with capital)
 * @returns Normalized subject form string
 */
export function normalizeSubjectForm(
  detected: SubjectForm | null
): string | null {
  if (!detected) {
    return null;
  }
  
  // Normalize "I" to "i" for consistency with validator
  if (detected === "I") {
    return "i";
  }
  
  return detected;
}
