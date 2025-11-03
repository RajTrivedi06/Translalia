"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GuideAnswers } from "@/store/guideSlice";
import {
  updateGuideState,
  getGuideState,
} from "@/server/guide/updateGuideState";

// Poem analysis interfaces removed

interface ApiError {
  error?: {
    code: string;
    message: string;
    details?: string;
    upstream?: string;
  };
}

interface SaveAnswerParams {
  threadId: string;
  questionKey: keyof GuideAnswers;
  value: any;
}

// useAnalyzePoem function removed - no longer needed

/**
 * Hook to save a single answer to the guide flow
 */
export function useSaveAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, questionKey, value }: SaveAnswerParams) => {
      const result = await updateGuideState(threadId, {
        [questionKey]: value,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate guide state query for this thread
      queryClient.invalidateQueries({
        queryKey: ["guide-state", variables.threadId],
      });
    },
  });
}

/**
 * Hook to fetch current guide answers from Supabase
 */
export function useGuideState(threadId: string | undefined) {
  return useQuery({
    queryKey: ["guide-state", threadId],
    queryFn: async () => {
      if (!threadId) {
        throw new Error("No threadId provided");
      }

      const result = await getGuideState(threadId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.answers;
    },
    enabled: !!threadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to save multiple answers at once (batch update)
 */
export function useSaveMultipleAnswers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      updates,
    }: {
      threadId: string;
      updates: Partial<GuideAnswers>;
    }) => {
      const result = await updateGuideState(threadId, updates);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["guide-state", variables.threadId],
      });
    },
  });
}
