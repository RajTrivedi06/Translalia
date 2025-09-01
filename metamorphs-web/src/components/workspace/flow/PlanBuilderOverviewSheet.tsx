"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { useNodes } from "@/hooks/useNodes";
import { useQueryClient } from "@tanstack/react-query";
import NodeCard from "@/components/workspace/translate/NodeCard";
import FullPoemOverview from "@/components/workspace/translate/FullPoemOverview";
import { extractTL } from "@/lib/i18n/targetLanguage";
import { useWorkspace } from "@/store/workspace";
import { supabase } from "@/lib/supabaseClient";
import { supabase as supa } from "@/lib/supabaseClient";

type PlanBuilderOverviewSheetProps = {
  threadId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type CollectedFields = Record<string, unknown>;
type ThreadStateShape = {
  poem_excerpt?: unknown;
  collected_fields?: Record<string, unknown>;
};

export default function PlanBuilderOverviewSheet(
  props: PlanBuilderOverviewSheetProps
) {
  const { threadId, open, onOpenChange } = props;
  const [loading, setLoading] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const selectedNodeId = useWorkspace((s) => s.selectedNodeId);
  const setSelectedNodeId = useWorkspace((s) => s.setSelectedNodeId);
  const projectId = useWorkspace((s) => s.projectId);
  const { data: nodes } = useNodes(projectId, threadId);
  const selectedNode = (nodes || []).find(
    (n: { id: string }) => n.id === selectedNodeId
  );
  const qc = useQueryClient();
  const [optimisticNode, setOptimisticNode] = React.useState<null | {
    id: string;
    display_label: string;
    status: "generated";
    overview: { lines: string[]; notes?: string[] | string };
  }>(null);

  const [poem, setPoem] = React.useState("");
  const [fields, setFields] = React.useState<CollectedFields>({});
  const tl = extractTL(fields);
  const [forceTranslate, setForceTranslate] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("state")
        .eq("id", threadId)
        .single();
      if (!error && data?.state) {
        const s = (data.state as ThreadStateShape) || {};
        setPoem(String((s.poem_excerpt as string) || ""));
        setFields((s.collected_fields as Record<string, unknown>) || {});
      }
    })();
  }, [open, threadId]);

  const savePlan = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("state")
        .eq("id", threadId)
        .single();
      if (error) throw error;
      const cur = (data?.state as ThreadStateShape) || {};
      const next: ThreadStateShape = {
        ...cur,
        poem_excerpt: poem,
        collected_fields: fields,
      };
      const { error: upErr } = await supabase
        .from("chat_threads")
        .update({ state: next })
        .eq("id", threadId);
      if (upErr) throw upErr;
      setEditMode(false);
    } finally {
      setLoading(false);
    }
  }, [threadId, poem, fields]);

  const generateOverview = React.useCallback(
    async (force?: boolean) => {
      setLoading(true);
      try {
        const { data: sessionData } = await supa.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch("/api/translator/preview", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ threadId, forceTranslate: !!force }),
        });
        const payload = await res.json().catch(() => null);
        if (res.status === 409 && payload?.code === "PREVIEW_ECHOED_SOURCE") {
          const okay = window.confirm(
            "Model echoed source text. Retry with stronger non-echo enforcement?"
          );
          if (okay) {
            await generateOverview(true);
          }
          return;
        }
        if (res.ok && payload?.versionId) {
          if (payload.displayLabel && payload.preview) {
            setOptimisticNode({
              id: payload.versionId,
              display_label: payload.displayLabel,
              status: "generated",
              overview: payload.preview,
            });
          }
          await qc.invalidateQueries({ queryKey: ["nodes"] });
          setSelectedNodeId(payload.versionId);
          // Wait for thread-scoped nodes to include the new version before closing
          const start = Date.now();
          let found = false;
          while (Date.now() - start < 8000) {
            const q = qc.getQueryData<any>(["nodes", projectId, threadId]);
            const list = Array.isArray(q)
              ? q
              : Array.isArray(q?.nodes)
              ? q.nodes
              : [];
            if (list.find((n: any) => n?.id === payload.versionId)) {
              found = true;
              break;
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 250));
            // eslint-disable-next-line no-await-in-loop
            await qc.invalidateQueries({
              queryKey: ["nodes", projectId, threadId],
            });
          }
          if (found) onOpenChange(true); // keep open if not found; caller may retry
        }
        if (!res.ok) {
          const code = payload?.code || payload?.error || "PREVIEW_FAILED";
          // eslint-disable-next-line no-alert
          alert(`Preview failed: ${code}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [threadId, setSelectedNodeId, qc]
  );

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`}>
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-[640px] bg-white dark:bg-neutral-900 shadow-xl p-0 overflow-hidden">
        <div className="flex h-full flex-col">
          <header className="p-5 pb-2">
            <h2 className="text-xl font-semibold">
              Plan Builder / <span className="text-primary">Overview</span>
            </h2>
            <p className="text-sm text-neutral-500">
              Review interview answers and poem. Accept to generate Version A.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded border px-2 py-1">
                Target: <span className="font-medium">{tl.target}</span>
                {tl.dialect ? (
                  <>
                    {" "}
                    — Dialect: <span className="font-medium">{tl.dialect}</span>
                  </>
                ) : null}
              </span>
              <span className="rounded border px-2 py-1">
                Non-echo enforcement active
              </span>
              {tl.translanguaging ? (
                <span className="rounded border px-2 py-1">
                  Translanguaging allowed
                </span>
              ) : null}
            </div>
          </header>
          <Separator />
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-500">
                Interview Recap
              </h3>
              {!editMode ? (
                <RecapView fields={fields} />
              ) : (
                <RecapEditor fields={fields} setFields={setFields} />
              )}
            </section>
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-500">
                Source Poem
              </h3>
              {!editMode ? (
                <pre className="whitespace-pre-wrap rounded-md border p-3 text-sm leading-relaxed">
                  {poem || "— No poem provided —"}
                </pre>
              ) : (
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  value={poem}
                  onChange={(e) => setPoem(e.target.value)}
                  rows={10}
                  placeholder="Paste or edit the poem excerpt here…"
                />
              )}
            </section>

            {selectedNodeId ? (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">
                    {(selectedNode?.display_label ||
                      (optimisticNode?.id === selectedNodeId
                        ? optimisticNode.display_label
                        : "Version ?")) + " — Overview"}
                  </h3>
                  {!selectedNode || selectedNode.status === "placeholder" ? (
                    <div className="text-sm text-neutral-500">
                      Creating{" "}
                      {selectedNode?.display_label ||
                        optimisticNode?.display_label ||
                        "Version …"}
                      …
                    </div>
                  ) : selectedNode.complete ? (
                    <FullPoemOverview node={selectedNode} />
                  ) : (
                    <NodeCard
                      node={
                        selectedNode ||
                        (optimisticNode as unknown as {
                          id: string;
                          display_label: string;
                          status: "generated";
                          overview: {
                            lines: string[];
                            notes?: string[] | string;
                          };
                        })
                      }
                      threadId={threadId}
                    />
                  )}
                </section>
              </>
            ) : null}
          </div>
          <Separator />
          <footer className="p-4 flex items-center justify-between gap-2">
            {!editMode ? (
              <>
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setEditMode(true)}
                >
                  Edit
                </button>
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={forceTranslate}
                      onChange={(e) => setForceTranslate(e.target.checked)}
                    />
                    Force translate (avoid echo)
                  </label>
                  <button
                    className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                    disabled={loading}
                    onClick={() => generateOverview(forceTranslate)}
                  >
                    {loading ? "Generating…" : "Accept & Generate Version A"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2 ml-auto">
                <button
                  className="rounded-md px-3 py-2 text-sm"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                  disabled={loading}
                  onClick={savePlan}
                >
                  {loading ? "Saving…" : "Save Plan"}
                </button>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

function RecapView({ fields }: { fields: Record<string, unknown> }) {
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <p className="text-sm text-neutral-500">— No interview data captured —</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {Object.entries(fields).map(([k, v]) => (
        <div key={k} className="rounded-md border p-3">
          <div className="text-xs uppercase text-neutral-500">{k}</div>
          <div className="text-sm">{formatValue(v)}</div>
        </div>
      ))}
    </div>
  );
}

function RecapEditor({
  fields,
  setFields,
}: {
  fields: Record<string, unknown>;
  setFields: (f: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(fields || {});
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">— No fields to edit —</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => (
        <div key={k} className="grid gap-1">
          <label className="text-xs uppercase text-neutral-500">{k}</label>
          <input
            className="rounded-md border px-2 py-1 text-sm"
            value={stringify(v)}
            onChange={(e) =>
              setFields({ ...fields, [k]: parseMaybeJSON(e.target.value) })
            }
          />
        </div>
      ))}
    </div>
  );
}

function stringify(v: unknown) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
function parseMaybeJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
function formatValue(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
