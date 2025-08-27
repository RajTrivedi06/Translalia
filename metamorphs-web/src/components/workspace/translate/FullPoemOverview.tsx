"use client";

import * as React from "react";
import type { NodeRow } from "@/hooks/useNodes";

type Props = { node: NodeRow };

export default function FullPoemOverview({ node }: Props) {
  const lines = node.overview?.lines ?? [];
  const notes = node.overview?.notes;
  const [showAllNotes, setShowAllNotes] = React.useState(false);
  const rowH = 28;
  const viewH = 320;
  const [scrollTop, setScrollTop] = React.useState(0);
  const start = Math.max(0, Math.floor(scrollTop / rowH) - 10);
  const end = Math.min(
    lines.length,
    Math.ceil((scrollTop + viewH) / rowH) + 10
  );
  const offsetY = start * rowH;

  return (
    <div className="space-y-4" aria-label="Full poem overview">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {(node.display_label || "Version ?") + " — Full Poem"}
        </h3>
        <div className="text-xs text-neutral-500">{lines.length} line(s)</div>
      </header>

      <div
        className="h-[320px] w-full border rounded-md overflow-auto"
        role="region"
        aria-label="Poem lines"
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: lines.length * rowH }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {lines.slice(start, end).map((l, i) => {
              const idx = start + i;
              return (
                <div
                  key={idx}
                  className="px-3 py-1 text-sm whitespace-pre-wrap"
                  style={{ height: rowH }}
                >
                  {idx + 1}. {l}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {Array.isArray(notes) || typeof notes === "string" ? (
        <section aria-label="Translator notes">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Notes</div>
            {Array.isArray(notes) && notes.length > 5 ? (
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setShowAllNotes((v) => !v)}
              >
                {showAllNotes ? "Show less" : "Show more"}
              </button>
            ) : null}
          </div>
          {Array.isArray(notes) ? (
            <ul className="list-disc pl-5 text-sm mt-1">
              {(showAllNotes ? notes : notes.slice(0, 5)).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm mt-1">{notes}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
