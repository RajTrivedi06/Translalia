"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Package, ArrowDown, Sparkles } from "lucide-react";

interface NotebookDropZoneProps {
  canDrop?: boolean;
  isActive?: boolean;
  inactiveTitle?: string;
  inactiveDescription?: string;
  inactiveAction?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  dropzoneId?: string;
}

/**
 * Simplified NotebookDropZone - Phase 2
 * No longer uses cells, just a drop target that appends text to drafts
 */
export function NotebookDropZone({
  canDrop = true,
  isActive = false,
  inactiveTitle = "Select a line to translate",
  inactiveDescription = "Choose a line from the Workshop panel to begin translating.",
  inactiveAction,
  className,
  children,
  dropzoneId = "notebook-dropzone",
}: NotebookDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropzoneId,
    disabled: !canDrop,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200",
        "flex flex-col items-center justify-center text-center",
        "min-h-[80px] p-4",
        isOver
          ? "border-blue-400 bg-blue-50/50 scale-[1.02]"
          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50",
        className
      )}
    >
      {children ? (
        children
      ) : !canDrop ? (
        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
          <div className="p-4 rounded-full bg-white border border-gray-200">
            <Sparkles className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">{inactiveTitle}</h3>
          <p className="text-sm text-gray-500">{inactiveDescription}</p>
          {inactiveAction ? <div className="mt-2">{inactiveAction}</div> : null}
        </div>
      ) : (
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
          <p className="text-sm text-gray-500 mb-2">
            Words will be appended to your translation
          </p>

          {canDrop && isOver && (
            <div className="flex justify-center animate-bounce">
              <ArrowDown className="w-4 h-4 text-blue-500" />
            </div>
          )}
        </div>
      )}

      {canDrop && isActive && !isOver && (
        <div className="absolute top-4 right-4 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 shadow-sm transition-opacity">
          Drag words here
        </div>
      )}

      {/* Hover overlay */}
      {canDrop && isOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-blue-500 rounded-lg bg-blue-50/10" />
      )}
    </div>
  );
}
