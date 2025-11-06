import { useState, useCallback } from "react";

export interface JourneyReflectionData {
  id: string;
  threadId: string;
  projectId: string;
  studentReflection: string;
  completedLinesCount: number;
  totalLinesCount: number;
  status: "reflection_only" | "with_feedback";
  createdAt: string;
  aiFeedback?: string;
}

interface SaveReflectionParams {
  threadId: string;
  projectId: string;
  studentReflection: string;
  completedLinesCount: number;
  totalLinesCount: number;
}

interface GenerateFeedbackParams {
  journeyReflectionId: string;
  studentReflection: string;
  completedLines: Record<string, string>;
  poemLines: string[];
  completedCount: number;
  totalCount: number;
  threadId: string;
}

export function useJourneyReflection() {
  const [reflection, setReflection] = useState<JourneyReflectionData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveReflection = useCallback(
    async (params: SaveReflectionParams): Promise<JourneyReflectionData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/journey/save-reflection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg =
            errorData?.error?.message || "Failed to save reflection";
          setError(errorMsg);
          return null;
        }

        const data = (await response.json()) as JourneyReflectionData;
        setReflection(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        setError(msg);
        console.error("[useJourneyReflection] saveReflection error:", e);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generateFeedback = useCallback(
    async (
      params: GenerateFeedbackParams
    ): Promise<JourneyReflectionData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/journey/generate-brief-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg =
            errorData?.error?.message ||
            "Failed to generate feedback";
          setError(errorMsg);
          return null;
        }

        const data = (await response.json()) as JourneyReflectionData;
        setReflection(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        setError(msg);
        console.error("[useJourneyReflection] generateFeedback error:", e);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setReflection(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    reflection,
    isLoading,
    error,
    saveReflection,
    generateFeedback,
    clearError,
    reset,
  };
}
