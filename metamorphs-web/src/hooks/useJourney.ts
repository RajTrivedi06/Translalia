"use client";
import { useQuery } from "@tanstack/react-query";

export function useJourney(projectId?: string, limit = 20) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["journey", projectId, limit],
    queryFn: async () => {
      const r = await fetch(
        `/api/journey/list?projectId=${projectId}&limit=${limit}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "journey fetch failed");
      return j as {
        ok: true;
        items: Array<{
          id: string;
          kind: string;
          summary: string;
          meta: unknown;
          created_at: string;
        }>;
      };
    },
  });
}
