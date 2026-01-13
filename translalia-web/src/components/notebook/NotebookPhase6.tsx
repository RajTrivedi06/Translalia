"use client";

import * as React from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { FileText, X } from "lucide-react";

import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useSaveManualLine } from "@/lib/hooks/useWorkshopFlow";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { NotebookDropZone } from "./NotebookDropZone";
import { FullTranslationEditor } from "./FullTranslationEditor";
import { CompletionConfirmationDialog } from "./CompletionConfirmationDialog";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";

interface NotebookPhase6Props {
  projectId?: string;
  showTitle?: boolean;
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

  const [showFullEditor, setShowFullEditor] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = React.useState<number | null>(
    null
  );
  const [showCompletionDialog, setShowCompletionDialog] = React.useState(false);
  const [showCongratulations, setShowCongratulations] = React.useState(false);
  const [hasShownCompletionDialog, setHasShownCompletionDialog] =
    React.useState(false);
  const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>(
    {}
  );

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

  const totalLines = poemLines.length;

  // Check if all lines are completed
  const allLinesCompleted = React.useMemo(() => {
    if (poemLines.length === 0) return false;
    return poemLines.every((_, idx) => {
      const completed = completedLines[idx];
      return completed && completed.trim().length > 0;
    });
  }, [poemLines, completedLines]);

  // Assemble poem preview
  const poemPreview = React.useMemo(() => {
    return poemLines
      .map((_, idx) => {
        const completed = completedLines[idx];
        return completed && completed.trim().length > 0 ? completed.trim() : "";
      })
      .join("\n");
  }, [poemLines, completedLines]);

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

  const activeIdx = currentLineIndex ?? 0;
  const isSaving = saveManualLine.isPending;

  const handleSave = React.useCallback(
    async (lineIndex: number) => {
      if (!threadId) return;

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

  if (poemLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-base font-medium text-gray-800 mb-1">
            No poem loaded
          </h3>
          <p className="text-sm text-gray-600">
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
            <div className="text-sm font-semibold text-slate-900">Notebook</div>
          ) : null}
          <Badge variant="secondary" className="text-[11px]">
            Line {activeIdx + 1} of {totalLines}
          </Badge>
        </div>
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

      {/* Column Headers - Sticky */}
      <div className="grid grid-cols-2 border-b bg-white sticky top-0 z-10">
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r">
          Source
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Translation
        </div>
      </div>

      {/* Main body: row-based layout for perfect alignment */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {poemLines.map((line, idx) => {
          const isActive = idx === currentLineIndex;
          const draft = draftLines[idx];
          const completed = completedLines[idx];
          const text = draft ?? completed ?? "";
          const status =
            completed && !draft ? "completed" : draft ? "draft" : "empty";
          const hasContent = text.trim().length > 0;
          const isHovered = hoveredLineIndex === idx;

          return (
            <div
              key={`row-${idx}`}
              className={[
                "grid grid-cols-2 border-b border-slate-100 transition-colors",
                isActive ? "bg-blue-50/50" : "hover:bg-slate-50/50",
              ].join(" ")}
              onMouseEnter={() => setHoveredLineIndex(idx)}
              onMouseLeave={() => setHoveredLineIndex(null)}
            >
              {/* Source Cell */}
              <button
                type="button"
                onClick={() => setCurrentLineIndex(idx)}
                className={[
                  "w-full text-left px-3 py-3 text-base leading-relaxed border-r border-slate-100",
                  "hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200",
                  "flex items-start gap-2",
                  isActive ? "bg-blue-50 text-slate-900" : "text-slate-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center font-mono text-xs",
                    isActive ? "text-blue-600" : "text-slate-300",
                  ].join(" ")}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0">{line}</span>
              </button>

              {/* Translation Cell */}
              <div
                className={[
                  "group relative px-3 py-3",
                  "flex items-start gap-2",
                  isActive ? "bg-amber-50/50" : "",
                ].join(" ")}
                onClick={() => setCurrentLineIndex(idx)}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px]",
                    status === "completed"
                      ? "bg-green-100 text-green-700"
                      : status === "draft"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-400",
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
                        setDraft(idx, e.target.value);
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
                        }
                      }}
                      placeholder="(waiting for your translation)"
                      className={[
                        "w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed",
                        "focus:ring-0 focus:outline-none",
                        status === "empty"
                          ? "text-slate-300 italic placeholder:text-slate-300"
                          : "text-slate-800",
                      ].join(" ")}
                      rows={1}
                      style={{
                        minHeight: "1.5rem",
                        maxHeight: "6rem",
                        height: "auto",
                        overflowY: "hidden",
                        fieldSizing: "content",
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
                      "mt-0.5 flex-shrink-0 rounded p-1 text-slate-400",
                      "hover:bg-slate-200 hover:text-slate-600",
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
      </div>

      {/* Save error display */}
      {saveError && (
        <div className="border-t bg-white px-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
            <span>{saveError}</span>
          </div>
        </div>
      )}

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
