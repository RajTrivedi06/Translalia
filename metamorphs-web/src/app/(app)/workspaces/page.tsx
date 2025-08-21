"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { routes } from "@/lib/routers";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

type Project = { id: string; title: string | null; created_at: string };

export default function WorkspacesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseUser();
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      // Try with created_at ordering; if the column doesn't exist yet, fall back to no order
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

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Workspace title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="rounded-md bg-black text-white px-3 py-2 disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Creating…" : "Create Workspace"}
          </button>
        </form>
      </header>

      <div className="rounded-lg border">
        <div className="p-3 border-b text-sm text-neutral-500">
          {isFetching ? "Loading…" : "Your workspaces"}
        </div>
        <ul className="divide-y">
          {(data ?? []).length === 0 ? (
            <li className="p-4 text-sm text-neutral-500">No workspaces yet.</li>
          ) : (
            data!.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{p.title || "Untitled"}</div>
                  <div className="text-xs text-neutral-500">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100"
                    onClick={() => router.push(routes.workspaceChats(p.id))}
                  >
                    Open
                  </button>
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Delete this workspace? This cannot be undone."
                        )
                      )
                        return;
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
                        alert(json?.error || "Failed to delete workspace");
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
  );
}
