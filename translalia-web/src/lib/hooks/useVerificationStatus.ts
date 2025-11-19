import { useQuery } from "@tanstack/react-query";
import { FEATURE_VERIFICATION_INTERNAL } from "@/lib/featureFlags";

interface VerificationStatus {
  lineIndex: number;
  graded: boolean;
  overall?: number;
  dimensions?: Record<string, number>;
}

/**
 * Hook to check verification status for workshop lines (dev/internal use only)
 * This is NOT shown to end users
 */
export function useVerificationStatus(threadId: string | undefined) {
  return useQuery({
    queryKey: ["verification-status", threadId],
    queryFn: async () => {
      if (!threadId) return null;

      const response = await fetch(
        `/api/verification/status?threadId=${threadId}`
      );
      if (!response.ok) throw new Error("Failed to fetch verification status");

      return response.json() as Promise<{
        lines: VerificationStatus[];
        stats: {
          total: number;
          graded: number;
          avgScore: number;
        };
      }>;
    },
    enabled: !!threadId && FEATURE_VERIFICATION_INTERNAL,
    staleTime: 30000, // 30 seconds
  });
}
