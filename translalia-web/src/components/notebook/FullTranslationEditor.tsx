"use client";

import * as React from "react";
import { X, RotateCcw, Save, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useWorkshopState, useSaveManualLineWithoutInvalidation } from "@/lib/hooks/useWorkshopFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FullTranslationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FullTranslationEditor({
  open,
  onOpenChange,
}: FullTranslationEditorProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const setDraftLines = useWorkshopStore((s) => s.setDraftLines);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);
  const clearDraft = useWorkshopStore((s) => s.clearDraft);

  const threadId = useThreadId() || undefined;
  const { data: savedWorkshopLines } = useWorkshopState(threadId);
  const saveManualLineBatch = useSaveManualLineWithoutInvalidation();
  const queryClient = useQueryClient();

  const [wholeTranslation, setWholeTranslation] = React.useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

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
  // Include extra lines beyond poemLines.length if they exist in DB or drafts
  const assembleWholeTranslation = React.useCallback(() => {
    // Find the max line index across all sources
    let maxIndex = poemLines.length - 1;

    // Check savedWorkshopLines for extra lines (handles both array and object format)
    if (savedWorkshopLines) {
      if (Array.isArray(savedWorkshopLines)) {
        maxIndex = Math.max(maxIndex, savedWorkshopLines.length - 1);
      } else {
        const dbIndices = Object.keys(savedWorkshopLines).map(Number).filter(n => !isNaN(n));
        if (dbIndices.length > 0) {
          maxIndex = Math.max(maxIndex, ...dbIndices);
        }
      }
    }

    // Check draftLines for extra lines
    const draftIndices = Object.keys(draftLines).map(Number).filter(n => !isNaN(n));
    if (draftIndices.length > 0) {
      maxIndex = Math.max(maxIndex, ...draftIndices);
    }

    // Build the translation including all lines up to maxIndex
    const lines: string[] = [];
    for (let idx = 0; idx <= maxIndex; idx++) {
      lines.push(getStudioValue(idx) || "");
    }
    return lines.join("\n");
  }, [poemLines.length, savedWorkshopLines, draftLines, getStudioValue]);

  // Initialize translation when opening
  React.useEffect(() => {
    if (open && !wholeTranslation) {
      setWholeTranslation(assembleWholeTranslation());
      setHasUnsavedChanges(false);
    }
  }, [open, wholeTranslation, assembleWholeTranslation]);

  // Resync when drafts/completed lines change while open (but only if no unsaved changes)
  React.useEffect(() => {
    if (open && !hasUnsavedChanges) {
      const newTranslation = assembleWholeTranslation();
      if (newTranslation !== wholeTranslation) {
        setWholeTranslation(newTranslation);
      }
    }
  }, [open, hasUnsavedChanges, assembleWholeTranslation, draftLines]);

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

  // Save to database (not just local drafts) so lines get green ticks
  const handleSaveDraft = React.useCallback(async () => {
    if (!threadId || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      // Split and sanitize any embedded newlines
      const translationLines = wholeTranslation
        .split("\n")
        .map((line) => line.replace(/[\r\n]+/g, " ").trim());

      // Collect ALL lines to save to database (including extras beyond source length)
      // This gives users full flexibility to add as many lines as needed
      const linesToSave: Array<{ lineIndex: number; text: string }> = [];
      for (let idx = 0; idx < translationLines.length; idx++) {
        const text = translationLines[idx].trim();
        // Only save non-empty lines
        if (text.length > 0) {
          linesToSave.push({ lineIndex: idx, text });
        }
      }

      // Save all lines to the database sequentially
      const saveResults: Array<{ lineIndex: number; text: string; success: boolean }> = [];
      for (const { lineIndex, text } of linesToSave) {
        try {
          await saveManualLineBatch.mutateAsync({
            threadId,
            lineIndex,
            // For extra lines beyond source, use empty string as original
            originalLine: poemLines[lineIndex] ?? "",
            translatedLine: text,
          });
          saveResults.push({ lineIndex, text, success: true });
        } catch (lineError) {
          console.error(
            `[FullTranslationEditor] Failed to save line ${lineIndex}:`,
            lineError
          );
          saveResults.push({ lineIndex, text, success: false });
        }
      }

      const successCount = saveResults.filter((r) => r.success).length;

      // Update Zustand store immediately so the Notebook progress bar updates
      // (WorkshopRail may be collapsed when Editing is open, so its sync effect
      // won't run—we must update the store ourselves)
      for (const { lineIndex, text, success } of saveResults) {
        if (success) {
          setCompletedLine(lineIndex, text);
          clearDraft(lineIndex);
        }
      }

      // Clear any remaining drafts (e.g. lines that weren't in linesToSave)
      setDraftLines({});

      // Invalidate for consistency when Workshop is opened
      await queryClient.invalidateQueries({
        queryKey: ["workshop-state", threadId],
      });

      console.log(
        `[FullTranslationEditor] Saved ${successCount}/${linesToSave.length} lines to database`
      );

      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("[FullTranslationEditor] Failed to save:", e);
    } finally {
      setIsSaving(false);
    }
  }, [
    threadId,
    hasUnsavedChanges,
    wholeTranslation,
    poemLines,
    saveManualLineBatch,
    queryClient,
    setDraftLines,
    setCompletedLine,
    clearDraft,
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

  // Reset to original
  const handleReset = React.useCallback(() => {
    setWholeTranslation(assembleWholeTranslation());
    setHasUnsavedChanges(false);
  }, [assembleWholeTranslation]);

  // Calculate completion stats - count ALL saved lines including extras
  const { completedCount, totalSavedLines } = React.useMemo(() => {
    let count = 0;
    let maxSavedIndex = -1;

    // Count from savedWorkshopLines (handles both array and object format)
    if (savedWorkshopLines) {
      if (Array.isArray(savedWorkshopLines)) {
        savedWorkshopLines.forEach((v, idx) => {
          if (v && typeof v === "object") {
            const translated = (v as { translated?: string }).translated;
            if (typeof translated === "string" && translated.trim().length > 0) {
              count++;
              maxSavedIndex = Math.max(maxSavedIndex, idx);
            }
          }
        });
      } else {
        Object.entries(savedWorkshopLines).forEach(([k, v]) => {
          const idx = Number(k);
          if (!isNaN(idx) && v && typeof v === "object") {
            const translated = (v as { translated?: string }).translated;
            if (typeof translated === "string" && translated.trim().length > 0) {
              count++;
              maxSavedIndex = Math.max(maxSavedIndex, idx);
            }
          }
        });
      }
    }

    return { completedCount: count, totalSavedLines: maxSavedIndex + 1 };
  }, [savedWorkshopLines]);

  const totalSourceLines = poemLines.length;
  const progressPercentage =
    totalSourceLines > 0 ? Math.round((completedCount / totalSourceLines) * 100) : 0;

  // Count translation lines for line count indicator
  const translationLineCount = wholeTranslation.split("\n").length;

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
            <h2 className="text-2xl font-bold text-foreground">
              Full Translation Editor
            </h2>
            <Badge variant="secondary" className="text-xs">
              {completedCount} of {totalSourceLines} lines ({progressPercentage}%)
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
        <div className="grid grid-cols-2 bg-muted/80 flex-shrink-0">
          <div className="px-8 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Source Poem
          </div>
          <div className="px-8 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Your Translation
          </div>
        </div>

        {/* Main Content - Source reference + free-form translation editor */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-2">
          {/* Source Poem Column - Read-only reference with line numbers */}
          <div className="overflow-y-auto border-r border-border bg-muted/30">
            <div className="px-6 py-6">
              <div className="space-y-0">
                {poemLines.map((line, idx) => (
                  <div
                    key={`source-${idx}`}
                    className="flex items-start gap-3 min-h-[1.75rem]"
                  >
                    <span className="text-xs text-slate-400 font-mono w-5 text-right flex-shrink-0 pt-0.5">
                      {idx + 1}
                    </span>
                    <span
                      className="text-lg leading-relaxed text-foreground-secondary flex-1"
                      style={{ fontFamily: "Georgia, serif", lineHeight: "1.75" }}
                    >
                      {line || <span className="opacity-30 italic">empty line</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Translation Column - Single free-form textarea */}
          <div className="overflow-y-auto bg-white">
            <div className="px-6 py-6 h-full">
              <textarea
                value={wholeTranslation}
                onChange={(e) => {
                  setWholeTranslation(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className={cn(
                  "w-full h-full min-h-[400px] resize-none border-0 bg-transparent p-0",
                  "text-lg text-foreground",
                  "focus:outline-none focus:ring-0",
                  "placeholder:text-slate-300 placeholder:italic"
                )}
                placeholder="Type your translation here...&#10;&#10;Each line corresponds to a source line.&#10;Press Enter to create new lines."
                spellCheck={false}
                style={{
                  fontFamily: "Georgia, serif",
                  lineHeight: "1.75",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t px-6 py-4 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4 text-sm">
            {/* Line count indicator */}
            <span className="font-mono text-slate-500">
              {translationLineCount} translation lines
            </span>
            <span className="text-slate-400 text-xs">
              ({totalSourceLines} source)
            </span>
            <span className="text-slate-300">|</span>
            {/* Completion status */}
            <span className="text-slate-600">
              {totalSourceLines - completedCount > 0 ? (
                <span>
                  {totalSourceLines - completedCount} line
                  {totalSourceLines - completedCount !== 1 ? "s" : ""} to confirm
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <Check className="w-4 h-4" />
                  All confirmed!
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save All"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
