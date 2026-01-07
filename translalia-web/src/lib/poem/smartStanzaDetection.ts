/**
 * Smart stanza detection using blank lines and punctuation
 * Falls back to 4-lines-per-segment if no natural breaks found
 */

export interface SmartDetectionBreakpoint {
  lineIndex: number; // 0-indexed line number where segment ends
}

/**
 * Detects natural segment breaks in a poem using:
 * 1. Blank lines (double newlines)
 * 2. Punctuation patterns (periods, exclamation marks, question marks at line end)
 * 3. Falls back to 4-lines-per-segment if no natural breaks
 *
 * @param poemText - The raw poem text
 * @returns Array of line indices where segments end (breakpoints)
 */
export function detectSmartBreakpoints(poemText: string): number[] {
  if (!poemText || !poemText.trim()) {
    return [];
  }

  // Get all non-empty lines with their indices
  const allLines = poemText.split("\n");
  const nonEmptyLines: Array<{ line: string; originalIndex: number }> = [];

  allLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      nonEmptyLines.push({ line: trimmed, originalIndex: idx });
    }
  });

  if (nonEmptyLines.length === 0) {
    return [];
  }

  const breakpoints: number[] = [];
  const SENTENCE_END_PATTERN = /[.!?]$/;

  // First pass: detect blank lines (double newlines)
  let lastNonEmptyIndex = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim().length > 0) {
      // Check if there was a gap (blank line) before this line
      if (lastNonEmptyIndex >= 0 && i - lastNonEmptyIndex > 1) {
        // Found a blank line - add breakpoint before this line
        const lineIndex = nonEmptyLines.findIndex(
          (nl) => nl.originalIndex === i
        );
        if (lineIndex > 0) {
          // Breakpoint is after the previous non-empty line
          const prevLineIndex = nonEmptyLines[lineIndex - 1].originalIndex;
          const breakpointIndex = nonEmptyLines.findIndex(
            (nl) => nl.originalIndex === prevLineIndex
          );
          if (breakpointIndex >= 0 && !breakpoints.includes(breakpointIndex)) {
            breakpoints.push(breakpointIndex);
          }
        }
      }
      lastNonEmptyIndex = i;
    }
  }

  // Second pass: detect sentence endings (if no blank lines found or to refine)
  if (breakpoints.length === 0) {
    // Look for sentence-ending punctuation
    for (let i = 0; i < nonEmptyLines.length - 1; i++) {
      const currentLine = nonEmptyLines[i].line;
      if (SENTENCE_END_PATTERN.test(currentLine)) {
        // This line ends with sentence punctuation
        // Consider adding a breakpoint here
        if (!breakpoints.includes(i)) {
          breakpoints.push(i);
        }
      }
    }
  }

  // If still no breakpoints found, use 4-lines-per-segment as fallback
  if (breakpoints.length === 0) {
    const LINES_PER_SEGMENT = 4;
    for (let i = LINES_PER_SEGMENT - 1; i < nonEmptyLines.length - 1; i += LINES_PER_SEGMENT) {
      breakpoints.push(i);
    }
  }

  // Sort and remove duplicates
  return [...new Set(breakpoints)].sort((a, b) => a - b);
}

/**
 * Converts breakpoints to segment assignments
 * @param poemText - The raw poem text
 * @param breakpoints - Array of line indices where segments end
 * @returns Map of line index -> segment number (1-indexed)
 */
export function breakpointsToSegments(
  poemText: string,
  breakpoints: number[]
): Map<number, number> {
  const allLines = poemText.split("\n");
  const nonEmptyLines: Array<{ line: string; originalIndex: number }> = [];

  allLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      nonEmptyLines.push({ line: trimmed, originalIndex: idx });
    }
  });

  const assignment = new Map<number, number>();
  let currentSegment = 1;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    assignment.set(i, currentSegment);
    // If this is a breakpoint, next line starts a new segment
    if (breakpoints.includes(i) && i < nonEmptyLines.length - 1) {
      currentSegment++;
    }
  }

  return assignment;
}

