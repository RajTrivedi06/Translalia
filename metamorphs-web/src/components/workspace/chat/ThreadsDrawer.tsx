"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/store/workspace";

type ThreadsDrawerProps = {
  projectId?: string;
};

type ChatThread = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function ThreadsDrawer({ projectId }: ThreadsDrawerProps) {
  const [open, setOpen] = React.useState(true);
  const threadId = useWorkspace((s) => s.threadId);
  const setThreadId = useWorkspace((s) => s.setThreadId);

  const { data, refetch, isFetching } = useQuery({
    enabled: !!projectId,
    queryKey: ["chat_threads", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatThread[];
    },
  });

  async function onNewChat() {
    if (!projectId) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ projectId }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "Failed to create thread");
      return;
    }
    await refetch();
    const newId = (json?.thread?.id as string) || undefined;
    if (newId) setThreadId(newId);
  }

  return (
    <div className="border-b">
      <div className="flex items-center justify-between p-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-medium"
          aria-expanded={open}
        >
          {open ? "▼" : "►"} Chats
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-md border px-2 py-1 text-sm"
          disabled={!projectId || isFetching}
        >
          New Chat
        </button>
      </div>

      {open ? (
        <div className="max-h-56 overflow-auto px-2 pb-2">
          {!projectId ? (
            <p className="text-sm text-neutral-500">
              Open a project to see its chats.
            </p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-500">No chats yet.</p>
          ) : (
            <ul className="space-y-1">
              {data!.map((t) => {
                const active = t.id === threadId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setThreadId(t.id)}
                      className={`w-full rounded-md px-2 py-1 text-left text-sm ${
                        active ? "bg-black text-white" : "hover:bg-neutral-100"
                      }`}
                      title={new Date(t.created_at).toLocaleString()}
                    >
                      {t.title || "Untitled chat"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
