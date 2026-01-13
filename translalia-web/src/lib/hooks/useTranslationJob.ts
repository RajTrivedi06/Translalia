import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  TranslationJobProgressSummary,
  TranslationJobState,
  TranslationTickResult,
} from "@/types/translationJob";

interface InitializeTranslationsParams {
  threadId: string;
  runInitialTick?: boolean;
}

interface InitializeTranslationsResponse {
  ok: boolean;
  job: TranslationJobState | null;
  tick: TranslationTickResult | null;
  progress: TranslationJobProgressSummary | null;
}

interface TranslationStatusResponse {
  ok: boolean;
  job: TranslationJobState | null;
  tick: TranslationTickResult | null;
  progress: TranslationJobProgressSummary | null;
}

interface UseTranslationJobOptions {
  pollIntervalMs?: number;
  advanceOnPoll?: boolean;
  enabled?: boolean;
}

async function fetchJSON<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  // Ensure no caching for translation status
  const noCacheInit: RequestInit = {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      "Cache-Control": "no-store",
    },
  };
  const response = await fetch(input, noCacheInit);
  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    const message =
      (errorPayload as { error?: string }).error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

export function useInitializeTranslations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: InitializeTranslationsParams
    ): Promise<InitializeTranslationsResponse> =>
      fetchJSON<InitializeTranslationsResponse>(
        "/api/workshop/initialize-translations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      ),
    onSuccess: (_, variables) => {
      // Immediately invalidate translation status query to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ["translation-job", variables.threadId],
      });
    },
  });
}

export function useTranslationJob(
  threadId: string | undefined,
  options: UseTranslationJobOptions = {}
) {
  const { advanceOnPoll = true, enabled = true } = options;

  return useQuery({
    queryKey: ["translation-job", threadId, advanceOnPoll],
    queryFn: async (): Promise<TranslationStatusResponse> => {
      if (!threadId) {
        throw new Error("threadId is required");
      }
      const params = new URLSearchParams({
        threadId,
        advance: advanceOnPoll ? "true" : "false",
      });
      return fetchJSON<TranslationStatusResponse>(
        `/api/workshop/translation-status?${params.toString()}`
      );
    },
    enabled: Boolean(threadId) && enabled,
    staleTime: 0, // Always consider data stale
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when job is done
      if (
        !data?.job ||
        data.job.status === "completed" ||
        data.job.status === "failed"
      ) {
        return false;
      }
      // Poll every 1.5s while processing (faster updates)
      return 1500;
    },
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchIntervalInBackground: true, // Keep polling even when tab is in background
  });
}
