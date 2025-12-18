"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkshopLine } from "@/app/api/workshop/save-line/route";
import { createBrowserClient } from "@/lib/supabaseBrowser";

import type { LineTranslationResponse } from "@/types/lineTranslation";

interface SaveLineParams {
  threadId: string;
  lineIndex: number;
  originalLine?: string;
  // Line translation with selected variant
  variant: 1 | 2 | 3;
  lineTranslation: LineTranslationResponse;
}

interface SaveLineResponse {
  ok: boolean;
  translatedLine: string;
  lineIndex: number;
}

/**
 * Hook to save a selected line-variant translation
 */
export function useSaveLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      lineIndex,
      originalLine,
      variant,
      lineTranslation,
    }: SaveLineParams) => {
      const body: Record<string, unknown> = {
        threadId,
        lineIndex,
        originalLine,
        variant,
        lineTranslation,
      };

      const res = await fetch("/api/workshop/save-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      return res.json() as Promise<SaveLineResponse>;
    },
    onSuccess: (_, variables) => {
      // Invalidate workshop state query for this thread
      queryClient.invalidateQueries({
        queryKey: ["workshop-state", variables.threadId],
      });
    },
  });
}

/**
 * Hook to fetch saved workshop state from Supabase
 * Returns all completed lines for the current thread
 */
export function useWorkshopState(threadId: string | undefined) {
  return useQuery({
    queryKey: ["workshop-state", threadId],
    queryFn: async () => {
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
      const workshopLines =
        (state.workshop_lines as Record<number, WorkshopLine>) || {};

      return workshopLines;
    },
    enabled: !!threadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get a specific line's saved state
 */
export function useWorkshopLine(
  threadId: string | undefined,
  lineIndex: number
) {
  const { data: workshopState } = useWorkshopState(threadId);

  if (!workshopState || workshopState[lineIndex] === undefined) {
    return null;
  }

  return workshopState[lineIndex];
}

/**
 * Hook to check if a line is already completed
 */
export function useIsLineCompleted(
  threadId: string | undefined,
  lineIndex: number
) {
  const { data: workshopState, isLoading } = useWorkshopState(threadId);

  return {
    isCompleted: workshopState?.[lineIndex] !== undefined,
    isLoading,
  };
}

/**
 * Hook to save a manually created translation (from Notebook or Translation Studio)
 */
export function useSaveManualLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      lineIndex,
      originalLine,
      translatedLine,
    }: {
      threadId: string;
      lineIndex: number;
      originalLine: string;
      translatedLine: string;
    }) => {
      const res = await fetch("/api/workshop/save-manual-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          lineIndex,
          originalLine,
          translatedLine,
        }),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      return res.json() as Promise<{
        ok: boolean;
        translatedLine: string;
        lineIndex: number;
      }>;
    },
    onSuccess: (_, variables) => {
      // Invalidate workshop state query for this thread
      queryClient.invalidateQueries({
        queryKey: ["workshop-state", variables.threadId],
      });
    },
  });
}
