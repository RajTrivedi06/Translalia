/**
 * Simple client-side stanza utilities
 * Splits poems into 4-line stanzas with no API calls or database storage
 */

export interface SimpleStanza {
  number: number;
  lines: string[];
  text: string;
}

export interface SimplePoemStanzas {
  stanzas: SimpleStanza[];
  totalStanzas: number;
}

/**
 * Splits a poem into 4-line stanzas (client-side, instant)
 * No AI, no API calls, just simple logic
 */
export function splitPoemIntoStanzas(poemText: string): SimplePoemStanzas {
  if (!poemText || !poemText.trim()) {
    return { stanzas: [], totalStanzas: 0 };
  }

  // Split poem into individual lines
  const allLines = poemText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0); // Remove blank lines

  // Group into 4-line stanzas
  const stanzas: SimpleStanza[] = [];
  const LINES_PER_STANZA = 4;

  for (let i = 0; i < allLines.length; i += LINES_PER_STANZA) {
    const stanzaLines = allLines.slice(i, i + LINES_PER_STANZA);

    stanzas.push({
      number: stanzas.length + 1,
      lines: stanzaLines,
      text: stanzaLines.join("\n"),
    });
  }

  return {
    stanzas,
    totalStanzas: stanzas.length,
  };
}

/**
 * Get lines from a specific stanza
 */
export function getLinesFromStanza(stanza: SimpleStanza): string[] {
  return stanza.lines;
}
