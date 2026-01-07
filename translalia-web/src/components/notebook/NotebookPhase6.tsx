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
 * NotebookPhase6 (Phase 2) — “Real notebook” surface
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
        // Reset to a small fixed height first to get accurate scrollHeight
        const currentValue = textarea.value;
        if (!currentValue || currentValue.trim().length === 0) {
          // Empty textarea - set to minimum height
          textarea.style.height = "1.5rem";
          textarea.style.overflowY = "hidden";
        } else {
          // Has content - calculate proper height
          textarea.style.height = "1.5rem"; // Reset to min first
          const scrollHeight = textarea.scrollHeight;
          const lineHeight =
            parseFloat(getComputedStyle(textarea).lineHeight) || 24;
          const maxHeight = lineHeight * 4; // Max 4 lines (~6rem = 96px)
          // Ensure height is between min (24px) and max (96px)
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

  // NOTE: Removed auto-select-line-0 effect.
  // Previously this would set currentLineIndex to 0 when null, but that
  // conflicts with WorkshopRail's segment→line navigation flow (user should
  // explicitly choose a line from the line list after selecting a segment).

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
      // Small delay to ensure UI is updated
      const timer = setTimeout(() => {
        setShowCompletionDialog(true);
        setHasShownCompletionDialog(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allLinesCompleted, hasShownCompletionDialog, showCompletionDialog]);
  const activeIdx = currentLineIndex ?? 0;
  const activeSource = poemLines[activeIdx] ?? "";
  const activeValue = getDisplayText(activeIdx);
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

        // Only mark completed after API success.
        // (On failure, draft remains in draftLines.)
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
      {/* Minimal header (avoid redundancy) */}
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

      {/* Main body: side-by-side */}
      <div className="flex-1 min-h-0 grid grid-cols-2">
        {/* Left: source poem */}
        <div className="min-h-0 overflow-y-auto border-r bg-white">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Source
          </div>
          <div className="px-2 pb-3">
            {poemLines.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              return (
                <button
                  key={`src-${idx}`}
                  type="button"
                  onClick={() => setCurrentLineIndex(idx)}
                  className={[
                    "w-full text-left rounded-lg px-3 py-2 text-base leading-relaxed",
                    "hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                    isActive ? "bg-blue-50 text-slate-900" : "text-slate-700",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mr-2 inline-block w-6 text-right font-mono text-xs",
                      isActive ? "text-blue-600" : "text-slate-300",
                    ].join(" ")}
                  >
                    {idx + 1}
                  </span>
                  {line}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: translation poem - directly editable */}
        <div className="min-h-0 overflow-y-auto bg-white">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Translation
          </div>
          <div className="px-2 pb-3">
            {poemLines.map((_, idx) => {
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
                  key={`tr-${idx}`}
                  className={[
                    "group relative rounded-lg px-3 py-2",
                    "hover:bg-slate-50 transition-colors",
                    isActive ? "bg-amber-50" : "",
                  ].join(" ")}
                  onMouseEnter={() => setHoveredLineIndex(idx)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                  onClick={() => setCurrentLineIndex(idx)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        "mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px]",
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
                            // Auto-resize with max height constraint
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "1.5rem"; // Reset to min first
                            const scrollHeight = target.scrollHeight;
                            const lineHeight =
                              parseFloat(getComputedStyle(target).lineHeight) ||
                              24;
                            const maxHeight = lineHeight * 4; // Max 4 lines
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
                            // Auto-resize on focus with max height constraint
                            const textarea = textareaRefs.current[idx];
                            if (textarea) {
                              textarea.style.height = "1.5rem"; // Reset to min first
                              const scrollHeight = textarea.scrollHeight;
                              const lineHeight =
                                parseFloat(
                                  getComputedStyle(textarea).lineHeight
                                ) || 24;
                              const maxHeight = lineHeight * 4; // Max 4 lines
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
                            // Save on Cmd/Ctrl + Enter
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
                            maxHeight: "6rem", // ~4 lines max
                            height: "1.5rem", // Start with min height, will be adjusted by auto-resize
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
                          "flex-shrink-0 rounded p-1 text-slate-400",
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
        </div>
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
