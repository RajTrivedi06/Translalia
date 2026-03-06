import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabaseClient";
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
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const noCacheInit: RequestInit = {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      "Cache-Control": "no-store",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
  const {
    advanceOnPoll = true,
    enabled = true,
    pollIntervalMs = 1500,
  } = options;

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

      // Only stop polling on terminal statuses.
      // IMPORTANT: Do NOT stop when job is null — the backend may not have
      // queued the job yet (race between init and first poll). Keep polling
      // so the UI picks up the job once it appears.
      if (
        data?.job?.status === "completed" ||
        data?.job?.status === "failed"
      ) {
        return false;
      }

      return pollIntervalMs;
    },
    // Retry on transient fetch errors instead of giving up
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchIntervalInBackground: true, // Keep polling even when tab is in background
  });
}
