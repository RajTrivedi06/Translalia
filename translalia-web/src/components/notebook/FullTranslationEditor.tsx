"use client";

import * as React from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useWorkshopState } from "@/lib/hooks/useWorkshopFlow";
import { useSaveManualLine } from "@/lib/hooks/useWorkshopFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FullTranslationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalize?: () => void;
}

export function FullTranslationEditor({
  open,
  onOpenChange,
  onFinalize,
}: FullTranslationEditorProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const setDraftLines = useWorkshopStore((s) => s.setDraftLines);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);

  const threadId = useThreadId() || undefined;
  const { data: savedWorkshopLines } = useWorkshopState(threadId);
  const saveManualLine = useSaveManualLine();

  const [wholeTranslation, setWholeTranslation] = React.useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [isSourceCollapsed, setIsSourceCollapsed] = React.useState(false);

  // Get confirmed translations
  const getConfirmedTranslation = React.useCallback(
    (idx: number) => {
      if (!savedWorkshopLines || typeof savedWorkshopLines !== "object") {
        return null;
      }
      const entry = (savedWorkshopLines as Record<number, unknown>)[idx];
      if (!entry || typeof entry !== "object") return null;
      const translated = (entry as { translated?: unknown }).translated;
      return typeof translated === "string" && translated.trim().length > 0
        ? translated
        : null;
    },
    [savedWorkshopLines]
  );

  // Get current value (draft or confirmed)
  const getStudioValue = React.useCallback(
    (idx: number) => {
      const hasDraft = Object.prototype.hasOwnProperty.call(draftLines, idx);
      const draft = hasDraft ? draftLines[idx] : null;
      const confirmed = getConfirmedTranslation(idx);
      return draft ?? confirmed ?? "";
    },
    [draftLines, getConfirmedTranslation]
  );

  // Assemble whole translation from current state
  const assembleWholeTranslation = React.useCallback(() => {
    return poemLines.map((_, idx) => getStudioValue(idx) || "").join("\n");
  }, [poemLines, getStudioValue]);

  // Initialize translation when opening
  React.useEffect(() => {
    if (open && !wholeTranslation) {
      setWholeTranslation(assembleWholeTranslation());
      setHasUnsavedChanges(false);
    }
  }, [open, wholeTranslation, assembleWholeTranslation]);

  // Reset when closing
  React.useEffect(() => {
    if (!open) {
      setWholeTranslation("");
      setHasUnsavedChanges(false);
      setSaveSuccess(false);
    }
  }, [open]);

  // Handle close with unsaved changes check
  const handleClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      if (
        !confirm(
          "You have unsaved changes. Are you sure you want to close without saving?"
        )
      ) {
        return;
      }
    }
    onOpenChange(false);
  }, [hasUnsavedChanges, onOpenChange]);

  // Click outside to close
  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Save as draft
  const handleSaveDraft = React.useCallback(async () => {
    if (!threadId || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      // Split the whole translation back into lines
      const translationLines = wholeTranslation.split("\n");

      // Only store drafts that differ from confirmed saves
      const nextDraftLines: Record<number, string> = {};
      translationLines.forEach((line, idx) => {
        if (idx < poemLines.length) {
          const draft = line.trim();
          const confirmed = (getConfirmedTranslation(idx) ?? "").trim();
          if (draft !== confirmed && draft.length > 0) {
            nextDraftLines[idx] = draft;
          }
        }
      });

      // Save into drafts
      setDraftLines(nextDraftLines);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [
    threadId,
    hasUnsavedChanges,
    wholeTranslation,
    poemLines.length,
    getConfirmedTranslation,
    setDraftLines,
  ]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      // Cmd/Ctrl + Enter to save draft
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          handleSaveDraft();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasUnsavedChanges, isSaving, handleClose, handleSaveDraft]);

  // Finalize and submit all lines
  const handleFinalize = React.useCallback(async () => {
    if (!threadId) return;

    setIsFinalizing(true);
    const translationLines = wholeTranslation.split("\n");

    try {
      // Save all lines as completed
      const savePromises = translationLines
        .map((line) => line.trim())
        .map((translatedLine, idx) => {
          if (idx >= poemLines.length || !translatedLine) return null;

          return saveManualLine.mutateAsync({
            threadId,
            lineIndex: idx,
            originalLine: poemLines[idx] ?? "",
            translatedLine,
          });
        })
        .filter(
          (
            p
          ): p is Promise<{
            ok: boolean;
            translatedLine: string;
            lineIndex: number;
          }> => p !== null
        );

      await Promise.all(savePromises);

      // Mark all as completed in store
      translationLines.forEach((line, idx) => {
        if (idx < poemLines.length && line.trim()) {
          setCompletedLine(idx, line.trim());
        }
      });

      // Clear drafts
      setDraftLines({});
      setHasUnsavedChanges(false);

      // Trigger onFinalize callback if provided
      if (onFinalize) {
        onFinalize();
      }

      // Close the editor
      onOpenChange(false);
    } catch (error) {
      console.error("[FullTranslationEditor] Failed to finalize:", error);
      alert("Failed to finalize some lines. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  }, [
    threadId,
    wholeTranslation,
    poemLines,
    saveManualLine,
    setCompletedLine,
    setDraftLines,
    onOpenChange,
    onFinalize,
  ]);

  // Reset to original
  const handleReset = React.useCallback(() => {
    setWholeTranslation(assembleWholeTranslation());
    setHasUnsavedChanges(false);
  }, [assembleWholeTranslation]);

  // Calculate completion stats
  const completedCount = React.useMemo(() => {
    let count = 0;
    for (let idx = 0; idx < poemLines.length; idx++) {
      if (getConfirmedTranslation(idx) !== null) count++;
    }
    return count;
  }, [poemLines.length, getConfirmedTranslation]);

  const totalLines = poemLines.length;
  const progressPercentage =
    totalLines > 0 ? Math.round((completedCount / totalLines) * 100) : 0;

  // Use a ref to track if we should render (for exit animation)
  const [shouldRender, setShouldRender] = React.useState(open);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
    } else {
      // Delay unmount to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          "transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Content */}
      <div
        className={cn(
          "relative bg-white rounded-3xl shadow-2xl",
          "w-full max-w-[90vw] h-[85vh]",
          "flex flex-col overflow-hidden",
          "transform transition-all duration-300 ease-out",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Full Translation Editor
            </h2>
            <Badge variant="secondary" className="text-xs">
              {completedCount} of {totalLines} lines ({progressPercentage}%)
            </Badge>
            {hasUnsavedChanges && (
              <Badge
                variant="secondary"
                className="text-xs text-amber-600 bg-amber-50"
              >
                Unsaved changes
              </Badge>
            )}
            {saveSuccess && (
              <Badge
                variant="secondary"
                className="text-xs text-green-600 bg-green-50"
              >
                <Check className="w-3 h-3 mr-1" />
                Saved!
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 flex relative">
          {/* Source Panel */}
          <div
            className={cn(
              "border-r bg-slate-50 transition-all duration-300 ease-in-out",
              isSourceCollapsed
                ? "w-0 overflow-hidden opacity-0"
                : "w-[40%] min-w-[300px] opacity-100"
            )}
          >
            <div className="h-full flex flex-col">
              {/* Source Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Source Poem
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSourceCollapsed(true)}
                  className="rounded p-1.5 hover:bg-slate-100 transition-colors"
                  aria-label="Collapse source"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Source Content */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-1">
                  {poemLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <span className="text-xs text-slate-400 font-mono w-8 flex-shrink-0 pt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700 leading-relaxed flex-1">
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Collapsed Source Toggle */}
          {isSourceCollapsed && (
            <button
              type="button"
              onClick={() => setIsSourceCollapsed(false)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white border-r border-t border-b rounded-r-lg p-2 shadow-lg hover:bg-slate-50 transition-colors"
              aria-label="Expand source"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          )}

          {/* Translation Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Translation Header */}
            <div className="px-6 py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Your Translation
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Edit the complete translation as continuous text
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="gap-1.5"
                    disabled={!hasUnsavedChanges}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Translation Textarea */}
            <div className="flex-1 p-6 min-h-0">
              <textarea
                value={wholeTranslation}
                onChange={(e) => {
                  setWholeTranslation(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="w-full h-full resize-none border-0 focus:outline-none focus:ring-0 text-base leading-relaxed font-sans text-slate-900 placeholder:text-slate-400"
                placeholder="Your complete translation will appear here..."
                spellCheck={false}
              />
            </div>

            {/* Translation Footer */}
            <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
              <div className="flex items-center gap-4">
                <span>
                  {wholeTranslation.split("\n").length} line
                  {wholeTranslation.split("\n").length !== 1 ? "s" : ""}
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono">
                    ⌘/Ctrl
                  </kbd>{" "}
                  +{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono">
                    Enter
                  </kbd>{" "}
                  to save draft
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t px-6 py-4 bg-white flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-slate-600">
            {totalLines - completedCount > 0 ? (
              <span>
                {totalLines - completedCount} line
                {totalLines - completedCount !== 1 ? "s" : ""} remaining
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <Check className="w-4 h-4" />
                Translation complete!
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing || !wholeTranslation.trim()}
              className="gap-2 bg-slate-900 hover:bg-slate-800"
            >
              <Check className="h-4 w-4" />
              {isFinalizing ? "Finalizing..." : "Finalize & Submit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
