import { useQuery } from "@tanstack/react-query";
import { FEATURE_VERIFICATION_CONTEXT } from "@/lib/featureFlags";

interface ContextNotesParams {
  threadId: string;
  lineIndex: number;
  tokenIndex: number;
  enabled?: boolean;
  wordOptionsForApi?: Array<{
    source: string;
    order: number;
    options: string[];
    pos?: string;
  }>;
}

/**
 * Hook to fetch contextual notes for a specific word option
 * These are shown to users to help them understand translation choices
 */
export function useContextNotes({
  threadId,
  lineIndex,
  tokenIndex,
  enabled = true,
  wordOptionsForApi,
}: ContextNotesParams) {
  return useQuery({
    queryKey: ["context-notes", threadId, lineIndex, tokenIndex],
    queryFn: async () => {
      const response = await fetch("/api/verification/context-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          lineIndex,
          tokenIndex,
          wordOptions: wordOptionsForApi,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch context notes");
      }

      const data = await response.json();
      return data as {
        success: boolean;
        notes: string[];
        cached: boolean;
      };
    },
    enabled:
      enabled &&
      !!threadId &&
      FEATURE_VERIFICATION_CONTEXT &&
      lineIndex >= 0 &&
      tokenIndex >= 0,
    staleTime: 3600000, // 1 hour - notes don't change
    gcTime: 7200000, // 2 hours - keep in cache
    retry: 1, // Only retry once if it fails
  });
}
