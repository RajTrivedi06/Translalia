/**
 * React Query hook for fetching poem-level (macro) suggestions
 *
 * Helps students explore their translation at the whole-poem level
 * after completing line-by-line work in the Workshop phase.
 */

import { useMutation } from "@tanstack/react-query";
import type {
  PoemSuggestionsRequest,
  PoetryMacroCritiqueResponse,
} from "@/types/poemSuggestion";

export function usePoetryMacroCritique() {
  return useMutation<PoetryMacroCritiqueResponse, Error, PoemSuggestionsRequest>(
    {
      mutationFn: async (request: PoemSuggestionsRequest) => {
        const response = await fetch(
          "/api/notebook/poem-suggestions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              threadId: request.threadId,
              sourcePoem: request.sourcePoem,
              translationPoem: request.translationPoem,
              guideAnswers: request.guideAnswers,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error?.message || "Failed to generate suggestions"
          );
        }

        return response.json();
      },
    }
  );
}
