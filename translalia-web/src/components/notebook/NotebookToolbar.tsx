"use client";

import * as React from "react";
import { useNotebookStore } from "@/store/notebookSlice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotebookToolbar() {
  const cells = useNotebookStore((s) => s.cells);
  const filter = useNotebookStore((s) => s.filter);
  const setFilter = useNotebookStore((s) => s.setFilter);
  const view = useNotebookStore((s) => s.view);
  const togglePrismatic = useNotebookStore((s) => s.togglePrismatic);
  const setShowLineNumbers = useNotebookStore((s) => s.setShowLineNumbers);

  const completed = cells.filter(
    (c) => c.translation.text.trim().length > 0
  ).length;

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">Notebook</h2>
        <Badge variant="secondary" className="text-xs">
          {completed}/{cells.length} lines complete
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1">
          {(
            [
              "all",
              "untranslated",
              "needs_review",
              "locked",
              "with_notes",
            ] as const
          ).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f.replace("_", " ")}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          variant={view.showPrismatic ? "default" : "outline"}
          onClick={togglePrismatic}
        >
          Prismatic
        </Button>
        <Button
          size="sm"
          variant={view.showLineNumbers ? "default" : "outline"}
          onClick={() => setShowLineNumbers(!view.showLineNumbers)}
        >
          Line numbers
        </Button>
      </div>
    </div>
  );
}
