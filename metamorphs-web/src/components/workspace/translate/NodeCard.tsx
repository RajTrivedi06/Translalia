"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { NodeRow } from "@/hooks/useNodes";
import LineCitationDrawer from "@/components/workspace/translate/LineCitationDrawer";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/store/workspace";

type NodeCardProps = {
  node: NodeRow;
  threadId: string;
  onAccepted?: () => void;
};

export default function NodeCard({
  node,
  threadId,
  onAccepted,
}: NodeCardProps) {
  const qc = useQueryClient();
  const projectId = useWorkspace((s) => s.projectId);
  const [openCite, setOpenCite] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const lines = node.overview?.lines || [];
  const notes = node.overview?.notes;
  const [savingComplete, setSavingComplete] = React.useState(false);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  async function acceptSelected() {
    if (!selected.size) return;
    const selections = Array.from(selected)
      .sort((a, b) => a - b)
      .map((index) => ({ index, text: lines[index] || "" }))
      .filter((s) => s.text?.trim().length > 0);

    if (!selections.length) return;

    const res = await fetch("/api/translator/accept-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ threadId, selections }),
    });

    if (res.ok) {
      setSelected(new Set());
      // Refresh activity/journey and nodes list
      qc.invalidateQueries({ queryKey: ["journey"] }).catch(() => {});
      if (projectId) {
        qc.invalidateQueries({ queryKey: ["nodes", projectId] }).catch(
          () => {}
        );
      } else {
        qc.invalidateQueries({ queryKey: ["nodes"] }).catch(() => {});
      }
      onAccepted?.();
    } else {
      let details: { error?: string; categories?: Record<string, unknown> } =
        {};
      try {
        details = (await res.json()) as typeof details;
      } catch {}
      const cats = details?.categories
        ? Object.entries(details.categories)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ")
        : "";
      // eslint-disable-next-line no-alert
      alert(
        details?.error
          ? `${details.error}${cats ? ` (categories: ${cats})` : ""}`
          : "Accept failed. Please retry."
      );
    }
  }

  async function setComplete(next: boolean) {
    setSavingComplete(true);
    try {
      const { data: v, error: e1 } = await supabase
        .from("versions")
        .select("meta")
        .eq("id", node.id)
        .single();
      if (e1 || !v) throw e1 || new Error("Version not found");
      const meta = (v.meta as Record<string, unknown>) || {};
      const nextMeta = { ...meta, complete: !!next } as Record<string, unknown>;
      const { error: e2 } = await supabase
        .from("versions")
        .update({ meta: nextMeta })
        .eq("id", node.id);
      if (e2) throw e2;
      if (projectId) {
        await qc.invalidateQueries({ queryKey: ["nodes", projectId] });
      } else {
        await qc.invalidateQueries({ queryKey: ["nodes"] });
      }
    } finally {
      setSavingComplete(false);
    }
  }

  // Guard: close citation UI and clear selections on thread or node change
  React.useEffect(() => {
    setOpenCite(false);
    setSelected(new Set());
  }, [threadId, node.id]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {node.display_label || "Version ?"} — Overview
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={!!node.complete}
              onChange={(e) => setComplete(e.target.checked)}
              disabled={savingComplete}
            />
            Complete
          </label>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={() => setOpenCite(true)}
          >
            Cite lines…
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-60"
            onClick={acceptSelected}
            disabled={!selected.size}
          >
            Accept selected ({selected.size || 0})
          </button>
        </div>
      </header>

      <div className="border-t" />

      <div className="space-y-2">
        {lines.length === 0 ? (
          <p className="text-sm text-neutral-500">— No lines —</p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                className="mt-1"
              />
              <pre className="flex-1 whitespace-pre-wrap text-sm leading-relaxed border rounded-md p-2">
                {l}
              </pre>
            </div>
          ))
        )}
      </div>

      {Array.isArray(notes) || typeof notes === "string" ? (
        <>
          <div className="border-t my-2" />
          <div className="text-sm">
            <div className="font-medium mb-1">Notes</div>
            {Array.isArray(notes) ? (
              <ul className="list-disc pl-5">
                {notes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            ) : (
              <p>{notes}</p>
            )}
          </div>
        </>
      ) : null}

      <LineCitationDrawer
        open={openCite}
        onOpenChange={setOpenCite}
        node={node}
        threadId={threadId}
      />
    </div>
  );
}
