"use client";

import * as React from "react";
import { X, RotateCcw, Save, Check } from "lucide-react";
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
      const translationLines = wholeTranslation.split("\n");

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
      if (e.key === "Escape") {
        handleClose();
        return;
      }

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

      translationLines.forEach((line, idx) => {
        if (idx < poemLines.length && line.trim()) {
          setCompletedLine(idx, line.trim());
        }
      });

      setDraftLines({});
      setHasUnsavedChanges(false);

      if (onFinalize) {
        onFinalize();
      }

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
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Get translation lines as array
  const translationLines = wholeTranslation.split("\n");

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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 h-8 text-xs"
              disabled={!hasUnsavedChanges}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-2 bg-slate-50/80 flex-shrink-0">
          <div className="px-8 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Source Poem
          </div>
          <div className="px-8 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Your Translation
          </div>
        </div>

        {/* Main Content - Row-based side by side */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 min-h-full">
            {/* Source Poem Column */}
            <div className="px-8 py-6 bg-slate-50/30">
              <div className="space-y-1">
                {poemLines.map((line, idx) => (
                  <div
                    key={`source-${idx}`}
                    className="text-lg leading-relaxed text-slate-700 min-h-[2rem] flex items-center"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {line || <span className="opacity-0">.</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Translation Poem Column */}
            <div className="px-8 py-6 bg-white">
              <div className="space-y-1">
                {poemLines.map((_, idx) => {
                  const lineValue = translationLines[idx] ?? "";
                  return (
                    <div
                      key={`translation-${idx}`}
                      className="min-h-[2rem] flex items-center"
                    >
                      <textarea
                        value={lineValue}
                        onChange={(e) => {
                          const lines = [...translationLines];
                          // Ensure array has enough elements
                          while (lines.length <= idx) {
                            lines.push("");
                          }
                          lines[idx] = e.target.value;
                          setWholeTranslation(lines.join("\n"));
                          setHasUnsavedChanges(true);
                        }}
                        className={cn(
                          "w-full resize-none border-0 bg-transparent p-0",
                          "text-lg leading-relaxed text-slate-800",
                          "focus:outline-none focus:ring-0",
                          "placeholder:text-slate-300 placeholder:italic",
                          !lineValue && "italic text-slate-300"
                        )}
                        placeholder="..."
                        spellCheck={false}
                        rows={1}
                        style={{
                          fontFamily: "Georgia, serif",
                          minHeight: "2rem",
                          overflow: "hidden",
                          lineHeight: "1.75",
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = "auto";
                          target.style.height = `${Math.max(
                            32,
                            target.scrollHeight
                          )}px`;
                        }}
                      />
                    </div>
                  );
                })}
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
