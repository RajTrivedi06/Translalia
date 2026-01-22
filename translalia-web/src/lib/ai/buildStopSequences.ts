/**
 * ISS-013: Safe Stop Sequences Builder
 * 
 * Builds stop sequences that are safe for JSON response formats.
 * Stop sequences should only stop trailing non-JSON (fences, commentary),
 * never truncate valid JSON mid-structure.
 */

export type ResponseFormatType = "json_object" | "json_schema" | "none";

/**
 * Build safe stop sequences for a given model and response format.
 * 
 * Conservative approach:
 * - Only use stops that appear AFTER JSON (fences, markers, commentary)
 * - Never use stops like `}` or `]` which would truncate JSON
 * - Keep list short (2-3 max)
 * 
 * Current candidates (only if evidence shows these appear in outputs):
 * - "```" - stop before code fences / after JSON
 * - "\n```" - more specific (newline before fence)
 * - "\n\n---" - only if prompts use separators and outputs continue with prose
 * - "\n\nExplanation:" or "\n\nRationale:" - only if seen in real outputs
 * 
 * IMPORTANT: Do NOT add speculative stops that might appear inside normal JSON strings.
 * 
 * @param model - Model name (for future model-specific logic)
 * @param responseFormatType - Type of response format ("json_object", "json_schema", or "none")
 * @returns Array of stop sequences, or undefined if none should be used
 */
export function buildStopSequences(
  model: string,
  responseFormatType: ResponseFormatType
): string[] | undefined {
  const enableStopSequences = process.env.ENABLE_STOP_SEQUENCES === "1";
  
  // Default: no stop sequences (conservative)
  if (!enableStopSequences) {
    return undefined;
  }
  
  // Only apply stops for JSON response formats
  if (responseFormatType === "none") {
    return undefined;
  }
  
  // Conservative stop sequences (only patterns that appear AFTER JSON)
  // These are safe because they won't appear inside valid JSON strings
  const stopSequences: string[] = [];
  
  // 1. Code fence markers (most common trailing pattern)
  // Only stop on newline + fence to avoid stopping mid-JSON
  stopSequences.push("\n```");
  
  // 2. Triple backticks (if model sometimes adds fences without newline)
  // This is riskier but still safe for JSON (backticks don't appear in JSON)
  stopSequences.push("```");
  
  // Note: We do NOT include:
  // - "}" or "]" (would truncate JSON)
  // - "\n\n---" (too speculative, might appear in JSON strings)
  // - "\n\nExplanation:" (too speculative, might appear in JSON strings)
  
  return stopSequences.length > 0 ? stopSequences : undefined;
}

/**
 * Check if a parse error might be due to stop sequence truncation.
 * 
 * @param parseError - Error from JSON.parse()
 * @param text - The text that failed to parse
 * @returns True if error suggests truncation (incomplete JSON)
 */
export function isLikelyTruncationError(
  parseError: unknown,
  text: string
): boolean {
  if (!parseError || typeof parseError !== "object") return false;
  
  const error = parseError as { message?: string; name?: string };
  const message = error.message || "";
  
  // Check for common JSON truncation error patterns
  const truncationPatterns = [
    /unexpected end of json/i,
    /unexpected end of data/i,
    /unexpected token.*end/i,
    /unexpected end of input/i,
    /expected.*but found end/i,
  ];
  
  const hasTruncationPattern = truncationPatterns.some((pattern) =>
    pattern.test(message)
  );
  
  // Also check if text ends abruptly (no closing brace/bracket)
  const trimmed = text.trim();
  const endsAbruptly =
    (trimmed.endsWith("{") || trimmed.endsWith("[") || trimmed.endsWith(",")) &&
    !trimmed.endsWith("}") &&
    !trimmed.endsWith("]");
  
  return hasTruncationPattern || endsAbruptly;
}
