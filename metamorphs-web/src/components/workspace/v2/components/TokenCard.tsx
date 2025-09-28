// src/components/workspace/v2/components/TokenCard.tsx
"use client";

import * as React from "react";
import type { ExplodedToken } from "@/types/workshop";
import { useWorkspace } from "@/store/workspace";

export function TokenCard({
  lineId,
  token,
  tokenIndex,
  totalTokens,
  onGroupWithNext,
  onUngroup,
}: {
  lineId: string;
  token: ExplodedToken;
  tokenIndex?: number;
  totalTokens?: number;
  onGroupWithNext?: (tokenIndex: number) => void;
  onUngroup?: (tokenIndex: number) => void;
}) {
  const selected = useWorkspace((s) => s.tokensSelections[lineId]?.[token.tokenId]);
  const setTokenSelection = useWorkspace((s) => s.setTokenSelection);
  const [adding, setAdding] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

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
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
          {token.surface}
        </div>

        {/* Overflow menu for grouping actions */}
        {(onGroupWithNext || onUngroup) && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              aria-label="Token actions"
            >
              <span className="text-xs">⋯</span>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-6 z-10 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg py-1 w-32">
                {onGroupWithNext && tokenIndex !== undefined && totalTokens !== undefined && tokenIndex < totalTokens - 1 && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                    onClick={() => {
                      onGroupWithNext(tokenIndex);
                      setShowMenu(false);
                    }}
                  >
                    Group with next
                  </button>
                )}

                {onUngroup && token.kind === "phrase" && tokenIndex !== undefined && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                    onClick={() => {
                      onUngroup(tokenIndex);
                      setShowMenu(false);
                    }}
                  >
                    Ungroup phrase
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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