"use client";

import * as React from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useNotebookStore } from "@/store/notebookSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useNotebookCells } from "@/lib/hooks/useNotebookFlow";
import { NotebookToolbar } from "./NotebookToolbar";
import { NotebookCellView } from "./NotebookCell";
import { NotebookSkeleton } from "./NotebookSkeleton";
import { EmptyState } from "./EmptyState";

function applyFilterFactory(
  filter: ReturnType<typeof useNotebookStore.getState>["filter"]
) {
  return function applyFilter(cell: import("@/types/notebook").NotebookCell) {
    switch (filter) {
      case "untranslated":
        return cell.translation.text.trim().length === 0;
      case "needs_review":
        return cell.translation.status === "draft";
      case "locked":
        return (cell.translation.lockedWords || []).length > 0;
      case "with_notes":
        return (cell.notes || []).length > 0;
      default:
        return true;
    }
  };
}

export function NotebookPane() {
  const threadId = useThreadId();
  const filter = useNotebookStore((s) => s.filter);
  const focusedCellIndex = useNotebookStore((s) => s.focusedCellIndex);
  const setCells = useNotebookStore((s) => s.setCells);

  // Fetch cells from API
  const { data, isLoading } = useNotebookCells(threadId);

  // Sync cells to store when data changes
  React.useEffect(() => {
    if (data?.cells) {
      setCells(data.cells);
    }
  }, [data, setCells]);

  // Get cells from store (updated via setCells)
  const cells = useNotebookStore((s) => s.cells);

  const applyFilter = React.useMemo(() => applyFilterFactory(filter), [filter]);

  return (
    <div className="h-full flex flex-col">
      <NotebookToolbar />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <NotebookSkeleton />}

        {cells.length === 0 && <EmptyState />}

        <SortableContext
          items={cells.filter(applyFilter).map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cells.filter(applyFilter).map((cell, index) => (
            <NotebookCellView
              key={cell.id}
              cell={cell}
              isFocused={focusedCellIndex === index}
              index={index}
              threadId={threadId || undefined}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
