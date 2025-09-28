// src/components/workspace/v2/_utils/useExplodeTokens.ts

import { useMemo } from "react";
import { ExplodedLine } from "@/types/workshop";
import { explodeLines, getLineSelectionSummary, applySelectionsToLine } from "./tokenize";
import { useWorkspace } from "@/store/workspace";

export type ExplodeTokensResult = {
  explodedLines: ExplodedLine[];
  loading: boolean;
  error: string | null;
  stats: {
    totalLines: number;
    totalTokens: number;
    tokenizedLines: number;
    hasSelections: boolean;
  };
  helpers: {
    getLineSelectionSummary: (lineId: string) => {
      hasSelections: boolean;
      selectedCount: number;
      totalCount: number;
    };
    applySelectionsToLine: (lineId: string) => string;
    getCurrentSelections: () => Record<string, Record<string, string>>;
  };
};

/**
 * Hook to explode source lines into tokenized format for workshop editing
 */
export function useExplodeTokens(sourceLines: string[]): ExplodeTokensResult {
  const tokensSelections = useWorkspace((s) => s.tokensSelections);

  // Memoized tokenization to avoid re-processing on every render
  const explodedLines = useMemo(() => {
    try {
      if (!sourceLines || sourceLines.length === 0) {
        return [];
      }

      console.log("[useExplodeTokens] Tokenizing", sourceLines.length, "lines");
      return explodeLines(sourceLines);
    } catch (error) {
      console.error("[useExplodeTokens] Failed to tokenize:", error);
      return [];
    }
  }, [sourceLines]);

  // Stats about the tokenization
  const stats = useMemo(() => {
    const totalLines = sourceLines.length;
    const tokenizedLines = explodedLines.length;
    const totalTokens = explodedLines.reduce((sum, line) => sum + line.tokens.length, 0);
    const hasSelections = Object.keys(tokensSelections).length > 0;

    return {
      totalLines,
      totalTokens,
      tokenizedLines,
      hasSelections,
    };
  }, [sourceLines.length, explodedLines, tokensSelections]);

  // Helper functions
  const helpers = useMemo(() => ({
    getLineSelectionSummary: (lineId: string) => {
      const explodedLine = explodedLines.find(line => line.lineId === lineId);
      if (!explodedLine) {
        return { hasSelections: false, selectedCount: 0, totalCount: 0 };
      }
      return getLineSelectionSummary(explodedLine, tokensSelections);
    },

    applySelectionsToLine: (lineId: string) => {
      const explodedLine = explodedLines.find(line => line.lineId === lineId);
      if (!explodedLine) {
        return "";
      }
      return applySelectionsToLine(explodedLine, tokensSelections);
    },

    getCurrentSelections: () => tokensSelections,
  }), [explodedLines, tokensSelections]);

  return {
    explodedLines,
    loading: false, // Since this is synchronous tokenization
    error: null,    // We handle errors internally
    stats,
    helpers,
  };
}