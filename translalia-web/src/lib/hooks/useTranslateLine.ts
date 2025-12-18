import { useMutation } from "@tanstack/react-query";
import type { LineTranslationResponse } from "@/types/lineTranslation";

export interface TranslateLineParams {
  threadId: string;
  lineIndex: number;
  lineText: string;
  fullPoem: string;
  stanzaIndex?: number;
  prevLine?: string;
  nextLine?: string;
}

/**
 * Hook to trigger line-level translation with alignment.
 *
 * This replaces the old per-word workflow with a single API call
 * that generates 3 full-line translation variants with sub-token alignment.
 */
export function useTranslateLine() {
  return useMutation({
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      const response = await fetch("/api/workshop/translate-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: params.threadId,
          lineIndex: params.lineIndex,
          lineText: params.lineText,
          fullPoem: params.fullPoem,
          stanzaIndex: params.stanzaIndex,
          prevLine: params.prevLine,
          nextLine: params.nextLine,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to translate line");
      }

      const result: LineTranslationResponse = await response.json();
      return result;
    },
  });
}
