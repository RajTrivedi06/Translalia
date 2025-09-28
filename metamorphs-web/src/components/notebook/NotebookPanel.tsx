"use client";
import { useState } from "react";
export default function NotebookPanel({ initial = "" }: { initial?: string }) {
  const [val, setVal] = useState(initial);
  return (
    <div>
      <textarea
        className="w-full min-h-[240px] rounded-xl border p-3"
        aria-label="Notebook"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Draft your version here…"
      />
      <div className="mt-2 flex items-center justify-between text-xs opacity-70">
        <span>{val.length} chars</span>
        <button className="rounded-lg border px-2 py-1" disabled>
          Export (soon)
        </button>
      </div>
    </div>
  );
}
