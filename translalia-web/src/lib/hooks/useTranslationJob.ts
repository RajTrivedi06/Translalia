import { useMutation, useQuery } from "@tanstack/react-query";

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
  const response = await fetch(input, init);
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
  });
}

export function useTranslationJob(
  threadId: string | undefined,
  options: UseTranslationJobOptions = {}
) {
  const {
    pollIntervalMs = 4000,
    advanceOnPoll = true,
    enabled = true,
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
    refetchInterval: pollIntervalMs,
    refetchOnWindowFocus: false,
  });
}
