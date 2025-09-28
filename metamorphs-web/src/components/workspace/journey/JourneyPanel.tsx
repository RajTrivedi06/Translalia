"use client";

import NotebookPanel from "@/components/notebook/NotebookPanel";

export function JourneyPanel() {
  // TODO(post-MVP): Journey/Compare controls (optional)
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" aria-label="Notebook">
      <div className="px-4 py-3 font-semibold">Notebook</div>
      <div className="flex-1 overflow-y-auto px-4">
        <NotebookPanel />
      </div>
    </div>
  );
}
