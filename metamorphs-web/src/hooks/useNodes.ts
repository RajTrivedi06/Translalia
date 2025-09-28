"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/store/workspace";

export type NodeRow = {
  id: string;
  display_label: string | null;
  status: "placeholder" | "generated";
  parent_version_id: string | null;
  overview: {
    lines?: string[];
    notes?: string[] | string;
  } | null;
  complete?: boolean;
  created_at: string;
};

async function fetchNodes(threadId: string): Promise<NodeRow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const res = await fetch(
    `/api/versions/nodes?threadId=${encodeURIComponent(threadId)}`,
    {
      credentials: "include",
      cache: "no-store",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }
  );
  if (!res.ok) throw new Error(`Failed to load nodes (${res.status})`);
  const j = await res.json();
  return Array.isArray(j?.nodes) ? (j.nodes as NodeRow[]) : (j as NodeRow[]);
}

export function useNodes(
  projectId: string | undefined,
  threadId: string | undefined,
  opts?: { enabled?: boolean }
) {
  const currentView = useWorkspace((s) => s.ui.currentView);
  const pollingEnabled = currentView === "workshop";
  const enabled = (!!projectId &&
    !!threadId &&
    (opts?.enabled ?? true)) as boolean;
  return useQuery({
    queryKey: ["nodes", projectId, threadId],
    queryFn: () => fetchNodes(threadId!),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: pollingEnabled ? 1500 : false,
  });
}
