import { useMutation } from "@tanstack/react-query";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import { useGuideStore } from "@/store/guideSlice";

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
 * Routes to different endpoints based on the selected translation method:
 * - method-1: P1 Literalness Spectrum (/api/workshop/translate-line)
 * - method-2: P6-P8 Recipe-Driven Variants (/api/workshop/translate-line-with-recipes)
 *
 * Both endpoints return identical LineTranslationResponse structure with word-level alignments.
 */
export function useTranslateLine() {
  const translationMethod = useGuideStore(
    (s) => s.answers.translationMethod ?? "method-1"
  );

  return useMutation({
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      // Route to appropriate endpoint based on translation method
      const endpoint =
        translationMethod === "method-2"
          ? "/api/workshop/translate-line-with-recipes"
          : "/api/workshop/translate-line";

      const response = await fetch(endpoint, {
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
