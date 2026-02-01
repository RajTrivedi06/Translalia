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
        "relative rounded-lg border-2 border-dashed transition-all duration-200",
        "flex flex-col items-center justify-center text-center",
        "min-h-[80px] p-4",
        isOver
          ? "border-accent bg-accent/5 scale-[1.01] notebook-drop-active"
          : isActive
          ? "border-accent/50 bg-accent/5"
          : "border-border-subtle bg-transparent hover:border-foreground-muted/30",
        className
      )}
    >
      {children ? (
        children
      ) : !canDrop ? (
        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
          <div className="p-4 rounded-full bg-surface border border-border-subtle">
            <Sparkles className="w-10 h-10 text-foreground-disabled" />
          </div>
          <h3 className="text-lg font-medium text-foreground-secondary">{inactiveTitle}</h3>
          <p className="text-sm text-foreground-muted">{inactiveDescription}</p>
          {inactiveAction ? <div className="mt-2">{inactiveAction}</div> : null}
        </div>
      ) : (
        /* Empty State - warm, inviting design */
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-3">
            <div
              className={cn(
                "p-3 rounded-full transition-colors duration-200",
                isOver ? "bg-accent-light" : "bg-muted"
              )}
            >
              <Package
                className={cn(
                  "w-8 h-8 transition-colors duration-200",
                  isOver ? "text-accent" : "text-foreground-muted"
                )}
              />
            </div>
          </div>
          <h3
            className={cn(
              "text-lg font-medium mb-2 transition-colors duration-200",
              isOver ? "text-accent-dark" : "text-foreground-secondary"
            )}
          >
            {isOver ? "Drop here!" : "Drop words here"}
          </h3>
          <p className="text-sm text-foreground-muted mb-2">
            Words will be appended to your translation
          </p>

          {canDrop && isOver && (
            <div className="flex justify-center animate-bounce">
              <ArrowDown className="w-4 h-4 text-accent" />
            </div>
          )}
        </div>
      )}

      {canDrop && isActive && !isOver && (
        <div className="absolute top-2 right-2 text-xs font-medium text-accent bg-accent-light/50 border border-accent/30 rounded-full px-2.5 py-0.5 shadow-sm transition-opacity">
          Drop here
        </div>
      )}

      {/* Hover overlay with accent border */}
      {canDrop && isOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-accent rounded-lg bg-accent/5" />
      )}
    </div>
  );
}
