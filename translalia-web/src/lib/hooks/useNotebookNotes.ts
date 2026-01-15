import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useThreadId } from "@/hooks/useThreadId";

export interface NotebookNotes {
  threadNote: string | null;
  lineNotes: Record<number, string>;
  updatedAt: string | null;
}

/**
 * Hook to fetch notebook notes for the current thread
 */
export function useNotebookNotes() {
  const threadId = useThreadId();

  return useQuery<NotebookNotes>({
    queryKey: ["notebook-notes", threadId],
    queryFn: async () => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch(
        `/api/notebook/notes?threadId=${encodeURIComponent(threadId)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to fetch notes");
      }

      return response.json();
    },
    enabled: !!threadId,
    staleTime: 30000, // Consider fresh for 30 seconds
  });
}

/**
 * Hook to save notebook notes
 */
export function useSaveNotebookNotes() {
  const threadId = useThreadId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      threadNote?: string | null;
      lineNotes?: Record<number, string>;
    }) => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch("/api/notebook/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          ...data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save notes");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notes
      queryClient.invalidateQueries({
        queryKey: ["notebook-notes", threadId],
      });
    },
  });
}

/**
 * Hook to save a single line note
 */
export function useSaveLineNote() {
  const threadId = useThreadId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { lineIndex: number; content: string | null }) => {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      const response = await fetch("/api/notebook/notes/line", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          ...data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save line note");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notes
      queryClient.invalidateQueries({
        queryKey: ["notebook-notes", threadId],
      });
    },
  });
}
