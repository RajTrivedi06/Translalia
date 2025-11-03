"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useWorkshopStore } from "@/store/workshopSlice";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LineNavigationProps {
  /** Callback when finalize button is clicked */
  onFinalizeLine?: (lineIndex: number, translation: string) => void;
  /** Optional: Current translation text for the line */
  currentTranslation?: string;
  /** Optional: Disable finalize if no translation */
  requireTranslation?: boolean;
}

/**
 * LineNavigation - Navigation controls for line-by-line translation
 *
 * Features:
 * - Previous/Next line navigation
 * - Save draft button
 * - Finalize line button (confirms translation is complete)
 * - Skip line button
 * - Current line indicator
 * - Keyboard shortcuts (Arrow keys, Enter to finalize)
 */
export function LineNavigation({
  onFinalizeLine,
  currentTranslation = "",
  requireTranslation = true,
}: LineNavigationProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const selectLine = useWorkshopStore((s) => s.selectLine);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);

  const totalLines = poemLines.length;
  const currentLine = selectedLineIndex ?? 0;
  const hasPrevious = currentLine > 0;
  const hasNext = currentLine < totalLines - 1;
  const isCurrentCompleted = completedLines[currentLine] !== undefined;
  const canFinalize =
    currentTranslation.trim().length > 0 || !requireTranslation;

  const handlePrevious = () => {
    if (hasPrevious) {
      selectLine(currentLine - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      selectLine(currentLine + 1);
    }
  };

  const handleSkip = () => {
    if (hasNext) {
      selectLine(currentLine + 1);
    }
  };

  const handleSaveDraft = () => {
    if (currentTranslation.trim()) {
      setCompletedLine(currentLine, currentTranslation);
    }
  };

  const handleFinalize = () => {
    if (canFinalize) {
      setCompletedLine(currentLine, currentTranslation);
      onFinalizeLine?.(currentLine, currentTranslation);

      // Auto-advance to next line if available
      if (hasNext) {
        setTimeout(() => selectLine(currentLine + 1), 300);
      }
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys for navigation (only if not in input/textarea)
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (!isInputField) {
        if (e.key === "ArrowLeft" && hasPrevious) {
          e.preventDefault();
          handlePrevious();
        } else if (e.key === "ArrowRight" && hasNext) {
          e.preventDefault();
          handleNext();
        }
      }

      // Cmd/Ctrl + Enter to finalize
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.key === "Enter" && canFinalize) {
        e.preventDefault();
        handleFinalize();
      }

      // Cmd/Ctrl + S to save draft
      if (modifier && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLine, hasPrevious, hasNext, canFinalize, currentTranslation]);

  if (totalLines === 0 || selectedLineIndex === null) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Current Line Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">
            Line {currentLine + 1} of {totalLines}
          </span>
          {isCurrentCompleted && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" />
              Completed
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {poemLines[currentLine]?.substring(0, 40)}
          {(poemLines[currentLine]?.length ?? 0) > 40 ? "..." : ""}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className="flex-shrink-0"
          title="Previous line (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Action Buttons (middle section) */}
        <div className="flex-1 flex items-center gap-2">
          {/* Save Draft */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveDraft}
            disabled={!currentTranslation.trim()}
            className="flex-1"
            title="Save draft (Cmd+S)"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>

          {/* Finalize Line */}
          <Button
            variant={isCurrentCompleted ? "outline" : "default"}
            size="sm"
            onClick={handleFinalize}
            disabled={!canFinalize}
            className={cn(
              "flex-1",
              !isCurrentCompleted && "bg-green-600 hover:bg-green-700"
            )}
            title="Finalize line (Cmd+Enter)"
          >
            <Check className="w-4 h-4 mr-2" />
            {isCurrentCompleted ? "Update" : "Finalize Line"}
          </Button>

          {/* Skip (only show if line is not completed) */}
          {!isCurrentCompleted && hasNext && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="flex-shrink-0"
              title="Skip to next line"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasNext}
          className="flex-shrink-0"
          title="Next line (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-gray-500 flex items-center gap-4">
        <span>← → Navigate</span>
        <span>Cmd+Enter Finalize</span>
        <span>Cmd+S Save</span>
      </div>
    </div>
  );
}
