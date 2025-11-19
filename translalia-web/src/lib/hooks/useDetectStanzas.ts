import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";

export interface DetectStanzasParams {
  threadId: string;
  poemText: string;
  metadata?: {
    title?: string;
    author?: string;
    style?: string;
  };
}

/**
 * Hook to trigger AI-assisted stanza detection
 *
 * This is a manual action - user can click "Detect stanzas with AI" to
 * get better detection for complex poems (sonnets, free verse, etc.)
 */
export function useDetectStanzas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: DetectStanzasParams
    ): Promise<StanzaDetectionResult> => {
      const response = await fetch("/api/workshop/detect-stanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: params.threadId,
          poemText: params.poemText,
          metadata: params.metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to detect stanzas");
      }

      const result: StanzaDetectionResult = await response.json();
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate poem-stanzas query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ["poem-stanzas", variables.threadId],
      });
    },
  });
}
