import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { FEATURE_VERIFICATION_CONTEXT } from "@/lib/featureFlags";

/**
 * Pre-fetches context notes for all tokens in a line when line is selected
 * Improves perceived performance when users expand notes
 */
export function usePrefetchContext(
  threadId: string | undefined,
  lineIndex: number | null | undefined,
  tokenCount: number,
  wordOptionsForLine?: Array<{
    original: string;
    position: number;
    options: string[];
    partOfSpeech?: string;
  }>
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!threadId || lineIndex === null || lineIndex === undefined) return;
    if (!FEATURE_VERIFICATION_CONTEXT) return;

    // Prepare optional API wordOptions mapping for unsaved lines
    const wordOptionsForApi = wordOptionsForLine
      ? wordOptionsForLine.map((w) => ({
          source: w.original,
          order: w.position,
          options: w.options,
          pos: w.partOfSpeech,
        }))
      : undefined;

    // Prefetch context for all tokens in the line
    for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex++) {
      queryClient.prefetchQuery({
        queryKey: ["context-notes", threadId, lineIndex, tokenIndex],
        queryFn: async () => {
          const response = await fetch("/api/verification/context-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              lineIndex,
              tokenIndex,
              wordOptions: wordOptionsForApi,
            }),
          });
          return response.json();
        },
        staleTime: 3600000, // 1 hour
      });
    }
  }, [threadId, lineIndex, tokenCount, queryClient, wordOptionsForLine]);
}
