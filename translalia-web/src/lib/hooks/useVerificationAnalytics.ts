import { useQuery } from "@tanstack/react-query";

interface AnalyticsParams {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface DimensionStats {
  semantic_accuracy: number;
  cultural_fidelity: number;
  rhythm_prosody: number;
  register_tone: number;
  dialect_preservation: number;
  option_quality: number;
}

interface AnalyticsData {
  totalGraded: number;
  averageScores: (DimensionStats & { overall: number }) | null;
  scoreDistribution: Record<number, number> | null;
  lowScoreLines: Array<{
    lineIndex: number;
    threadId: string;
    projectId: string;
    score: number;
    issues: string[];
    gradedAt: string;
    auditId?: string;
  }>;
  recentGrades: Array<{
    score: number;
    timestamp: string;
    lineIndex?: number;
    threadId?: string;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

export function useVerificationAnalytics(params: AnalyticsParams = {}) {
  const queryParams = new URLSearchParams();

  if (params.projectId) queryParams.set("projectId", params.projectId);
  if (params.startDate) queryParams.set("startDate", params.startDate);
  if (params.endDate) queryParams.set("endDate", params.endDate);
  if (params.limit) queryParams.set("limit", params.limit.toString());

  return useQuery({
    queryKey: ["verification-analytics", params],
    queryFn: async () => {
      const response = await fetch(
        `/api/verification/analytics?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      return response.json() as Promise<AnalyticsData>;
    },
    staleTime: 60000, // 1 minute - analytics can be slightly stale
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}

export function useGradeDetail(auditId: string | undefined) {
  return useQuery({
    queryKey: ["grade-detail", auditId],
    queryFn: async () => {
      if (!auditId) return null;

      const response = await fetch(`/api/verification/grade/${auditId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch grade detail");
      }

      return response.json();
    },
    enabled: !!auditId,
    staleTime: Infinity, // Grades don't change
  });
}
