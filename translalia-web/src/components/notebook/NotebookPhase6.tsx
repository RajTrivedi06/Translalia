"use client";

import * as React from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, Pencil } from "lucide-react";
import { HelpHint } from "@/components/ui/help-hint";
import { useTranslations } from "next-intl";

import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useSaveManualLine, useSaveManualLineWithoutInvalidation } from "@/lib/hooks/useWorkshopFlow";
import { useQueryClient } from "@tanstack/react-query";

import { Textarea } from "@/components/ui/textarea";

import { NotebookDropZone } from "./NotebookDropZone";
import { FullTranslationEditor } from "./FullTranslationEditor";
import { CompletionConfirmationDialog } from "./CompletionConfirmationDialog";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";
import { NotebookStatusIndicator } from "./NotebookStatusIndicator";
import { NotebookHeader } from "./NotebookHeader";
import { NoteMarker } from "./NoteMarker";
import { LineNotePopover } from "./LineNotePopover";
import { NotesSheet } from "./NotesSheet";
import { useNotebookStore } from "@/store/notebookSlice";
import { useIsCoarsePointer } from "@/hooks/useIsCoarsePointer";
import { useNotebookNotesHydration } from "@/lib/hooks/useNotebookNotesHydration";

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
  const t = useTranslations("Notebook");
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
  const toggleNotesSheet = useNotebookStore((s) => s.toggleNotesSheet);
  const lineNotes = useNotebookStore((s) => s.lineNotes);
  const noteEditingLineIndex = useNotebookStore((s) => s.noteEditingLineIndex);
  const openNotePopover = useNotebookStore((s) => s.openNotePopover);
  const closeNotePopover = useNotebookStore((s) => s.closeNotePopover);
  const notesSheetOpen = useNotebookStore((s) => s.notesSheetOpen);
  const setNotesSheetOpen = useNotebookStore((s) => s.setNotesSheetOpen);

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
  const markerRefs = React.useRef<Record<number, HTMLButtonElement | null>>({});
  const rowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const popoverAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const notesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const notebookRootRef = React.useRef<HTMLDivElement | null>(null);
  const autoSaveTimeoutRef = React.useRef<Record<number, NodeJS.Timeout>>({});
  const isCoarsePointer = useIsCoarsePointer();
  useNotebookNotesHydration();
  const [jumpHighlightIndex, setJumpHighlightIndex] = React.useState<
    number | null
  >(null);

  // Auto-resize textareas when text changes - only expand when content overflows
  const resizeTextareaIfOverflow = React.useCallback(
    (textarea: HTMLTextAreaElement) => {
      const currentClientHeight = textarea.clientHeight;
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      if (scrollHeight <= currentClientHeight) {
        textarea.style.height = "1.5rem";
        textarea.style.overflowY = "hidden";
      } else {
        const lineHeight =
          parseFloat(getComputedStyle(textarea).lineHeight) || 24;
        const maxHeight = lineHeight * 4;
        const newHeight = Math.min(scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY =
          scrollHeight > maxHeight ? "auto" : "hidden";
      }
    },
    []
  );

  React.useEffect(() => {
    Object.values(textareaRefs.current).forEach((textarea) => {
      if (textarea) {
        const currentValue = textarea.value;
        if (!currentValue || currentValue.trim().length === 0) {
          textarea.style.height = "1.5rem";
          textarea.style.overflowY = "hidden";
        } else {
          resizeTextareaIfOverflow(textarea);
        }
      }
    });
  }, [draftLines, completedLines, resizeTextareaIfOverflow]);

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

  // Keyboard shortcut: ⌘/Ctrl + N toggles the notes sheet
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "n" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          toggleNotesSheet();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleNotesSheet]);

  const openNotePopoverWithAnchor = React.useCallback(
    (lineIndex: number) => {
      popoverAnchorRef.current = markerRefs.current[lineIndex] ?? null;
      openNotePopover(lineIndex);
    },
    [openNotePopover]
  );

  // Keyboard shortcut: ⌘/Ctrl + . opens note popover for the focused line
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier || e.key !== "." || e.shiftKey) return;

      const active = document.activeElement as HTMLElement | null;
      if (!notebookRootRef.current?.contains(active)) return;

      const row = active?.closest("[data-notebook-line]");
      let lineIndex: number | null = null;
      if (row) {
        const idx = Number(row.getAttribute("data-notebook-line"));
        if (!Number.isNaN(idx)) lineIndex = idx;
      } else if (currentLineIndex !== null) {
        lineIndex = currentLineIndex;
      }
      if (lineIndex === null) return;

      e.preventDefault();
      openNotePopoverWithAnchor(lineIndex);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLineIndex, openNotePopoverWithAnchor]);

  React.useLayoutEffect(() => {
    if (noteEditingLineIndex !== null) {
      popoverAnchorRef.current =
        markerRefs.current[noteEditingLineIndex] ?? null;
    } else {
      popoverAnchorRef.current = null;
    }
  }, [noteEditingLineIndex]);

  const handleRowContextMenu = React.useCallback(
    (lineIndex: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest(
          "textarea, input, select, [contenteditable='true'], [contenteditable='']"
        )
      ) {
        return;
      }
      e.preventDefault();
      openNotePopoverWithAnchor(lineIndex);
    },
    [openNotePopoverWithAnchor]
  );

  const lineNotesCount = React.useMemo(
    () => Object.keys(lineNotes).length,
    [lineNotes]
  );

  const handleNotesSheetOpenChange = React.useCallback(
    (open: boolean) => {
      setNotesSheetOpen(open);
      if (!open) {
        requestAnimationFrame(() => {
          notesButtonRef.current?.focus();
        });
      }
    },
    [setNotesSheetOpen]
  );

  const handleJumpToLine = React.useCallback(
    (lineIndex: number) => {
      setNotesSheetOpen(false);
      setCurrentLineIndex(lineIndex);
      setJumpHighlightIndex(lineIndex);
      window.setTimeout(() => setJumpHighlightIndex(null), 1500);
      requestAnimationFrame(() => {
        rowRefs.current[lineIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [setCurrentLineIndex, setNotesSheetOpen]
  );

  const handleEditLineNote = React.useCallback(
    (lineIndex: number) => {
      setNotesSheetOpen(false);
      requestAnimationFrame(() => {
        rowRefs.current[lineIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        window.setTimeout(() => {
          openNotePopoverWithAnchor(lineIndex);
        }, 150);
      });
    },
    [openNotePopoverWithAnchor, setNotesSheetOpen]
  );

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

      // Update Workshop store immediately so progress bar updates
      // (WorkshopRail may be collapsed/unmounted when Editing is open, so its
      // sync effect won't run—we must update the store ourselves)
      for (let i = 0; i < linesToSave.length; i++) {
        if (saveResults[i].success) {
          const { lineIndex, text } = linesToSave[i];
          setCompletedLine(lineIndex, text);
          clearDraft(lineIndex);
        }
      }

      // Invalidate for consistency when Workshop is opened
      await queryClient.invalidateQueries({
        queryKey: ["workshop-state", threadId],
      });

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

  // Calculate progress for the header
  const completedCount = React.useMemo(() => {
    return Object.values(completedLines).filter(
      (line) => line && line.trim().length > 0
    ).length;
  }, [completedLines]);

  if (poemLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6 notebook-paper">
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
    <div ref={notebookRootRef} className="h-full flex flex-col overflow-hidden">
      {/* Notebook Header with segmented progress bar */}
      <NotebookHeader
        showTitle={showTitle}
        completedCount={completedCount}
        draftCount={Object.keys(draftLines).length}
        totalLines={sourceLineCount}
        isSaving={isSaving || isSavingAll}
        onSaveAll={handleSaveAll}
        onOpenFullEditor={() => setShowFullEditor(true)}
        onOpenNotes={() => setNotesSheetOpen(true)}
        lineNotesCount={lineNotesCount}
        notesButtonLabel={t("notesTitle", { defaultValue: "Notes" })}
        notesButtonRef={notesButtonRef}
        notesHelp={
          <HelpHint
            align="end"
            label={t("notesButtonHelpLabel", {
              defaultValue: "What the Notes button does",
            })}
            title={t("notesTitle", { defaultValue: "Notes" })}
            items={[
              t("notesButtonHelp", {
                defaultValue:
                  "Notes opens every comment you've added to your lines in one place. Lines with a note show a small marker — select it to view or edit that note.",
              }),
            ]}
          />
        }
      />

      {/* Column headers + notes instruction (muted; keeps action header uncluttered) */}
      <div className="sticky top-0 z-10 bg-surface">
        <div className="grid grid-cols-2 border-b border-border-subtle">
          <div className="notebook-column-header border-r border-border-subtle pl-14">
            Source
          </div>
          <div className="notebook-column-header pl-8">Translation</div>
        </div>
        <div className="flex items-center gap-1.5 border-b border-border-subtle px-5 py-1.5">
          <p className="text-xs text-foreground-muted leading-snug">
            {t("notesInstruction", {
              defaultValue: "Right-click a line to add a note.",
            })}
          </p>
          <HelpHint
            align="start"
            label={t("notesHelpLabel", { defaultValue: "How notes work" })}
            title={t("notesTitle", { defaultValue: "Notes" })}
            items={[
              t("notesInstructionLong", {
                defaultValue:
                  "You can right-click any line to add a note. Lines with notes show a small marker. Use the Notes button (or press ⌘N / Ctrl+N) to see all notes together. Press ⌘. (Ctrl+. on Windows) while editing a line to open its note.",
              }),
            ]}
          />
        </div>
      </div>

      {/* Main body: notebook paper */}
      <div className="flex-1 min-h-0 overflow-y-auto notebook-paper">
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
          const lineNote = lineNotes[idx] ?? null;
          const hasLineNote =
            lineNote !== null && lineNote.trim().length > 0;

          const isJumpHighlighted = jumpHighlightIndex === idx;

          return (
            <motion.div
              key={`row-${idx}`}
              data-notebook-line={idx}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              initial={false}
              animate={{
                backgroundColor: isActive
                  ? "rgb(239 246 255 / 0.5)"
                  : isJumpHighlighted
                  ? "rgb(254 249 195 / 0.7)"
                  : isHovered
                  ? "rgb(250 248 244)"
                  : "transparent",
              }}
              transition={{ duration: 0.15 }}
              className={[
                "notebook-row group grid grid-cols-2 border-b border-border-subtle relative",
                isActive ? "notebook-row-selected" : "",
                isExtraLine ? "bg-purple-50/20" : "",
                isJumpHighlighted ? "ring-2 ring-inset ring-amber-300/80" : "",
              ].join(" ")}
              onMouseEnter={() => setHoveredLineIndex(idx)}
              onMouseLeave={() => setHoveredLineIndex(null)}
              onContextMenu={(e) => handleRowContextMenu(idx, e)}
            >
              <NoteMarker
                ref={(el) => {
                  markerRefs.current[idx] = el;
                }}
                lineIndex={idx}
                hasNote={hasLineNote}
                isCoarsePointer={isCoarsePointer}
                onOpen={openNotePopoverWithAnchor}
              />

              {/* Source Cell */}
              <button
                type="button"
                onClick={() => setCurrentLineIndex(idx)}
                className={[
                  "w-full text-left pl-3 pr-7 py-3 border-r border-border-subtle",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                  "flex items-start gap-1",
                  isExtraLine ? "bg-purple-50/30" : "",
                ].join(" ")}
              >
                {/* Line number in margin style */}
                <span className={[
                  "notebook-line-number mt-0.5",
                  isActive ? "!opacity-100 font-medium" : "",
                  isExtraLine ? "!text-purple-400" : "",
                ].join(" ")}>
                  {idx + 1}
                </span>
                <span
                  id={`source-line-${idx}`}
                  className={[
                    "flex-1 min-w-0 notebook-source-text text-[15px]",
                    isExtraLine ? "italic text-purple-400" : "",
                    isActive ? "text-stone-800" : "text-stone-600",
                  ].join(" ")}
                >
                  {isExtraLine ? "(extra line)" : sourceLine}
                </span>
              </button>

              {/* Translation Cell */}
              <div
                className={[
                  "group relative pl-7 pr-3 py-3",
                  "flex items-start gap-2",
                ].join(" ")}
                onClick={() => setCurrentLineIndex(idx)}
              >
                {/* Status indicator - icon-based */}
                <NotebookStatusIndicator
                  status={status === "empty" ? "pending" : status}
                  size="md"
                  className="mt-1.5 ml-0.5"
                />
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
                        resizeTextareaIfOverflow(target);

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
                          resizeTextareaIfOverflow(textarea);
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
                      placeholder="..."
                      aria-labelledby={`source-line-${idx}`}
                      className={[
                        "w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed",
                        "focus:ring-0 focus:outline-none notebook-translation-input",
                        status === "empty"
                          ? "notebook-empty-cell"
                          : "notebook-translation-text",
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
                {/* Show pencil icon when empty and hovered, clear button when has content */}
                <AnimatePresence mode="wait">
                  {!hasContent && isHovered && (
                    <motion.div
                      key="pencil"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Pencil className="w-4 h-4 text-foreground-disabled mt-0.5 flex-shrink-0" />
                    </motion.div>
                  )}
                  {hasContent && (isHovered || isActive) && (
                    <motion.button
                      key="clear"
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
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
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}


      </div>

      {/* Add Line button - sticky at bottom for discoverability */}
      <div className="border-t border-border-subtle bg-surface px-4 py-2 flex justify-center">
        <button
          type="button"
          onClick={() => {
            const nextIndex = totalLines;
            setDraft(nextIndex, "");
            setCurrentLineIndex(nextIndex);
            setTimeout(() => {
              const textarea = textareaRefs.current[nextIndex];
              if (textarea) {
                textarea.focus();
                textarea.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 100);
          }}
          className="flex items-center gap-2 px-4 py-2
            bg-surface border border-border-subtle rounded-full
            text-sm text-foreground-secondary
            hover:border-accent hover:text-accent hover:bg-accent/5
            active:scale-[0.98]
            transition-all duration-200 ease-out
            shadow-sm hover:shadow"
        >
          <span className="text-lg font-light leading-none">+</span>
          <span>Add line</span>
        </button>
      </div>

      {/* Save error display */}
      {saveError && (
        <div className="border-t bg-white px-4 py-2">
          <div className="rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-sm text-warning flex items-start gap-2">
            <span>{saveError}</span>
          </div>
        </div>
      )}

      {/* Line note popover */}
      {noteEditingLineIndex !== null && (
        <LineNotePopover
          open
          lineIndex={noteEditingLineIndex}
          sourceLineText={
            noteEditingLineIndex >= sourceLineCount
              ? ""
              : (poemLines[noteEditingLineIndex] ?? "")
          }
          noteText={lineNotes[noteEditingLineIndex] ?? null}
          anchorRef={popoverAnchorRef}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeNotePopover();
          }}
        />
      )}

      <NotesSheet
        open={notesSheetOpen}
        onOpenChange={handleNotesSheetOpenChange}
        poemLines={poemLines}
        sourceLineCount={sourceLineCount}
        onJumpToLine={handleJumpToLine}
        onEditLineNote={handleEditLineNote}
      />

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
