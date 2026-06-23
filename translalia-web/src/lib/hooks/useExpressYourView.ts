import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useThreadId } from "@/hooks/useThreadId";

export interface ExpressYourView {
  expressYourView: string | null;
}

/**
 * Fetch the student's "Express Your View" reflection for the current thread.
 * Stored as a single string at chat_threads.state.express_your_view.
 */
export function useExpressYourView() {
  const threadId = useThreadId();

  return useQuery<ExpressYourView>({
    queryKey: ["express-your-view", threadId],
    queryFn: async () => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch(
        `/api/reflection/express-your-view?threadId=${encodeURIComponent(threadId)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to fetch reflection");
      }

      return response.json();
    },
    enabled: !!threadId,
    staleTime: 30000,
  });
}

/**
 * Persist the student's "Express Your View" reflection for the current thread.
 */
export function useSaveExpressYourView() {
  const threadId = useThreadId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expressYourView: string | null) => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch("/api/reflection/express-your-view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId, expressYourView }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save reflection");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["express-your-view", threadId],
      });
    },
  });
}
