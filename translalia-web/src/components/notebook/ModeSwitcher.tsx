"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Move, Edit3, Keyboard } from "lucide-react";

export type NotebookMode = "arrange" | "edit";

interface ModeSwitcherProps {
  mode: NotebookMode;
  onModeChange: (mode: NotebookMode) => void;
  className?: string;
}

export function ModeSwitcher({ mode, onModeChange, className }: ModeSwitcherProps) {
  const isArrangeMode = mode === "arrange";
  const isEditMode = mode === "edit";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Mode Toggle Buttons */}
      <div className="inline-flex rounded-lg border bg-gray-100 p-1">
        <Button
          size="sm"
          variant={isArrangeMode ? "default" : "ghost"}
          className={cn(
            "h-8 px-3 text-xs font-medium transition-all",
            isArrangeMode
              ? "bg-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
          onClick={() => onModeChange("arrange")}
        >
          <Move className="w-3.5 h-3.5 mr-1.5" />
          Arrange
        </Button>
        <Button
          size="sm"
          variant={isEditMode ? "default" : "ghost"}
          className={cn(
            "h-8 px-3 text-xs font-medium transition-all",
            isEditMode
              ? "bg-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
          onClick={() => onModeChange("edit")}
        >
          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
        <Keyboard className="w-3 h-3" />
        <kbd className="px-1.5 py-0.5 rounded bg-gray-200 border border-gray-300 font-mono text-[10px]">
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+E
        </kbd>
      </div>

      {/* Mode Description */}
      <div className="text-xs text-gray-500 ml-2 hidden sm:block">
        {isArrangeMode
          ? "Drag cells to reorder"
          : "Click cells to edit text"}
      </div>
    </div>
  );
}

/**
 * Mode Indicator Badge - Shows current mode in a compact form
 */
export function ModeIndicatorBadge({ mode }: { mode: NotebookMode }) {
  const isArrangeMode = mode === "arrange";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        isArrangeMode
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : "bg-green-50 text-green-700 border border-green-200"
      )}
    >
      {isArrangeMode ? (
        <>
          <Move className="w-3 h-3" />
          <span>Arrange Mode</span>
        </>
      ) : (
        <>
          <Edit3 className="w-3 h-3" />
          <span>Edit Mode</span>
        </>
      )}
    </div>
  );
}
