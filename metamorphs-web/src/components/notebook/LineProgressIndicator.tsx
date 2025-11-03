"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { cn } from "@/lib/utils";
import { Check, Circle, Lock } from "lucide-react";

export interface LineProgressIndicatorProps {
  /** Optional: Show compact version */
  compact?: boolean;
  /** Optional: Orientation */
  orientation?: "horizontal" | "vertical";
  /** Optional: Click handler for line selection */
  onLineClick?: (lineIndex: number) => void;
}

/**
 * LineProgressIndicator - Visual progress tracker for poem translation
 *
 * Shows all lines with their completion status:
 * - Empty circle: Untranslated
 * - Filled circle: In progress (has draft)
 * - Check mark: Finalized
 * - Lock icon: Locked (cannot edit)
 *
 * Features:
 * - Visual connection lines between dots
 * - Current line highlight
 * - Completion percentage
 * - Clickable for navigation (optional)
 */
export function LineProgressIndicator({
  compact = false,
  orientation = "horizontal",
  onLineClick,
}: LineProgressIndicatorProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);

  const totalLines = poemLines.length;
  const completedCount = Object.keys(completedLines).length;
  const progressPercentage = totalLines > 0 ? Math.round((completedCount / totalLines) * 100) : 0;

  if (totalLines === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No poem loaded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress Summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">
          Translation Progress
        </span>
        <span className="text-gray-600">
          {completedCount} / {totalLines} lines ({progressPercentage}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Line Dots */}
      {orientation === "horizontal" ? (
        <HorizontalLineIndicator
          poemLines={poemLines}
          completedLines={completedLines}
          selectedLineIndex={selectedLineIndex}
          onLineClick={onLineClick}
          compact={compact}
        />
      ) : (
        <VerticalLineIndicator
          poemLines={poemLines}
          completedLines={completedLines}
          selectedLineIndex={selectedLineIndex}
          onLineClick={onLineClick}
          compact={compact}
        />
      )}
    </div>
  );
}

interface LineIndicatorProps {
  poemLines: string[];
  completedLines: Record<number, string>;
  selectedLineIndex: number | null;
  onLineClick?: (lineIndex: number) => void;
  compact: boolean;
}

function HorizontalLineIndicator({
  poemLines,
  completedLines,
  selectedLineIndex,
  onLineClick,
  compact,
}: LineIndicatorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {poemLines.map((_, idx) => {
        const isCompleted = completedLines[idx] !== undefined;
        const isCurrent = selectedLineIndex === idx;
        const isClickable = !!onLineClick;

        return (
          <React.Fragment key={idx}>
            <button
              onClick={() => onLineClick?.(idx)}
              disabled={!isClickable}
              className={cn(
                "flex-shrink-0 transition-all",
                isClickable && "cursor-pointer hover:scale-110"
              )}
              title={`Line ${idx + 1}${isCompleted ? " (Completed)" : ""}`}
            >
              <LineStatusDot
                index={idx}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                compact={compact}
              />
            </button>
            {/* Connector Line */}
            {idx < poemLines.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-shrink-0",
                  isCompleted ? "bg-green-500" : "bg-gray-300",
                  compact ? "w-2" : "w-4"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function VerticalLineIndicator({
  poemLines,
  completedLines,
  selectedLineIndex,
  onLineClick,
  compact,
}: LineIndicatorProps) {
  return (
    <div className="space-y-1">
      {poemLines.map((line, idx) => {
        const isCompleted = completedLines[idx] !== undefined;
        const isCurrent = selectedLineIndex === idx;
        const isClickable = !!onLineClick;

        return (
          <div key={idx} className="flex items-center gap-3">
            <button
              onClick={() => onLineClick?.(idx)}
              disabled={!isClickable}
              className={cn(
                "flex-shrink-0 transition-all",
                isClickable && "cursor-pointer hover:scale-110"
              )}
              title={`Line ${idx + 1}${isCompleted ? " (Completed)" : ""}`}
            >
              <LineStatusDot
                index={idx}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                compact={compact}
              />
            </button>
            {!compact && (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-600 truncate">
                  Line {idx + 1}: {line.substring(0, 30)}
                  {line.length > 30 ? "..." : ""}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface LineStatusDotProps {
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  compact: boolean;
}

function LineStatusDot({
  index,
  isCompleted,
  isCurrent,
  compact,
}: LineStatusDotProps) {
  const size = compact ? "w-3 h-3" : "w-6 h-6";
  const iconSize = compact ? "w-2 h-2" : "w-3.5 h-3.5";

  if (isCompleted) {
    return (
      <div
        className={cn(
          size,
          "rounded-full bg-green-500 flex items-center justify-center",
          isCurrent && "ring-2 ring-green-300 ring-offset-2"
        )}
      >
        <Check className={cn(iconSize, "text-white")} />
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div
        className={cn(
          size,
          "rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-blue-300 ring-offset-2"
        )}
      >
        <span className="text-white text-xs font-medium">{index + 1}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        size,
        "rounded-full border-2 border-gray-300 bg-white flex items-center justify-center"
      )}
    >
      <Circle className={cn(iconSize, "text-gray-400")} />
    </div>
  );
}
