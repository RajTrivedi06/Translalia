"use client";
import * as React from "react";
import { useNodes } from "@/hooks/useNodes";
import { useWorkspace } from "@/store/workspace";

export function LineSelectionView() {
  const projectId = useWorkspace((s) => s.projectId);
  const threadId = useWorkspace((s) => s.threadId);
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  const { data: nodes } = useNodes(projectId, threadId, { enabled: true });

  const lines = React.useMemo(() => {
    const withLines = (nodes || []).filter(
      (n) => (n.overview?.lines?.length || 0) > 0
    );
    const newest = withLines[withLines.length - 1];
    return newest?.overview?.lines || [];
  }, [nodes]);

  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const lastClicked = React.useRef<number | null>(null);

  function onToggle(i: number, withShift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (withShift && lastClicked.current != null) {
        const [a, b] = [lastClicked.current, i].sort((x, y) => x - y);
        for (let k = a; k <= b; k++) next.add(k);
      } else {
        if (next.has(i)) {
          next.delete(i);
        } else {
          next.add(i);
        }
      }
      lastClicked.current = i;
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 font-semibold">Select lines</div>
      <div className="flex-1 overflow-auto p-3">
        {lines.length === 0 ? (
          <div className="text-sm text-neutral-500">No lines yet.</div>
        ) : (
          <ul className="space-y-1">
            {lines.map((l, i) => {
              const checked = selected.has(i);
              return (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Select line ${i + 1}`}
                    className="mt-1"
                    checked={checked}
                    onChange={(e) =>
                      onToggle(
                        i,
                        e.nativeEvent instanceof MouseEvent
                          ? (e.nativeEvent as MouseEvent).shiftKey
                          : false
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle(i, e.shiftKey);
                      }
                    }}
                  />
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {i + 1}. {l}
                  </pre>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t p-3 text-right">
        <button
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          onClick={() => setCurrentView("workshop")}
          disabled={selected.size === 0}
          aria-label="Begin Workshop"
        >
          Begin Workshop
        </button>
      </div>
    </div>
  );
}

export default LineSelectionView;
