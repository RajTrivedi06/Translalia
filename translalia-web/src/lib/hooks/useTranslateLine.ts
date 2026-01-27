import { useMutation } from "@tanstack/react-query";
import * as React from "react";
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
  /** Optional model override - if provided, use this model instead of the one in DB */
  modelOverride?: string;
  /** Optional AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/**
 * Hook to trigger line-level translation with alignment.
 *
 * Routes to different endpoints based on the selected translation method:
 * - method-1: P1 Literalness Spectrum (/api/workshop/translate-line)
 * - method-2: P6-P8 Recipe-Driven Variants (/api/workshop/translate-line-with-recipes)
 *
 * Both endpoints return identical LineTranslationResponse structure with word-level alignments.
 *
 * Supports AbortController for request cancellation when model changes or line switches.
 */
export function useTranslateLine() {
  const translationMethod = useGuideStore(
    (s) => s.answers.translationMethod ?? "method-2"
  );
  
  // Track current abort controller for cancellation
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async (
      params: TranslateLineParams
    ): Promise<LineTranslationResponse> => {
      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      // Use provided signal or our own controller's signal
      const signal = params.signal ?? controller.signal;

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
          modelOverride: params.modelOverride,
        }),
        signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to translate line");
      }

      const result: LineTranslationResponse = await response.json();
      
      // Clear controller ref on success
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      
      return result;
    },
  });

  // Helper to cancel current request
  const cancelCurrentRequest = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    ...mutation,
    cancelCurrentRequest,
  };
}
