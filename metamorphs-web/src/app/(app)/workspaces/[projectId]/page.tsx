"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { routes } from "@/lib/routers";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import Breadcrumbs from "@/components/nav/Breadcrumbs";

type Thread = { id: string; title: string | null; created_at: string };

export default function WorkspaceChatsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { user, loading: authLoading } = useSupabaseUser();

  const { data, refetch, isFetching } = useQuery({
    enabled: !!projectId,
    queryKey: ["chat_threads", projectId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const headers: HeadersInit = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {};
      const res = await fetch(`/api/threads/list?projectId=${projectId}`, {
        cache: "no-store",
        credentials: "include",
        headers,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          payload?.error || payload?.code || "THREADS_LIST_FAILED"
        );
      }
      return (payload.items ?? []) as Thread[];
    },
  });

  // hydrate workspace name in store for thread topbar usage
  React.useEffect(() => {
    (async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("id", projectId)
        .single();
      if (!error && data?.title) {
        // lazy import to avoid import cycle
        const { useWorkspace } = await import("@/store/workspace");
        useWorkspace
          .getState()
          .setWorkspaceMeta(projectId, data.title as string);
      }
    })();
  }, [projectId]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push(
        `/auth/sign-in?redirect=${encodeURIComponent(
          routes.workspaceChats(projectId)
        )}`
      );
    }
  }, [authLoading, user, router, projectId]);

  async function onNewChat() {
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
      alert(json?.error ?? "Failed to create chat");
      return;
    }
    const id = (json?.thread?.id as string) || undefined;
    await refetch();
    if (id) {
      router.push(routes.projectWithThread(projectId, id));
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-0">
      <Breadcrumbs
        workspaceId={projectId}
        showNewChat
        NewChatButton={
          <button
            onClick={onNewChat}
            className="rounded-md bg-black text-white px-3 py-1.5 text-sm disabled:opacity-70"
            disabled={isFetching}
          >
            New Chat
          </button>
        }
      />
      <div className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <button
              className="mr-3 text-sm underline"
              onClick={() => router.push(routes.workspaces())}
            >
              ← All Workspaces
            </button>
            <h1 className="inline text-2xl font-semibold">Chats</h1>
          </div>
        </header>

        <div className="rounded-lg border">
          <div className="p-3 border-b text-sm text-neutral-500">
            {isFetching ? "Loading…" : "Chats in this workspace"}
          </div>
          <ul className="divide-y">
            {(data ?? []).length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">No chats yet.</li>
            ) : (
              data!.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="font-medium">
                      {t.title || "Untitled chat"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100"
                      onClick={() =>
                        router.push(routes.projectWithThread(projectId, t.id))
                      }
                    >
                      Open
                    </button>
                    <button
                      className="rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (
                          !confirm("Delete this chat? This cannot be undone.")
                        )
                          return;
                        const { data: sessionData } =
                          await supabase.auth.getSession();
                        const accessToken = sessionData.session?.access_token;
                        const res = await fetch("/api/threads", {
                          method: "DELETE",
                          headers: {
                            "Content-Type": "application/json",
                            ...(accessToken
                              ? { Authorization: `Bearer ${accessToken}` }
                              : {}),
                          },
                          body: JSON.stringify({ id: t.id }),
                        });
                        if (!res.ok) {
                          const json = await res.json().catch(() => ({}));
                          alert(json?.error || "Failed to delete chat");
                          return;
                        }
                        await refetch();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
