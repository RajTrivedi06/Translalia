import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@/lib/supabaseBrowser";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";

/**
 * Hook to fetch poem stanza structure from chat_threads.state
 *
 * Returns the stanza structure if available, or null if not yet detected.
 * This enables backward compatibility - if stanzas aren't detected, components
 * can fall back to the old line-splitting behavior.
 */
export function usePoemStanzas(threadId: string | undefined) {
  return useQuery({
    queryKey: ["poem-stanzas", threadId],
    queryFn: async (): Promise<{
      stanzas: StanzaDetectionResult | null;
      rawPoem: string | null;
    }> => {
      if (!threadId) {
        throw new Error("No threadId provided");
      }

      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("chat_threads")
        .select("state")
        .eq("id", threadId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const state = (data?.state as Record<string, unknown>) || {};
      const poemStanzas = (state.poem_stanzas as StanzaDetectionResult) || null;
      const rawPoem = (state.raw_poem as string) || null;

      return {
        stanzas: poemStanzas,
        rawPoem,
      };
    },
    enabled: !!threadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
