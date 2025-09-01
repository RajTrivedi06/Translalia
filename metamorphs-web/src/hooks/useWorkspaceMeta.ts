"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/store/workspace";

export function useWorkspaceMeta(projectId?: string) {
  const setMeta = useWorkspace((s) => s.setWorkspaceMeta);
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("id", projectId)
        .single();
      if (!error && data?.id)
        setMeta(data.id, (data as { title?: string | null }).title || null);
    })();
  }, [projectId, setMeta]);
}
