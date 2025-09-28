"use client";

import * as React from "react";
import { NodeRow, useNodes } from "@/hooks/useNodes";
import { useWorkspace } from "@/store/workspace";
import { supabase } from "@/lib/supabaseClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  node: NodeRow;
  threadId: string;
};

type Mapping = {
  target_idx: number;
  version_id: string;
  line_idx_list: number[];
};

type ProvenanceSource = { version_id: string; line_idx: number };
type ProvenanceEntry = { target_idx: number; sources: ProvenanceSource[] };
type VersionMeta = { provenance?: ProvenanceEntry[] };

export default function LineCitationDrawer({
  open,
  onOpenChange,
  node,
  threadId,
}: Props) {
  const projectId = useWorkspace((s) => s.projectId);
  const { data: nodes } = useNodes(projectId, threadId);
  // Temporary debug to verify thread-scoped citation source list
  console.debug("[CitationsRender]", {
    projectId,
    threadId,
    count: (nodes || []).length,
  });
  const [targetIdx, setTargetIdx] = React.useState<number | null>(null);
  const [sourceVersionId, setSourceVersionId] = React.useState<string | null>(
    null
  );
  const [selectedSrc, setSelectedSrc] = React.useState<Set<number>>(new Set());
  const [mappings, setMappings] = React.useState<Mapping[]>([]);
  const lines = node.overview?.lines || [];

  const earlierNodes = (nodes || []).filter(
    (n) => n.id !== node.id && (n.overview?.lines?.length || 0) > 0
  );

  const srcLines = React.useMemo(() => {
    const src = nodes?.find((n) => n.id === sourceVersionId);
    return src?.overview?.lines || [];
  }, [nodes, sourceVersionId]);

  function toggleSrc(i: number) {
    setSelectedSrc((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  function addMapping() {
    if (targetIdx == null || !sourceVersionId || selectedSrc.size === 0) return;
    const m: Mapping = {
      target_idx: targetIdx,
      version_id: sourceVersionId,
      line_idx_list: Array.from(selectedSrc).sort((a, b) => a - b),
    };
    setMappings((prev) => [...prev, m]);
    setSelectedSrc(new Set());
  }

  async function saveProvenance() {
    const { data: v, error: seErr } = await supabase
      .from("versions")
      .select("id, meta")
      .eq("id", node.id)
      .single();
    if (seErr || !v) {
      alert("Failed to load node meta");
      return;
    }
    const meta: VersionMeta = ((v.meta ?? {}) as VersionMeta) || {};
    const existing: ProvenanceEntry[] = Array.isArray(meta.provenance)
      ? meta.provenance
      : [];

    for (const m of mappings) {
      const found = existing.find((e) => e?.target_idx === m.target_idx);
      const srcObjs = m.line_idx_list.map((idx) => ({
        version_id: m.version_id,
        line_idx: idx,
      }));
      if (!found) {
        existing.push({ target_idx: m.target_idx, sources: srcObjs });
      } else {
        const dedupe = new Set(
          (found.sources || []).map(
            (s: ProvenanceSource) => `${s.version_id}:${s.line_idx}`
          )
        );
        for (const s of srcObjs) {
          const key = `${s.version_id}:${s.line_idx}`;
          if (!dedupe.has(key)) {
            found.sources = [...(found.sources || []), s];
            dedupe.add(key);
          }
        }
      }
    }

    const nextMeta = { ...meta, provenance: existing };
    const { error: upErr } = await supabase
      .from("versions")
      .update({ meta: nextMeta })
      .eq("id", node.id);
    if (upErr) {
      alert("Failed to save provenance (RLS?)");
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ariaLabelledby="citation-title" className="max-w-[560px]">
        <SheetHeader>
          <SheetTitle id="citation-title">Per-line citation</SheetTitle>
          <button
            type="button"
            className="text-sm text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 rounded-md"
            onClick={() => onOpenChange(false)}
            aria-label="Close citation"
          >
            Close
          </button>
        </SheetHeader>
        <div className="p-4 overflow-y-auto h-[calc(100%-48px)]">
          <div className="mt-4 space-y-4">
            <div className="text-sm">
              Target line (in {node.display_label}):
            </div>
            <select
              className="w-full rounded-md border p-2 text-sm"
              value={targetIdx != null ? String(targetIdx) : ""}
              onChange={(e) => setTargetIdx(Number(e.target.value))}
            >
              <option value="" disabled>
                Choose target line
              </option>
              {lines.map((l, i) => (
                <option key={i} value={String(i)}>
                  {i + 1}. {truncate(l)}
                </option>
              ))}
            </select>

            <div className="border-t" />

            <div className="text-sm">Source version</div>
            <select
              className="w-full rounded-md border p-2 text-sm"
              value={sourceVersionId ?? ""}
              onChange={(e) => setSourceVersionId(e.target.value || null)}
            >
              <option value="" disabled>
                Pick a version (A/B/C…)
              </option>
              {earlierNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.display_label || n.id}
                </option>
              ))}
            </select>

            <div className="border rounded-md p-2 h-56 overflow-y-auto">
              {srcLines.length ? (
                <div className="space-y-2">
                  {srcLines.map((l, i) => (
                    <label key={i} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSrc.has(i)}
                        onChange={() => toggleSrc(i)}
                      />
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                        {i + 1}. {l}
                      </pre>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  Select a source version to see its lines.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                onClick={addMapping}
                disabled={
                  targetIdx == null ||
                  !sourceVersionId ||
                  selectedSrc.size === 0
                }
              >
                Add mapping
              </button>
            </div>

            {mappings.length ? (
              <div className="space-y-2">
                <div className="border-t" />
                <div className="text-sm font-medium">Pending mappings</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {mappings.map((m, idx) => (
                    <li key={idx}>
                      Target line {m.target_idx + 1} ⇢{" "}
                      {m.line_idx_list.map((i) => i + 1).join(", ")} (from
                      version {shortId(m.version_id)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                onClick={saveProvenance}
                disabled={!mappings.length}
              >
                Save provenance
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function shortId(id: string) {
  return id.slice(0, 4) + "…" + id.slice(-4);
}
