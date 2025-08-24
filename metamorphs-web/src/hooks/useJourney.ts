"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export function useJourney(projectId?: string, limit = 20) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["journey", projectId, limit],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const access = sess?.session?.access_token;
      const r = await fetch(
        `/api/journey/list?projectId=${projectId}&limit=${limit}`,
        {
          cache: "no-store",
          headers: {
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
        }
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
