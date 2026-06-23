import { useQuery } from "@tanstack/react-query";
import { useThreadId } from "@/hooks/useThreadId";
import type { ReflectionArtifactsResponse } from "@/lib/reflection/artifacts";

/**
 * Fetch persisted editing-rail AI artifacts for the current thread.
 * Used to hydrate Translation Insights, Refine & Rhyme, and Journey Summary on refresh.
 */
export function useReflectionArtifacts() {
  const threadId = useThreadId();

  return useQuery<ReflectionArtifactsResponse>({
    queryKey: ["reflection-artifacts", threadId],
    queryFn: async () => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch(
        `/api/reflection/artifacts?threadId=${encodeURIComponent(threadId)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || "Failed to fetch reflection artifacts"
        );
      }

      return response.json();
    },
    enabled: !!threadId,
    staleTime: 30000,
  });
}
