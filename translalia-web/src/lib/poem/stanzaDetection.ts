/**
 * Stanza detection utilities for poem segmentation
 */

export interface Stanza {
  number: number;
  text: string;
  lines: string[];
  lineCount: number;
  startLineIndex: number; // Index in raw line space (includes blank lines)
}

export interface StanzaDetectionResult {
  stanzas: Stanza[];
  totalStanzas: number;
  detectionMethod: "local" | "ai" | "fallback";
  reasoning?: string; // Optional reasoning from AI detection
}

/**
 * Local stanza detection using double newlines.
 *
 * This function:
 * - Splits poem by double newlines (with optional whitespace) to identify stanzas
 * - Preserves raw line structure (including blank lines) for consistent indexing
 * - Maps each stanza to its lines and calculates startLineIndex in raw line space
 *
 * @param poemText - The raw poem text
 * @returns StanzaDetectionResult with detected stanzas
 */
export function detectStanzasLocal(poemText: string): StanzaDetectionResult {
  // Trim leading/trailing whitespace but preserve internal structure
  const trimmed = poemText.trim();

  // Split by double newlines (with optional whitespace between)
  // This regex handles: \n\n, \n \n, \n\t\n, etc.
  const rawStanzas = trimmed.split(/\n\s*\n\s*/).filter(Boolean);

  // Split the entire poem into raw lines (preserving all lines including blanks)
  const allRawLines = poemText.split("\n");

  let globalLineIndex = 0;
  const stanzas: Stanza[] = rawStanzas.map((stanzaText, idx) => {
    // Split stanza into lines - preserve all lines including blanks
    const rawLines = stanzaText.split("\n");

    // For display/processing, we can trim lines, but keep original for indexing
    const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);

    // Calculate startLineIndex by finding where this stanza starts in the original poem
    // We need to find the first non-empty line of this stanza in the allRawLines array
    const stanzaFirstLine = rawLines[0]?.trim() || "";
    let foundStartIndex = globalLineIndex;

    // If we have a meaningful first line, try to find it in allRawLines
    if (stanzaFirstLine) {
      for (let i = globalLineIndex; i < allRawLines.length; i++) {
        if (allRawLines[i]?.trim() === stanzaFirstLine) {
          foundStartIndex = i;
          break;
        }
      }
    }

    const stanza: Stanza = {
      number: idx + 1,
      text: stanzaText.replace(/\s+$/, ""), // Remove trailing whitespace but preserve leading
      lines,
      lineCount: lines.length,
      startLineIndex: foundStartIndex,
    };

    // Update global index for next stanza
    // Count all lines (including blanks) up to the end of this stanza
    globalLineIndex = foundStartIndex + rawLines.length;

    return stanza;
  });

  // If no stanzas detected (single stanza poem), create one stanza with all lines
  if (stanzas.length === 0 && trimmed.length > 0) {
    const allLines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return {
      stanzas: [
        {
          number: 1,
          text: trimmed,
          lines: allLines,
          lineCount: allLines.length,
          startLineIndex: 0,
        },
      ],
      totalStanzas: 1,
      detectionMethod: "local",
    };
  }

  return {
    stanzas,
    totalStanzas: stanzas.length,
    detectionMethod: "local",
  };
}
