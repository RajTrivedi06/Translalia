// src/components/workspace/v2/_utils/tokenize.ts

import { ExplodedToken, ExplodedLine, TokenOption, DialectTag } from "@/types/workshop";

// Simple lexicon for deterministic mock tokenization
const LEXICON: Record<string, TokenOption[]> = {
  "the": [
    { id: "the-std", label: "the", dialect: "Std", from: "lex" },
    { id: "the-scots", label: "tae", dialect: "Scots", from: "lex" },
    { id: "the-casual", label: "da", dialect: "Casual", from: "lex" },
  ],
  "and": [
    { id: "and-std", label: "and", dialect: "Std", from: "lex" },
    { id: "and-scots", label: "an'", dialect: "Scots", from: "lex" },
    { id: "and-casual", label: "&", dialect: "Casual", from: "lex" },
  ],
  "love": [
    { id: "love-std", label: "love", dialect: "Std", from: "lex" },
    { id: "love-scots", label: "luve", dialect: "Scots", from: "lex" },
    { id: "love-creole", label: "lub", dialect: "Creole", from: "lex" },
    { id: "love-casual", label: "luv", dialect: "Casual", from: "lex" },
  ],
  "you": [
    { id: "you-std", label: "you", dialect: "Std", from: "lex" },
    { id: "you-scots", label: "ye", dialect: "Scots", from: "lex" },
    { id: "you-casual", label: "u", dialect: "Casual", from: "lex" },
  ],
  "beautiful": [
    { id: "beautiful-std", label: "beautiful", dialect: "Std", from: "lex" },
    { id: "beautiful-scots", label: "bonnie", dialect: "Scots", from: "lex" },
    { id: "beautiful-casual", label: "gorgeous", dialect: "Casual", from: "lex" },
  ],
  "heart": [
    { id: "heart-std", label: "heart", dialect: "Std", from: "lex" },
    { id: "heart-scots", label: "hert", dialect: "Scots", from: "lex" },
    { id: "heart-casual", label: "💖", dialect: "Casual", from: "lex" },
  ],
  "very": [
    { id: "very-std", label: "very", dialect: "Std", from: "lex" },
    { id: "very-scots", label: "gey", dialect: "Scots", from: "lex" },
    { id: "very-casual", label: "super", dialect: "Casual", from: "lex" },
  ],
  "my": [
    { id: "my-std", label: "my", dialect: "Std", from: "lex" },
    { id: "my-scots", label: "ma", dialect: "Scots", from: "lex" },
    { id: "my-casual", label: "my", dialect: "Casual", from: "lex" },
  ],
  "is": [
    { id: "is-std", label: "is", dialect: "Std", from: "lex" },
    { id: "is-scots", label: "is", dialect: "Scots", from: "lex" },
    { id: "is-casual", label: "'s", dialect: "Casual", from: "lex" },
  ],
};

/**
 * Simple tokenization - splits on word boundaries, preserves punctuation
 */
export function simpleTokenize(text: string): string[] {
  // Split on word boundaries but keep punctuation
  return text
    .split(/(\s+|[.,;:!?])/g)
    .map(token => token.trim())
    .filter(token => token.length > 0);
}

/**
 * Generate stable token ID from surface text and position
 */
export function generateTokenId(surface: string, lineIdx: number, tokenIdx: number): string {
  return `${lineIdx}-${tokenIdx}-${surface.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

/**
 * Get options for a token from lexicon + generate LLM-style alternatives
 */
export function getTokenOptions(surface: string): TokenOption[] {
  const cleanSurface = surface.toLowerCase().replace(/[^a-z]/g, "");

  // Check lexicon first
  const lexiconOptions = LEXICON[cleanSurface] || [];

  // Generate mock LLM options for unknown words
  const llmOptions: TokenOption[] = [];
  if (lexiconOptions.length === 0 && cleanSurface.length > 2) {
    // Mock some creative alternatives
    llmOptions.push(
      { id: `${cleanSurface}-llm-1`, label: surface, dialect: "Std", from: "llm" },
      { id: `${cleanSurface}-llm-2`, label: `${surface}*`, dialect: "Casual", from: "llm" }
    );
  }

  return [...lexiconOptions, ...llmOptions];
}

/**
 * Classify token as word or phrase (simple heuristic)
 */
export function classifyToken(surface: string): "word" | "phrase" {
  return surface.includes(" ") ? "phrase" : "word";
}

/**
 * Explode a single line of text into tokenized format
 */
export function explodeLine(text: string, lineIdx: number): ExplodedLine {
  const tokens = simpleTokenize(text);

  const explodedTokens: ExplodedToken[] = tokens.map((surface, tokenIdx) => {
    const tokenId = generateTokenId(surface, lineIdx, tokenIdx);
    const options = getTokenOptions(surface);
    const kind = classifyToken(surface);

    return {
      tokenId,
      surface,
      kind,
      options,
      selectedOptionId: undefined, // No default selection
    };
  });

  return {
    lineId: `line-${lineIdx}`,
    lineIdx,
    tokens: explodedTokens,
  };
}

/**
 * Explode multiple lines into tokenized format
 */
export function explodeLines(lines: string[]): ExplodedLine[] {
  return lines.map((line, idx) => explodeLine(line, idx));
}

/**
 * Get current selection summary for a line
 */
export function getLineSelectionSummary(
  explodedLine: ExplodedLine,
  selections: Record<string, Record<string, string>>
): { hasSelections: boolean; selectedCount: number; totalCount: number } {
  const lineSelections = selections[explodedLine.lineId] || {};
  const selectedCount = Object.keys(lineSelections).length;
  const totalCount = explodedLine.tokens.filter(t => t.options.length > 1).length;

  return {
    hasSelections: selectedCount > 0,
    selectedCount,
    totalCount,
  };
}

/**
 * Apply selections to exploded line (for preview/export)
 */
export function applySelectionsToLine(
  explodedLine: ExplodedLine,
  selections: Record<string, Record<string, string>>
): string {
  const lineSelections = selections[explodedLine.lineId] || {};

  return explodedLine.tokens
    .map(token => {
      const selectedOptionId = lineSelections[token.tokenId];
      if (selectedOptionId) {
        // Find the selected option
        const selectedOption = token.options.find(opt => opt.id === selectedOptionId);
        if (selectedOption) {
          return selectedOption.label;
        }
      }

      // Fall back to original surface
      return token.surface;
    })
    .join("");
}