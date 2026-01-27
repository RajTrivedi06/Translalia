"use client";

import * as React from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { FileText, X, Save } from "lucide-react";

import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useSaveManualLine, useSaveManualLineWithoutInvalidation } from "@/lib/hooks/useWorkshopFlow";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { NotebookDropZone } from "./NotebookDropZone";
import { FullTranslationEditor } from "./FullTranslationEditor";
import { CompletionConfirmationDialog } from "./CompletionConfirmationDialog";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";
import { NotebookNotesPanel } from "./NotebookNotesPanel";
import { useNotebookStore } from "@/store/notebookSlice";

interface NotebookPhase6Props {
  projectId?: string;
  showTitle?: boolean;
  onOpenEditing?: () => void;
}

/**
 * NotebookPhase6 (Phase 2) — "Real notebook" surface
 * - Left: full source poem (clickable)
 * - Right: full translation poem (draft/completed/empty)
 * - Bottom: sticky working area (drop + click-to-append friendly)
 * - ComparisonView remains as a contextual tool (modal)
 */
export default function NotebookPhase6({
  // projectId currently unused in this simplified surface (kept for compatibility)
  projectId: _projectId,
  showTitle = true,
  onOpenEditing,
}: NotebookPhase6Props = {}) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const setDraft = useWorkshopStore((s) => s.setDraft);
  const clearDraft = useWorkshopStore((s) => s.clearDraft);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);
  const getDisplayText = useWorkshopStore((s) => s.getDisplayText);

  const threadId = useThreadId();
  const saveManualLine = useSaveManualLine();
  const saveManualLineBatch = useSaveManualLineWithoutInvalidation();
  const queryClient = useQueryClient();
  const toggleNotesPanel = useNotebookStore((s) => s.toggleNotesPanel);

  const [showFullEditor, setShowFullEditor] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = React.useState(false);
  const [hoveredLineIndex, setHoveredLineIndex] = React.useState<number | null>(
    null
  );
  const [showCompletionDialog, setShowCompletionDialog] = React.useState(false);
  const [showCongratulations, setShowCongratulations] = React.useState(false);
  const [hasShownCompletionDialog, setHasShownCompletionDialog] =
    React.useState(false);
  const [hasOpenedEditing, setHasOpenedEditing] = React.useState(false);
  const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>(
    {}
  );
  const autoSaveTimeoutRef = React.useRef<Record<number, NodeJS.Timeout>>({});

  // Auto-resize textareas when text changes
  React.useEffect(() => {
    Object.values(textareaRefs.current).forEach((textarea) => {
      if (textarea) {
        const currentValue = textarea.value;
        if (!currentValue || currentValue.trim().length === 0) {
          textarea.style.height = "1.5rem";
          textarea.style.overflowY = "hidden";
        } else {
          textarea.style.height = "1.5rem";
          const scrollHeight = textarea.scrollHeight;
          const lineHeight =
            parseFloat(getComputedStyle(textarea).lineHeight) || 24;
          const maxHeight = lineHeight * 4;
          const newHeight = Math.max(24, Math.min(scrollHeight, maxHeight));
          textarea.style.height = `${newHeight}px`;
          textarea.style.overflowY =
            scrollHeight > maxHeight ? "auto" : "hidden";
        }
      }
    });
  }, [draftLines, completedLines]);

  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  const sourceLineCount = poemLines.length;

  // Find max line index across completedLines (includes extra lines beyond source)
  const maxCompletedIndex = React.useMemo(() => {
    const indices = Object.keys(completedLines).map(Number).filter(n => !isNaN(n));
    return indices.length > 0 ? Math.max(...indices) : -1;
  }, [completedLines]);

  // Total lines = max of source lines and completed lines
  const totalLines = Math.max(sourceLineCount, maxCompletedIndex + 1);

  // Check if all lines are completed (source lines + any extra lines)
  const allLinesCompleted = React.useMemo(() => {
    if (sourceLineCount === 0) return false;
    // Check all source lines are completed
    const sourceComplete = poemLines.every((_, idx) => {
      const completed = completedLines[idx];
      return completed && completed.trim().length > 0;
    });
    return sourceComplete;
  }, [poemLines, sourceLineCount, completedLines]);

  // Assemble poem preview - include extra lines beyond source
  const poemPreview = React.useMemo(() => {
    const lines: string[] = [];
    // Include all lines from 0 to max(sourceLineCount, maxCompletedIndex)
    const maxIdx = Math.max(sourceLineCount - 1, maxCompletedIndex);
    for (let idx = 0; idx <= maxIdx; idx++) {
      const completed = completedLines[idx];
      lines.push(completed && completed.trim().length > 0 ? completed.trim() : "");
    }
    return lines.join("\n");
  }, [sourceLineCount, maxCompletedIndex, completedLines]);

  // Auto-save lines when they change (debounced)
  React.useEffect(() => {
    // Clean up all timeouts on unmount
    const timeouts = autoSaveTimeoutRef.current;
    return () => {
      Object.values(timeouts).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Auto-save function for a specific line
  const autoSaveLine = React.useCallback(
    async (lineIndex: number) => {
      if (!threadId) return;

      const translatedLine = (getDisplayText(lineIndex) ?? "").trim();
      if (!translatedLine) return;

      try {
        await saveManualLine.mutateAsync({
          threadId,
          lineIndex,
          originalLine: poemLines[lineIndex] ?? "",
          translatedLine,
        });
        setCompletedLine(lineIndex, translatedLine);
      } catch (e) {
        console.error("[Notebook] Auto-save failed for line:", lineIndex, e);
        // Don't show error for auto-save - it's silent
      }
    },
    [threadId, getDisplayText, poemLines, saveManualLine, setCompletedLine]
  );

  // Show completion dialog when all lines are completed (only once)
  React.useEffect(() => {
    if (
      allLinesCompleted &&
      !hasShownCompletionDialog &&
      !showCompletionDialog
    ) {
      const timer = setTimeout(() => {
        setShowCompletionDialog(true);
        setHasShownCompletionDialog(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allLinesCompleted, hasShownCompletionDialog, showCompletionDialog]);

  // Auto-open editing section when all lines are completed
  React.useEffect(() => {
    if (allLinesCompleted && onOpenEditing && !hasOpenedEditing) {
      const timer = setTimeout(() => {
        onOpenEditing();
        setHasOpenedEditing(true);
      }, 1000); // Wait 1 second after completion
      return () => clearTimeout(timer);
    }
  }, [allLinesCompleted, onOpenEditing, hasOpenedEditing]);

  // Keyboard shortcut: ⌘/Ctrl + N to toggle notes panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "n" && !e.shiftKey) {
        // Only trigger if not typing in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          toggleNotesPanel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleNotesPanel]);

  const activeIdx = currentLineIndex ?? 0;
  const isSaving = saveManualLine.isPending;

  const handleSave = React.useCallback(
    async (lineIndex: number) => {
      if (!threadId) return;

      // Clear any pending auto-save for this line
      if (autoSaveTimeoutRef.current[lineIndex]) {
        clearTimeout(autoSaveTimeoutRef.current[lineIndex]);
        delete autoSaveTimeoutRef.current[lineIndex];
      }

      setSaveError(null);
      const translatedLine = (getDisplayText(lineIndex) ?? "").trim();
      if (!translatedLine) return;

      try {
        await saveManualLine.mutateAsync({
          threadId,
          lineIndex,
          originalLine: poemLines[lineIndex] ?? "",
          translatedLine,
        });

        setCompletedLine(lineIndex, translatedLine);
      } catch (e) {
        console.error("[Notebook] Failed to save line:", e);
        setSaveError("Couldn't save right now. Your draft is still here.");
      }
    },
    [threadId, getDisplayText, poemLines, saveManualLine, setCompletedLine]
  );

  // Save all lines with content (both draft and completed)
  const handleSaveAll = React.useCallback(async () => {
    if (!threadId) return;

    setIsSavingAll(true);
    setSaveError(null);

    // Collect all lines that have content
    const linesToSave: Array<{ lineIndex: number; text: string }> = [];

    for (let idx = 0; idx < poemLines.length; idx++) {
      const currentText = getDisplayText(idx);
      const trimmedText = currentText.trim();

      if (trimmedText.length > 0) {
        linesToSave.push({
          lineIndex: idx,
          text: trimmedText,
        });
      }
    }

    if (linesToSave.length === 0) {
      setIsSavingAll(false);
      return;
    }

    try {
      // Save all lines to the database sequentially
      // Using the non-invalidating mutation to prevent race conditions
      const saveResults: Array<{ lineIndex: number; success: boolean }> = [];

      for (const { lineIndex, text } of linesToSave) {
        try {
          await saveManualLineBatch.mutateAsync({
            threadId,
            lineIndex,
            originalLine: poemLines[lineIndex] ?? "",
            translatedLine: text,
          });
          saveResults.push({ lineIndex, success: true });
        } catch (lineError) {
          console.error(
            `[Notebook] Failed to save line ${lineIndex}:`,
            lineError
          );
          saveResults.push({ lineIndex, success: false });
        }
      }

      // Count results
      const successCount = saveResults.filter((r) => r.success).length;
      const failCount = saveResults.filter((r) => !r.success).length;

      console.log(
        `[Notebook] Save All completed: ${successCount} succeeded, ${failCount} failed`
      );

      // NOW invalidate and refetch once
      // This will trigger WorkshopRail effect to update Zustand store
      await queryClient.invalidateQueries({
        queryKey: ["workshop-state", threadId],
      });

      // Wait a bit for the effect to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Report errors if any
      if (failCount > 0) {
        setSaveError(
          `Saved ${successCount} of ${linesToSave.length} lines. ${failCount} failed. Please try again.`
        );
      }
    } catch (e) {
      console.error("[Notebook] Failed to save lines:", e);
      setSaveError("Couldn't save lines. Please try again.");
    } finally {
      setIsSavingAll(false);
    }
  }, [
    threadId,
    poemLines,
    getDisplayText,
    saveManualLineBatch,
    queryClient,
  ]);

  if (poemLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <FileText className="w-12 h-12 mx-auto text-foreground-disabled mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">
            No poem loaded
          </h3>
          <p className="text-sm text-foreground-secondary">
            Complete the Guide Rail to load a poem and start translating.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Minimal header */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {showTitle ? (
            <div className="text-sm font-semibold text-foreground">Notebook</div>
          ) : null}
          <Badge variant="secondary" className="text-[11px]">
            Line {activeIdx + 1} of {totalLines}
          </Badge>
          {Object.keys(draftLines).length > 0 && (
            <Badge
              variant="secondary"
              className="text-[11px] text-warning bg-warning-light"
            >
              {Object.keys(draftLines).length} unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(draftLines).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleSaveAll}
              disabled={isSaving || isSavingAll}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSavingAll ? "Saving..." : "Save All"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowFullEditor(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Full comparison
          </Button>
        </div>
      </div>

      {/* Column Headers - Sticky */}
      <div className="grid grid-cols-2 border-b bg-white sticky top-0 z-10">
        <div className="px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide border-r">
          Source
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide">
          Translation
        </div>
      </div>

      {/* Main body: row-based layout for perfect alignment */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {/* Render all lines including extras beyond source poem */}
        {Array.from({ length: totalLines }, (_, idx) => {
          const isActive = idx === currentLineIndex;
          const draft = draftLines[idx];
          const completed = completedLines[idx];
          const text = draft ?? completed ?? "";
          const status =
            completed && !draft ? "completed" : draft ? "draft" : "empty";
          const hasContent = text.trim().length > 0;
          const isHovered = hoveredLineIndex === idx;
          const isExtraLine = idx >= sourceLineCount;
          const sourceLine = poemLines[idx] ?? "";

          return (
            <div
              key={`row-${idx}`}
              className={[
                "grid grid-cols-2 border-b border-border-subtle transition-colors",
                isActive ? "bg-accent-light/20" : "hover:bg-muted/50/50",
                isExtraLine ? "bg-purple-50/30" : "",
              ].join(" ")}
              onMouseEnter={() => setHoveredLineIndex(idx)}
              onMouseLeave={() => setHoveredLineIndex(null)}
            >
              {/* Source Cell */}
              <button
                type="button"
                onClick={() => setCurrentLineIndex(idx)}
                className={[
                  "w-full text-left px-3 py-3 text-base leading-relaxed border-r border-border-subtle",
                  "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                  "flex items-start gap-2",
                  isActive ? "bg-accent-light/30 text-foreground" : "text-foreground-secondary",
                  isExtraLine ? "bg-purple-50/50" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center font-mono text-xs",
                    isActive ? "text-accent" : isExtraLine ? "text-purple-400" : "text-foreground-disabled",
                  ].join(" ")}
                >
                  {idx + 1}
                </span>
                <span className={["flex-1 min-w-0", isExtraLine ? "italic text-purple-400" : ""].join(" ")}>
                  {isExtraLine ? "(extra line)" : sourceLine}
                </span>
              </button>

              {/* Translation Cell */}
              <div
                className={[
                  "group relative px-3 py-3",
                  "flex items-start gap-2",
                  isActive ? "bg-warning-light/30" : "",
                ].join(" ")}
                onClick={() => setCurrentLineIndex(idx)}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px]",
                    status === "completed"
                      ? "bg-success-light text-success"
                      : status === "draft"
                      ? "bg-warning-light text-warning"
                      : "bg-muted text-foreground-muted",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {status === "completed"
                    ? "✓"
                    : status === "draft"
                    ? "…"
                    : "–"}
                </span>
                <div className="flex-1 min-w-0">
                  <NotebookDropZone
                    canDrop={true}
                    isActive={isDragActive && isActive}
                    className="min-h-0 p-0 border-0 bg-transparent"
                    dropzoneId={`notebook-dropzone-line-${idx}`}
                  >
                    <Textarea
                      ref={(el) => {
                        textareaRefs.current[idx] = el;
                      }}
                      value={text}
                      onChange={(e) => {
                        // Strip any newlines that may be pasted in
                        const newValue = e.target.value.replace(/[\r\n]+/g, " ");
                        setDraft(idx, newValue);
                        setCurrentLineIndex(idx);
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        const scrollHeight = target.scrollHeight;
                        const lineHeight =
                          parseFloat(getComputedStyle(target).lineHeight) || 24;
                        const maxHeight = lineHeight * 4;
                        const newHeight = Math.max(
                          24,
                          Math.min(scrollHeight, maxHeight)
                        );
                        target.style.height = `${newHeight}px`;
                        target.style.overflowY =
                          scrollHeight > maxHeight ? "auto" : "hidden";

                        // Auto-save after 2 seconds of no typing
                        if (autoSaveTimeoutRef.current[idx]) {
                          clearTimeout(autoSaveTimeoutRef.current[idx]);
                        }
                        autoSaveTimeoutRef.current[idx] = setTimeout(() => {
                          if (newValue.trim().length > 0) {
                            void autoSaveLine(idx);
                          }
                        }, 2000);
                      }}
                      onFocus={() => {
                        setCurrentLineIndex(idx);
                        const textarea = textareaRefs.current[idx];
                        if (textarea) {
                          textarea.style.height = "auto";
                          const scrollHeight = textarea.scrollHeight;
                          const lineHeight =
                            parseFloat(getComputedStyle(textarea).lineHeight) ||
                            24;
                          const maxHeight = lineHeight * 4;
                          const newHeight = Math.max(
                            24,
                            Math.min(scrollHeight, maxHeight)
                          );
                          textarea.style.height = `${newHeight}px`;
                          textarea.style.overflowY =
                            scrollHeight > maxHeight ? "auto" : "hidden";
                        }
                      }}
                      onKeyDown={(e) => {
                        const isMac = navigator.platform
                          .toUpperCase()
                          .includes("MAC");
                        const modifier = isMac ? e.metaKey : e.ctrlKey;
                        if (modifier && e.key === "Enter") {
                          e.preventDefault();
                          void handleSave(idx);
                        } else if (e.key === "Enter" && !e.shiftKey) {
                          // Prevent plain Enter from inserting newlines (causes index drift)
                          e.preventDefault();
                          // Move focus to next line if available
                          const nextTextarea = textareaRefs.current[idx + 1];
                          if (nextTextarea) {
                            nextTextarea.focus();
                          }
                        }
                      }}
                      placeholder="(waiting for your translation)"
                      className={[
                        "w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed",
                        "focus:ring-0 focus:outline-none",
                        status === "empty"
                          ? "text-foreground-disabled italic placeholder:text-foreground-disabled"
                          : "text-foreground",
                      ].join(" ")}
                      rows={1}
                      style={{
                        minHeight: "1.5rem",
                        maxHeight: "6rem",
                        height: "auto",
                        overflowY: "hidden",
                      }}
                    />
                  </NotebookDropZone>
                </div>
                {hasContent && (isHovered || isActive) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearDraft(idx);
                    }}
                    className={[
                      "mt-0.5 flex-shrink-0 rounded p-1 text-foreground-muted",
                      "hover:bg-muted hover:text-foreground-secondary",
                      "transition-colors",
                    ].join(" ")}
                    aria-label="Clear line"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Line button */}
        <div className="border-b border-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={() => {
              // Add a new line by setting a draft at the next index
              const nextIndex = totalLines;
              setDraft(nextIndex, "");
              setCurrentLineIndex(nextIndex);
              // Focus the new textarea after render
              setTimeout(() => {
                const textarea = textareaRefs.current[nextIndex];
                if (textarea) {
                  textarea.focus();
                }
              }, 100);
            }}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
          >
            <span className="text-lg">+</span>
            <span>Add extra line</span>
          </button>
        </div>
      </div>

      {/* Save error display */}
      {saveError && (
        <div className="border-t bg-white px-4 py-2">
          <div className="rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-sm text-warning flex items-start gap-2">
            <span>{saveError}</span>
          </div>
        </div>
      )}

      {/* Notes Panel */}
      <NotebookNotesPanel />

      {/* Full Translation Editor */}
      <FullTranslationEditor
        open={showFullEditor}
        onOpenChange={setShowFullEditor}
      />

      {/* Completion Confirmation Dialog */}
      <CompletionConfirmationDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        onConfirm={() => {
          setShowCongratulations(true);
        }}
        poemPreview={poemPreview}
        totalLines={totalLines}
      />

      {/* Congratulations Modal */}
      <CongratulationsModal
        open={showCongratulations}
        onClose={() => setShowCongratulations(false)}
        totalLines={totalLines}
      />
    </div>
  );
}
