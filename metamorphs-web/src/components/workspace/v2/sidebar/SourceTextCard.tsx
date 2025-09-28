"use client";
import * as React from "react";
import { useNodes } from "@/hooks/useNodes";

export function SourceTextCard({
  projectId,
  threadId,
}: {
  projectId: string;
  threadId: string | null;
}) {
  const { data: nodes } = useNodes(projectId, threadId || undefined, {
    enabled: !!projectId && !!threadId,
  });
  const lines = React.useMemo(() => {
    // use overview lines from latest node with lines
    const withLines = (nodes || []).filter(
      (n) => (n.overview?.lines?.length || 0) > 0
    );
    const newest = withLines[withLines.length - 1];
    return newest?.overview?.lines || [];
  }, [nodes]);
  return (
    <section
      role="region"
      aria-labelledby="source-card-title"
      className="rounded-lg border p-3 bg-white dark:bg-neutral-950"
    >
      <div id="source-card-title" className="mb-2 text-sm font-semibold">
        Source text
      </div>
      {lines.length === 0 ? (
        <div className="text-sm text-neutral-500">No source yet.</div>
      ) : (
        <ol className="max-h-64 overflow-auto space-y-1 text-sm leading-relaxed">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-6 shrink-0 text-right text-xs text-neutral-500">
                {i + 1}
              </span>
              <span className="whitespace-pre-wrap">{l}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default SourceTextCard;
