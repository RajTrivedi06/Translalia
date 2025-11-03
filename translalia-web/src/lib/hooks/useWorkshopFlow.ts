"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GenerateOptionsResponse } from "@/app/api/workshop/generate-options/route";
import { WorkshopLine } from "@/app/api/workshop/save-line/route";
import { createBrowserClient } from "@/lib/supabaseBrowser";

interface GenerateOptionsParams {
  threadId: string;
  lineIndex: number;
  lineText: string;
}

interface SaveLineParams {
  threadId: string;
  lineIndex: number;
  originalLine?: string;
  selections: Array<{
    position: number;
    selectedWord: string;
  }>;
}

interface SaveLineResponse {
  ok: boolean;
  translatedLine: string;
  lineIndex: number;
}

/**
 * Hook to generate translation options for all words in a line
 */
export function useGenerateOptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      lineIndex,
      lineText,
    }: GenerateOptionsParams) => {
      const res = await fetch("/api/workshop/generate-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, lineIndex, lineText }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      return res.json() as Promise<GenerateOptionsResponse>;
    },
    onSuccess: (data, variables) => {
      // Invalidate workshop state query for this thread
      queryClient.invalidateQueries({
        queryKey: ["workshop-state", variables.threadId],
      });
    },
  });
}

/**
 * Hook to save user's word selections and compile the translated line
 */
export function useSaveLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      lineIndex,
      originalLine,
      selections,
    }: SaveLineParams) => {
      const res = await fetch("/api/workshop/save-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, lineIndex, originalLine, selections }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
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

      const state = (data?.state as any) || {};
      const workshopLines = (state.workshop_lines as Record<
        number,
        WorkshopLine
      >) || {};

      return workshopLines;
    },
    enabled: !!threadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get a specific line's saved state
 */
export function useWorkshopLine(threadId: string | undefined, lineIndex: number) {
  const { data: workshopState } = useWorkshopState(threadId);

  if (!workshopState || workshopState[lineIndex] === undefined) {
    return null;
  }

  return workshopState[lineIndex];
}

/**
 * Hook to check if a line is already completed
 */
export function useIsLineCompleted(threadId: string | undefined, lineIndex: number) {
  const { data: workshopState, isLoading } = useWorkshopState(threadId);

  return {
    isCompleted: workshopState?.[lineIndex] !== undefined,
    isLoading,
  };
}
