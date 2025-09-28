"use client";
import * as React from "react";
import NotebookPanel from "@/components/notebook/NotebookPanel";
import { useWorkspace } from "@/store/workspace";

export function NotebookView() {
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  // future: use currentLine to prefill content

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 flex items-center justify-between">
        <div className="font-semibold">Notebook</div>
        <button
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => setCurrentView("workshop")}
          aria-label="Back to Workshop"
        >
          Back to Workshop
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-2 text-xs text-neutral-500">Meter: — | Rhyme: —</div>
        <NotebookPanel />
      </div>
    </div>
  );
}

export default NotebookView;
