// Simple heuristics to detect untranslated output when we expect English.
// We treat Arabic/Urdu script blocks as "not translated" in this context.

const ARABIC_URDU = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g; // Arabic script ranges

export function arabicScriptRatio(text: string): number {
  if (!text) return 0;
  const total = text.length;
  const matches = text.match(ARABIC_URDU)?.length ?? 0;
  return total ? matches / total : 0;
}

export function looksUntranslatedToEnglish(
  targetVariety: string,
  lines: string[]
): boolean {
  const expectsEnglish = /english/i.test(targetVariety || "");
  if (!expectsEnglish) return false;
  const joined = (lines || []).join("\n");
  // If ≥20% of characters are Arabic/Urdu script, assume untranslated.
  return arabicScriptRatio(joined) >= 0.2;
}
