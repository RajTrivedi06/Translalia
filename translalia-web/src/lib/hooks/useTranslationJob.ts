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
  readyLines?: unknown[];
  edgeState?: "no-job" | "in-progress" | "completed" | "failed";
}

interface UseTranslationJobOptions {
  pollIntervalMs?: number;
  advanceOnPoll?: boolean;
  enabled?: boolean;
}

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 4000;
const POLLS_BEFORE_SLOWDOWN = 5;

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
    advanceOnPoll = false,
    enabled = true,
    pollIntervalMs,
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
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;

      if (
        data?.job?.status === "completed" ||
        data?.job?.status === "failed"
      ) {
        return false;
      }

      // If caller specified a fixed interval, use it.
      if (pollIntervalMs !== undefined) {
        return pollIntervalMs;
      }

      // Adaptive backoff: fast for first N polls, then slow down.
      // dataUpdateCount approximates how many successful fetches have occurred.
      const fetchCount = query.state.dataUpdateCount;
      if (fetchCount < POLLS_BEFORE_SLOWDOWN) {
        return FAST_POLL_MS;
      }
      return SLOW_POLL_MS;
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });
}
