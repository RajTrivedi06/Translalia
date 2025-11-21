"use client";

import * as React from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { routes } from "@/lib/routers";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

type Project = { id: string; title: string | null; created_at: string };

export default function WorkspacesPage() {
  const t = useTranslations("Workspaces");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseUser();
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const base = supabase.from("projects").select("id, title, created_at");
      const ordered = await base.order("created_at", { ascending: false });
      if (!ordered.error) return (ordered.data ?? []) as Project[];
      const fallback = await supabase
        .from("projects")
        .select("id, title, created_at");
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as Project[];
    },
  });

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/sign-in?redirect=/workspaces");
    }
  }, [authLoading, user, router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ title: title || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create workspace");
      const id = json?.project?.id as string;
      if (id) router.push(routes.workspaceChats(id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const userEmail = user?.email?.split("@")[0] ?? "";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <section className="rounded-3xl bg-white/80 px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                {t("title")}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {user?.email ? `Welcome back, ${userEmail}!` : t("heading")}
              </h1>
              <p className="text-base text-slate-600">
                {t("description")}
              </p>
            </div>
            <form
              onSubmit={onCreate}
              className="w-full rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200 sm:flex sm:items-center sm:gap-3 lg:w-auto"
            >
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <input
                  className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:min-w-[320px]"
                  placeholder={t("workspaceTitle")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? t("creating") : t("createWorkspace")}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                {t("library")}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                {isFetching ? tCommon("loading") : t("heading")}
              </h2>
            </div>
            <span className="text-sm text-slate-500">
              {data?.length
                ? `${data.length} ${t("active")}`
                : t("noWorkspaces")}
            </span>
          </div>

          <ul className="mt-8 grid gap-4">
            {(data ?? []).length === 0 ? (
              <li className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center text-sm text-slate-500">
                {t("emptyMessage")}
              </li>
            ) : (
              data!.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/70 p-5 transition hover:border-sky-200 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {p.title?.trim() || t("untitled")}
                    </p>
                    <p className="text-sm text-slate-500">
                      {p.created_at
                        ? `${t("started")} ${new Date(p.created_at).toLocaleString()}`
                        : "Created recently"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:border-sky-200 hover:bg-sky-50"
                      onClick={() => router.push(routes.workspaceChats(p.id))}
                    >
                      {t("openWorkspace")}
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm(t("deleteConfirm"))) return;
                        const { data: sessionData } =
                          await supabase.auth.getSession();
                        const accessToken = sessionData.session?.access_token;
                        const res = await fetch("/api/projects", {
                          method: "DELETE",
                          headers: {
                            "Content-Type": "application/json",
                            ...(accessToken
                              ? { Authorization: `Bearer ${accessToken}` }
                              : {}),
                          },
                          body: JSON.stringify({ id: p.id }),
                        });
                        if (!res.ok) {
                          const json = await res.json().catch(() => ({}));
                          alert(json?.error || t("deleteError"));
                          return;
                        }
                        await refetch();
                      }}
                    >
                      {t("delete")}
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
