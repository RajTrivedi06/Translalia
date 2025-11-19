"use client";

import * as React from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
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
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        <Breadcrumbs
          workspaceId={projectId}
          showNewChat
          NewChatButton={
            <button
              onClick={onNewChat}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
              disabled={isFetching}
            >
              New chat
            </button>
          }
        />

        <section className="rounded-3xl bg-white/85 px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <button
                className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                onClick={() => router.push(routes.workspaces())}
              >
                ← Back to workspaces
              </button>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Chats
              </h1>
              <p className="text-base text-slate-600">
                Every conversation inside this workspace appears here. Keep your
                drafts, reviews, and reflections neatly organized.
              </p>
            </div>
          </div>
        </section>

        <section className="flex-1 rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Threads
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                {isFetching ? "Loading…" : "Chats in this workspace"}
              </h2>
            </div>
          </div>

          <ul className="mt-8 flex flex-1 flex-col gap-4">
            {(data ?? []).length === 0 ? (
              <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center text-sm text-slate-500">
                No chats yet. Start one to collect new translations or reviews
                with your class.
              </li>
            ) : (
              data!.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 transition hover:border-sky-200 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {t.title?.trim() || "Untitled chat"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:border-sky-200 hover:bg-sky-50"
                      onClick={() =>
                        router.push(routes.projectWithThread(projectId, t.id))
                      }
                    >
                      Open chat
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
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
        </section>
      </div>
    </div>
  );
}
