"use client";
import * as React from "react";
import NotebookPanel from "@/components/notebook/NotebookPanel";
import { useWorkspace } from "@/store/workspace";

export function NotebookView() {
  const txt = useWorkspace((s) => s.workshopDraft.notebookText);
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  const clearNotebookDraft = useWorkspace((s) => s.clearNotebookDraft);

  return (
    <div>
      <h1 className="text-base font-semibold mb-3">Notebook</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          onClick={() => setCurrentView("workshop")}
        >
          ← Back to Workshop
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          onClick={() => clearNotebookDraft()}
        >
          Clear draft
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(txt);
            } catch {
              // Silently fail if clipboard API is not available
            }
          }}
        >
          Copy
        </button>
      </div>

      <NotebookPanel initial={txt} />
    </div>
  );
}

export default NotebookView;
