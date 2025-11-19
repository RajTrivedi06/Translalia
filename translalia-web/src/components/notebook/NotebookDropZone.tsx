"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import {
  TranslationCell,
  TranslationCellData,
  CellMode,
} from "./TranslationCell";
import { Package, ArrowDown, Sparkles } from "lucide-react";

interface NotebookDropZoneProps {
  cells: TranslationCellData[];
  mode: CellMode;
  onEditCell: (cellId: string) => void;
  onSaveCell: (cellId: string, text: string) => void;
  onCancelEdit: (cellId: string) => void;
  onRemoveCell: (cellId: string) => void;
  onToggleLock: (cellId: string) => void;
  canDrop?: boolean;
  isActive?: boolean;
  inactiveTitle?: string;
  inactiveDescription?: string;
  inactiveAction?: React.ReactNode;
}

export function NotebookDropZone({
  cells,
  mode,
  onEditCell,
  onSaveCell,
  onCancelEdit,
  onRemoveCell,
  onToggleLock,
  canDrop = true,
  isActive = false,
  inactiveTitle = "Select a line to translate",
  inactiveDescription = "Choose a line from the Workshop panel to begin dropping words.",
  inactiveAction,
}: NotebookDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: "notebook-dropzone",
    disabled: !canDrop,
  });

  const isEmpty = cells.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200",
        "flex flex-col items-center justify-center text-center",
        "min-h-[50px] p-2", // Increased height/padding for more space
        isOver
          ? "border-blue-400 bg-blue-50/50 scale-[1.02]"
          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
      )}
    >
      {!canDrop ? (
        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
          <div className="p-4 rounded-full bg-white border border-gray-200">
            <Sparkles className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">{inactiveTitle}</h3>
          <p className="text-sm text-gray-500">{inactiveDescription}</p>
          {inactiveAction ? <div className="mt-2">{inactiveAction}</div> : null}
        </div>
      ) : isEmpty ? (
        /* Empty State */
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-3">
            <div
              className={cn(
                "p-3 rounded-full transition-colors duration-200",
                isOver ? "bg-blue-100" : "bg-gray-100"
              )}
            >
              <Package
                className={cn(
                  "w-8 h-8 transition-colors duration-200",
                  isOver ? "text-blue-500" : "text-gray-400"
                )}
              />
            </div>
          </div>
          <h3
            className={cn(
              "text-lg font-medium mb-2 transition-colors duration-200",
              isOver ? "text-blue-700" : "text-gray-700"
            )}
          >
            {isOver ? "Drop here!" : "Drop words here"}
          </h3>

          {canDrop && isOver && (
            <div className="flex justify-center animate-bounce">
              <ArrowDown className="w-4 h-4 text-blue-500" />
            </div>
          )}
        </div>
      ) : (
        /* Cells List */
        <SortableContext
          items={cells.map((c) => c.id)}
          strategy={
            mode === "arrange"
              ? horizontalListSortingStrategy
              : verticalListSortingStrategy
          }
        >
          <div
            className={cn(
              mode === "arrange"
                ? "flex flex-wrap gap-2"
                : "flex flex-col space-y-3"
            )}
          >
            {cells.map((cell) => (
              <TranslationCell
                key={cell.id}
                cell={cell}
                mode={mode}
                onEdit={onEditCell}
                onSave={onSaveCell}
                onCancel={onCancelEdit}
                onRemove={onRemoveCell}
                onToggleLock={onToggleLock}
              />
            ))}
          </div>

          {/* Drop indicator when cells exist */}
          {canDrop && isOver && (
            <div className="mt-4 p-4 border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg flex items-center justify-center gap-2 animate-pulse">
              <ArrowDown className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-700 font-medium">
                Drop to add new cell
              </span>
            </div>
          )}
        </SortableContext>
      )}

      {canDrop && isActive && !isOver && (
        <div className="absolute top-4 right-4 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 shadow-sm transition-opacity">
          Drag words here
        </div>
      )}

      {/* Hover overlay */}
      {canDrop && isOver && !isEmpty && (
        <div className="absolute inset-0 pointer-events-none border-2 border-blue-500 rounded-lg bg-blue-50/10" />
      )}
    </div>
  );
}
