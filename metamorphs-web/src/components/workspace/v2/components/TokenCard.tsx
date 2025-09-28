// src/components/workspace/v2/components/TokenCard.tsx
"use client";

import * as React from "react";
import type { ExplodedToken } from "@/types/workshop";
import { useWorkspace } from "@/store/workspace";

export function TokenCard({
  lineId,
  token,
}: {
  lineId: string;
  token: ExplodedToken;
}) {
  const selected = useWorkspace((s) => s.tokensSelections[lineId]?.[token.tokenId]);
  const setTokenSelection = useWorkspace((s) => s.setTokenSelection);
  const [adding, setAdding] = React.useState(false);
  const [custom, setCustom] = React.useState("");

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custom.trim()) return;
    const id = `user:${custom.trim()}`;
    setTokenSelection(lineId, token.tokenId, id);
    setCustom("");
    setAdding(false);
  };

  return (
    <div
      role="group"
      aria-label={token.surface}
      className="rounded-xl border p-2 bg-white dark:bg-neutral-900"
    >
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-2 font-medium">
        {token.surface}
      </div>
      <div className="flex flex-wrap gap-1">
        {token.options.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTokenSelection(lineId, token.tokenId, opt.id)}
              aria-pressed={active}
              className={`rounded-md border px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                active
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100"
                  : "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
              }`}
              title={`${opt.label} (${opt.dialect})`}
            >
              {opt.label}{" "}
              <span className="opacity-60 text-[10px]">({opt.dialect})</span>
            </button>
          );
        })}

        {/* Add your own option */}
        {!adding ? (
          <button
            type="button"
            className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-600 dark:border-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => setAdding(true)}
            aria-label="Add your own option"
          >
            + Add your own
          </button>
        ) : (
          <form onSubmit={handleSaveCustom} className="inline-flex gap-1">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-7 rounded border border-neutral-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              aria-label="Add your own option"
              placeholder="Your option"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setCustom("");
                }
              }}
            />
            <button
              className="h-7 rounded border border-neutral-300 px-2 text-xs hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-600 dark:hover:bg-neutral-800"
              type="submit"
            >
              Save
            </button>
            <button
              className="h-7 rounded border border-neutral-300 px-2 text-xs hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-600 dark:hover:bg-neutral-800"
              type="button"
              onClick={() => {
                setAdding(false);
                setCustom("");
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}