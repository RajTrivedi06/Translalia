/**
 * Chunk detection utilities for poem segmentation
 *
 * Chunks are functional divisions for LLM processing, not literary divisions.
 * They split at semantic boundaries (colons, periods, full stops) while
 * aiming for ~4 lines per chunk to optimize processing speed.
 */

export interface Chunk {
  number: number;
  text: string;
  lines: string[];
  lineCount: number;
  startLineIndex: number; // Index in raw line space (includes blank lines)
}

export interface ChunkDetectionResult {
  chunks: Chunk[];
  totalChunks: number;
  detectionMethod: "local" | "ai" | "fallback";
  reasoning?: string; // Optional reasoning from AI detection
}

/**
 * Local chunk detection using semantic boundaries.
 *
 * This function:
 * - Splits poem at semantic boundaries (colons, periods, full stops) when possible
 * - Aims for ~4 lines per chunk for optimal LLM processing
 * - Falls back to double newlines if no semantic boundaries found
 * - Preserves raw line structure (including blank lines) for consistent indexing
 * - Maps each chunk to its lines and calculates startLineIndex in raw line space
 *
 * @param poemText - The raw poem text
 * @returns ChunkDetectionResult with detected chunks
 */
export function detectChunksLocal(poemText: string): ChunkDetectionResult {
  // Trim leading/trailing whitespace but preserve internal structure
  const trimmed = poemText.trim();

  // Split the entire poem into raw lines (preserving all lines including blanks)
  const allRawLines = poemText.split("\n");
  const nonEmptyLines = allRawLines
    .map((line, idx) => ({ line: line.trim(), originalIdx: idx }))
    .filter(({ line }) => line.length > 0);

  if (nonEmptyLines.length === 0) {
    return {
      chunks: [],
      totalChunks: 0,
      detectionMethod: "local",
    };
  }

  const chunks: Chunk[] = [];
  const TARGET_LINES_PER_CHUNK = 4;
  const MIN_LINES_PER_CHUNK = 2;
  const MAX_LINES_PER_CHUNK = 6;

  let currentChunkLines: Array<{ line: string; originalIdx: number }> = [];
  let chunkNumber = 1;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const { line, originalIdx } = nonEmptyLines[i];
    currentChunkLines.push({ line, originalIdx });

    // Check if we should end the chunk at this line
    const shouldEndChunk =
      // We've reached target size
      (currentChunkLines.length >= TARGET_LINES_PER_CHUNK &&
        // And this line ends with a semantic boundary
        /[.:;!?]\s*$/.test(line)) ||
      // Or we've exceeded max size (force split)
      currentChunkLines.length >= MAX_LINES_PER_CHUNK ||
      // Or we're at the last line
      i === nonEmptyLines.length - 1;

    if (shouldEndChunk && currentChunkLines.length >= MIN_LINES_PER_CHUNK) {
      // Create chunk from accumulated lines
      const startLineIndex = currentChunkLines[0].originalIdx;
      const chunkText = currentChunkLines.map(({ line }) => line).join("\n");
      const lines = currentChunkLines.map(({ line }) => line);

      chunks.push({
        number: chunkNumber++,
        text: chunkText,
        lines,
        lineCount: lines.length,
        startLineIndex,
      });

      currentChunkLines = [];
    }
  }

  // Handle any remaining lines that didn't form a complete chunk
  if (currentChunkLines.length > 0) {
    // If we have leftover lines, merge them into the last chunk if it exists and is small
    if (
      chunks.length > 0 &&
      chunks[chunks.length - 1].lineCount < MAX_LINES_PER_CHUNK
    ) {
      const lastChunk = chunks[chunks.length - 1];
      const additionalLines = currentChunkLines.map(({ line }) => line);
      lastChunk.lines.push(...additionalLines);
      lastChunk.lineCount += additionalLines.length;
      lastChunk.text = lastChunk.lines.join("\n");
    } else {
      // Otherwise create a new chunk
      const startLineIndex = currentChunkLines[0].originalIdx;
      const chunkText = currentChunkLines.map(({ line }) => line).join("\n");
      const lines = currentChunkLines.map(({ line }) => line);

      chunks.push({
        number: chunkNumber,
        text: chunkText,
        lines,
        lineCount: lines.length,
        startLineIndex,
      });
    }
  }

  // Fallback: If no chunks were created (shouldn't happen), create one with all lines
  if (chunks.length === 0 && nonEmptyLines.length > 0) {
    const startLineIndex = nonEmptyLines[0].originalIdx;
    const allLines = nonEmptyLines.map(({ line }) => line);
    const chunkText = allLines.join("\n");

    chunks.push({
      number: 1,
      text: chunkText,
      lines: allLines,
      lineCount: allLines.length,
      startLineIndex,
    });
  }

  return {
    chunks,
    totalChunks: chunks.length,
    detectionMethod: "local",
  };
}

// Legacy export for backward compatibility during migration
export type Stanza = Chunk;
export interface StanzaDetectionResult {
  stanzas: Chunk[];
  totalStanzas: number;
  detectionMethod: "local" | "ai" | "fallback";
  reasoning?: string;
}

export function detectStanzasLocal(poemText: string): StanzaDetectionResult {
  const result = detectChunksLocal(poemText);
  return {
    stanzas: result.chunks,
    totalStanzas: result.totalChunks,
    detectionMethod: result.detectionMethod,
    reasoning: result.reasoning,
  };
}
