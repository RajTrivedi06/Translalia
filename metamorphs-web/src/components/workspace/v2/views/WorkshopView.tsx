"use client";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";

type TokenOption = { id: string; label: string; tag?: string };

export function WorkshopView() {
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  const setCurrentLine = useWorkspace((s) => s.setCurrentLine);
  const selections = useWorkspace((s) => s.tokensSelections);
  const setTokenSelection = useWorkspace((s) => s.setTokenSelection);

  const [tokens] = React.useState(
    () =>
      [
        {
          id: "t1",
          options: [
            { id: "o1", label: "Gleam", tag: "dialect:en-US" },
            { id: "o2", label: "Glimmer", tag: "dialect:en-UK" },
            { id: "o3", label: "Shimmer", tag: "dialect:poetic" },
          ] as TokenOption[],
        },
        {
          id: "t2",
          options: [
            { id: "o1", label: "of", tag: "function" },
            { id: "o2", label: "from", tag: "function" },
            { id: "o3", label: "out of", tag: "function" },
          ] as TokenOption[],
        },
        {
          id: "t3",
          options: [
            { id: "o1", label: "dawn", tag: "noun" },
            { id: "o2", label: "morning", tag: "noun" },
            { id: "o3", label: "first light", tag: "noun" },
          ] as TokenOption[],
        },
      ] as Array<{ id: string; options: TokenOption[] }>
  );

  const [focusedIdx, setFocusedIdx] = React.useState(0);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      setFocusedIdx(
        (i) => (i + (e.shiftKey ? -1 : 1) + tokens.length) % tokens.length
      );
    }
    if (e.key === "Enter") {
      // choose first option when pressing enter as a default
      const t = tokens[focusedIdx];
      if (t?.options?.[0]) {
        setTokenSelection("line0", t.id, t.options[0].id);
      }
    }
  }

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="border-b p-3 font-semibold">Workshop</div>
      <div className="flex-1 overflow-auto p-3">
        <div className="flex flex-wrap gap-3">
          {tokens.map((t, i) => {
            const selected = selections["line0"]?.[t.id] ?? null;
            return (
              <div
                key={t.id}
                className={
                  "min-w-[180px] rounded-lg border p-2 focus:outline-none " +
                  (focusedIdx === i ? "ring-2 ring-neutral-400" : "")
                }
                tabIndex={-1}
                onMouseEnter={() => setFocusedIdx(i)}
              >
                <div className="mb-2 text-xs font-medium text-neutral-500">
                  Token {i + 1}
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.options.map((o) => {
                    const active = selected === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setTokenSelection("line0", t.id, o.id)}
                        className={`rounded-full border px-2 py-0.5 text-sm ${
                          active
                            ? "bg-neutral-900 text-white"
                            : "hover:bg-neutral-100"
                        }`}
                        title={o.tag || undefined}
                        aria-pressed={active}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                  <input
                    className="min-w-[140px] rounded-full border px-2 py-0.5 text-sm"
                    placeholder="Add your own"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const value = (
                          e.target as HTMLInputElement
                        ).value.trim();
                        if (value) {
                          setTokenSelection("line0", t.id, value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                    aria-label={`Add your own option for token ${i + 1}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t p-3 text-right">
        <button
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          onClick={() => {
            setCurrentLine(0);
            setCurrentView("notebook");
          }}
          aria-label="Compile line in notebook"
        >
          Compile Line in Notebook
        </button>
      </div>
    </div>
  );
}

export default WorkshopView;
