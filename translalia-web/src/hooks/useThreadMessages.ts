"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta: unknown;
  created_at: string;
  created_by: string | null;
};

export function useThreadMessages(projectId?: string, threadId?: string) {
  return useQuery({
    enabled: !!projectId && !!threadId,
    queryKey: ["chat_messages", projectId, threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, meta, created_at, created_by")
        .eq("project_id", projectId!)
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}
