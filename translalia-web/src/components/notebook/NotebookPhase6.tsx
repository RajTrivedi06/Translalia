"use client";

import * as React from "react";
import { useNotebookStore } from "@/store/notebookSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useWorkspace } from "@/store/workspace";
import { useGuideStore } from "@/store/guideSlice";
import { useThreadId } from "@/hooks/useThreadId";
import type { DragData } from "@/types/drag";
import {
  useKeyboardShortcuts,
  KeyboardShortcutsHint,
} from "@/lib/hooks/useKeyboardShortcuts";
import { useAutoSave, useAutoSaveIndicator } from "@/lib/hooks/useAutoSave";
import { useSaveManualLine } from "@/lib/hooks/useWorkshopFlow";
import { useDndMonitor } from "@dnd-kit/core";
import { FinalizeLineDialog } from "./FinalizeLineDialog";
import { PoemAssembly } from "./PoemAssembly";
import { ComparisonView } from "./ComparisonView";
import { JourneySummary } from "./JourneySummary";
import { JourneyReflection } from "./JourneyReflection";
import { CompletionCelebration } from "./CompletionCelebration";
import { NotebookDropZone } from "./NotebookDropZone";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { PoemSuggestionsPanel } from "./PoemSuggestionsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, AlertCircle, CheckCircle } from "lucide-react";

interface NotebookPhase6Props {
  projectId?: string;
  showTitle?: boolean;
}

/**
 * NotebookPhase6 - Full-featured notebook with Phase 6 enhancements
 *
 * Integrates:
 * - Line progression tracking
 * - Auto-save functionality
 * - Keyboard shortcuts
 * - Poem assembly view
 * - Draft management
 * - Navigation between lines
 */
export default function NotebookPhase6({
  projectId: propProjectId,
  showTitle = true,
}: NotebookPhase6Props = {}) {
  // Notebook state
  const droppedCells = useNotebookStore((s) => s.droppedCells);
  const currentLineIndex = useNotebookStore((s) => s.currentLineIndex);
  const draftTranslations = useNotebookStore((s) => s.draftTranslations);
  const isDirty = useNotebookStore((s) => s.isDirty);
  const showPoemAssembly = useNotebookStore((s) => s.showPoemAssembly);
  const mode = useNotebookStore((s) => s.mode);
  const modifiedCells = useNotebookStore((s) => s.modifiedCells);

  // Notebook actions
  const finalizeCurrentLine = useNotebookStore((s) => s.finalizeCurrentLine);
  const navigateToLine = useNotebookStore((s) => s.navigateToLine);
  const resetLine = useNotebookStore((s) => s.resetLine);
  const togglePoemAssembly = useNotebookStore((s) => s.togglePoemAssembly);
  const startSession = useNotebookStore((s) => s.startSession);
  const updateCellText = useNotebookStore((s) => s.updateCellText);
  const removeCell = useNotebookStore((s) => s.removeCell);
  const markCellModified = useNotebookStore((s) => s.markCellModified);
  const saveDraftTranslation = useNotebookStore((s) => s.saveDraftTranslation);

  // Workshop state
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const workshopSelectedLine = useWorkshopStore((s) => s.selectedLineIndex);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);
  const selectLine = useWorkshopStore((s) => s.selectLine);

  // Workspace state - use prop if provided, otherwise fall back to store
  const storeProjectId = useWorkspace((s) => s.projectId);
  const projectId = propProjectId || storeProjectId;

  // Dialog state
  const [showFinalizeDialog, setShowFinalizeDialog] = React.useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = React.useState(false);
  const [showComparisonView, setShowComparisonView] = React.useState(false);
  const [showJourneySummary, setShowJourneySummary] = React.useState(false);
  const [showJourneyReflection, setShowJourneyReflection] =
    React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [hasShownCelebration, setHasShownCelebration] = React.useState(false);
  // Track which lines were manually finalized by the user (not auto-populated from translation job)
  const [manuallyFinalizedLines, setManuallyFinalizedLines] = React.useState<
    Set<number>
  >(new Set());
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [composerValue, setComposerValue] = React.useState("");
  const [isComposerManuallyEdited, setIsComposerManuallyEdited] =
    React.useState(false);
  const [editingCellId, setEditingCellId] = React.useState<string | null>(null);

  // AI Assistant state
  const [showAIPanel, setShowAIPanel] = React.useState(false);
  const [showPoemSuggestions, setShowPoemSuggestions] = React.useState(false);
  const threadId = useThreadId();
  const guideAnswers = useGuideStore((s) => s.answers);
  const poem = useGuideStore((s) => s.poem);

  // Save manual line mutation
  const saveManualLine = useSaveManualLine();

  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  // Start session on mount
  React.useEffect(() => {
    startSession();
  }, [startSession]);

  // Reset editing state when line changes
  React.useEffect(() => {
    setEditingCellId(null);
    setIsComposerManuallyEdited(false); // Reset manual edit flag when line changes
  }, [currentLineIndex]);

  // Reset celebration state when poem changes (new poem loaded)
  React.useEffect(() => {
    setShowCelebration(false);
    setHasShownCelebration(false);
    setManuallyFinalizedLines(new Set());
  }, [poemLines.length]);

  React.useEffect(() => {
    if (
      editingCellId &&
      !droppedCells.some((cell) => cell.id === editingCellId)
    ) {
      setEditingCellId(null);
    }
  }, [editingCellId, droppedCells]);

  // Keep notebook line in sync with workshop selection
  // BUT: Only sync FROM workshop TO notebook, not the other way around
  // Use a ref to track if we're actively navigating in the notebook
  const isNavigatingInNotebook = React.useRef(false);

  React.useEffect(() => {
    // Don't sync back to workshop if we just navigated in the notebook
    if (isNavigatingInNotebook.current) {
      isNavigatingInNotebook.current = false;
      return;
    }

    // Sync notebook to workshop selection (when user clicks a line in Workshop)
    if (
      workshopSelectedLine !== null &&
      workshopSelectedLine !== currentLineIndex
    ) {
      console.log(
        "[NotebookPhase6] Syncing to workshop line:",
        workshopSelectedLine
      );
      navigateToLine(workshopSelectedLine);
    }
  }, [workshopSelectedLine, currentLineIndex, navigateToLine]);

  // Check for completion and trigger celebration - ONLY when user manually finalizes all lines
  React.useEffect(() => {
    // Only celebrate if ALL lines were manually finalized by the user
    // Not when they're auto-populated from background translation processing
    const totalLines = poemLines.length;
    const manuallyFinalizedCount = manuallyFinalizedLines.size;
    const isManuallyComplete =
      totalLines > 0 && manuallyFinalizedCount === totalLines;

    if (isManuallyComplete && !hasShownCelebration) {
      // Show celebration after a brief delay
      setTimeout(() => {
        setShowCelebration(true);
        setHasShownCelebration(true);
      }, 500);
    }
  }, [manuallyFinalizedLines, poemLines.length, hasShownCelebration]);

  // Get current translation from cells
  const getCurrentTranslation = React.useCallback(() => {
    if (currentLineIndex !== null) {
      const draft = draftTranslations.get(currentLineIndex);
      if (draft !== undefined && draft.trim()) {
        return draft;
      }
    }

    // Get text from dropped cells, prioritizing customText over translation.text
    return droppedCells
      .map((cell) => {
        return cell.translation.text;
      })
      .filter(Boolean)
      .join(" ");
  }, [droppedCells, draftTranslations, currentLineIndex]);

  // Auto-save hook
  const { saveNow, lastSaved } = useAutoSave(
    currentLineIndex,
    getCurrentTranslation,
    {
      enabled: mode === "edit" && isDirty,
      debounceMs: 3000,
      onSave: (translation) => {
        console.log(
          "[NotebookPhase6] Auto-saved draft:",
          translation.substring(0, 50)
        );
      },
      onError: (error) => {
        console.error("[NotebookPhase6] Auto-save error:", error);
      },
    }
  );

  const { timeSinceSave } = useAutoSaveIndicator(lastSaved);

  const draftForCurrentLine = React.useMemo(() => {
    if (currentLineIndex === null) return undefined;
    return draftTranslations.get(currentLineIndex);
  }, [currentLineIndex, draftTranslations]);

  React.useEffect(() => {
    if (currentLineIndex === null) {
      setComposerValue("");
      setIsComposerManuallyEdited(false);
      return;
    }

    // Only auto-update from cells if user hasn't manually edited the compiled line
    // This allows users to freely edit the compiled text without it being overwritten
    if (isComposerManuallyEdited) {
      return; // Don't overwrite manual edits
    }

    // Auto-recompile from droppedCells when cells change
    // This ensures the compiled section updates immediately when words are dropped
    const joined = droppedCells
      .map((cell) => {
        return cell.translation.text;
      })
      .filter(Boolean)
      .join(" ");

    if (joined.trim()) {
      setComposerValue(joined);
      // Update the draft to match the compiled text from cells
      saveDraftTranslation(currentLineIndex, joined);
    } else {
      // If no cells, check if there's a draft (from manual editing)
      const draft = draftForCurrentLine;
      if (typeof draft === "string" && draft.trim()) {
        setComposerValue(draft);
      } else {
        setComposerValue("");
      }
    }
  }, [
    currentLineIndex,
    droppedCells,
    draftForCurrentLine,
    saveDraftTranslation,
    isComposerManuallyEdited,
  ]);

  const handleComposerChange = React.useCallback(
    (value: string) => {
      setComposerValue(value);
      setIsComposerManuallyEdited(true); // Mark as manually edited
      if (currentLineIndex !== null) {
        saveDraftTranslation(currentLineIndex, value);
      }
    },
    [currentLineIndex, saveDraftTranslation]
  );

  // Recompile text from cells (when user clicks Recompile button)
  const recompileFromCells = React.useCallback(() => {
    if (currentLineIndex === null) return;

    const joined = droppedCells
      .map((cell) => {
        return cell.translation.text;
      })
      .filter(Boolean)
      .join(" ");

    if (joined.trim()) {
      setComposerValue(joined);
      setIsComposerManuallyEdited(false); // Reset manual edit flag since we're recompiling
      saveDraftTranslation(currentLineIndex, joined);
    }
  }, [droppedCells, currentLineIndex, saveDraftTranslation]);

  // Handle finalization
  const handleFinalize = React.useCallback(async () => {
    console.log("[handleFinalize] START - currentLineIndex:", currentLineIndex);

    if (currentLineIndex === null) {
      console.log("[handleFinalize] ABORT - currentLineIndex is null");
      return;
    }

    if (!threadId) {
      console.error("[handleFinalize] ABORT - no threadId");
      alert("Cannot save: no thread ID");
      return;
    }

    const translation = getCurrentTranslation();
    console.log("[handleFinalize] Translation:", translation);

    if (!translation.trim()) {
      alert("Cannot save an empty translation");
      return;
    }

    console.log(
      `[handleFinalize] Saving line ${currentLineIndex}:`,
      translation
    );

    // Save to workshop completed lines (local state)
    setCompletedLine(currentLineIndex, translation);

    // Track that this line was manually finalized by the user
    setManuallyFinalizedLines((prev) => {
      const updated = new Set(prev);
      updated.add(currentLineIndex);
      console.log(
        "[handleFinalize] Updated manuallyFinalizedLines:",
        Array.from(updated)
      );
      return updated;
    });

    // Close dialog first
    setShowFinalizeDialog(false);

    // Clear notebook state for this line
    console.log("[handleFinalize] Calling finalizeCurrentLine()");
    finalizeCurrentLine();

    // Persist to Supabase
    try {
      console.log("[handleFinalize] Persisting to Supabase via API...");
      await saveManualLine.mutateAsync({
        threadId,
        lineIndex: currentLineIndex,
        originalLine: poemLines[currentLineIndex] || "",
        translatedLine: translation,
      });
      console.log("[handleFinalize] ✓ Successfully persisted to Supabase");
    } catch (error) {
      console.error("[handleFinalize] Failed to persist to Supabase:", error);
      alert("Warning: Translation saved locally but failed to sync to server");
    }

    // Navigate to next line if available (use setTimeout to ensure state updates)
    const nextLineIndex = currentLineIndex + 1;
    console.log(
      `[handleFinalize] Next line index: ${nextLineIndex}, Total lines: ${poemLines.length}`
    );

    if (nextLineIndex < poemLines.length) {
      console.log(
        `[handleFinalize] Will navigate to line ${nextLineIndex} after delay`
      );
      // Use setTimeout to ensure dialog closes and state updates before navigation
      setTimeout(() => {
        console.log(`[handleFinalize] NOW navigating to line ${nextLineIndex}`);
        // Set flag to prevent workshop sync from overriding our navigation
        isNavigatingInNotebook.current = true;

        // Update both Notebook AND Workshop to keep them in sync
        navigateToLine(nextLineIndex);
        selectLine(nextLineIndex); // Sync Workshop to same line

        console.log(
          `[handleFinalize] navigateToLine() and selectLine() called for line ${nextLineIndex}`
        );
      }, 100);
    } else {
      console.log(
        `[handleFinalize] Last line reached (${currentLineIndex + 1}/${
          poemLines.length
        }), not navigating`
      );
    }
  }, [
    currentLineIndex,
    threadId,
    getCurrentTranslation,
    setCompletedLine,
    setManuallyFinalizedLines,
    finalizeCurrentLine,
    saveManualLine,
    poemLines,
    navigateToLine,
    selectLine,
  ]);

  // AI Assistant handlers
  const handleOpenAIAssist = React.useCallback(() => {
    if (currentLineIndex === null || !composerValue.trim()) {
      return;
    }
    setShowAIPanel(true);
  }, [currentLineIndex, composerValue]);

  const handleApplyAISuggestion = React.useCallback(
    (cellId: string, suggestion: string) => {
      if (currentLineIndex === null) return;
      handleComposerChange(suggestion);
      setShowAIPanel(false);
    },
    [currentLineIndex, handleComposerChange]
  );

  const handleCloseAIPanel = React.useCallback(() => {
    setShowAIPanel(false);
  }, []);

  // Convert current translation to DragData format for AI Assistant
  const selectedWordsForAI: DragData[] = React.useMemo(() => {
    if (!composerValue.trim()) return [];
    return composerValue
      .split(/\s+/)
      .filter(Boolean)
      .map((word, idx) => ({
        id: `ai-assist-${idx}`,
        text: word,
        originalWord: word, // In notebook, we don't track original separately
        partOfSpeech: "neutral" as const,
        sourceLineNumber: currentLineIndex !== null ? currentLineIndex + 1 : 0,
        position: idx,
        dragType: "option" as const,
      }));
  }, [composerValue, currentLineIndex]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onFinalizeCurrentLine: () => {
      if (currentLineIndex !== null && getCurrentTranslation().trim()) {
        setShowFinalizeDialog(true);
      }
    },
    onNavigatePrevious: () => {
      if (currentLineIndex !== null && currentLineIndex > 0) {
        navigateToLine(currentLineIndex - 1);
      }
    },
    onNavigateNext: () => {
      if (
        currentLineIndex !== null &&
        currentLineIndex < poemLines.length - 1
      ) {
        navigateToLine(currentLineIndex + 1);
      }
    },
    onManualSave: async () => {
      await saveNow();
    },
    onCancel: () => {
      if (showAIPanel) {
        setShowAIPanel(false);
      } else if (showFinalizeDialog) {
        setShowFinalizeDialog(false);
      } else if (currentLineIndex !== null) {
        resetLine(currentLineIndex);
      }
    },
    isEnabled: !showPoemAssembly,
  });

  // Keyboard shortcut for AI Assist: Cmd/Ctrl+Shift+A
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (currentLineIndex !== null && composerValue.trim() && !showAIPanel) {
          handleOpenAIAssist();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLineIndex, composerValue, showAIPanel, handleOpenAIAssist]);

  // Show poem assembly view
  if (showPoemAssembly) {
    return (
      <div className="h-full flex flex-col p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium font-serif">Poem Assembly</h2>
          <Button variant="outline" size="sm" onClick={togglePoemAssembly}>
            Back to Notebook
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PoemAssembly
            onEditLine={(lineIndex) => {
              togglePoemAssembly();
              navigateToLine(lineIndex);
            }}
            showSource={true}
            enableActions={true}
          />
        </div>
      </div>
    );
  }

  // Main notebook view
  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex-shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {showTitle ? (
              <h2 className="text-base font-semibold tracking-tight text-slate-900 lg:text-lg">
                Notebook
              </h2>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {lastSaved && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>{timeSinceSave}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Badge */}
        {currentLineIndex !== null && (
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Line {currentLineIndex + 1} of {poemLines.length}
            </Badge>
            {manuallyFinalizedLines.has(currentLineIndex) && (
              <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                ✓ Saved
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Line Navigation
        {poemLines.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-800 flex-shrink-0"></div>
        )} */}

        {/* Current Line Display */}
        {currentLineIndex !== null && poemLines[currentLineIndex] && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="text-xs font-semibold text-blue-700 uppercase mb-1">
                  Source Line {currentLineIndex + 1}
                </div>
                <p className="text-sm text-gray-800 italic">
                  {poemLines[currentLineIndex]}
                </p>
              </div>
            </div>

            {/* Show draft if exists */}
            {draftTranslations.has(currentLineIndex) && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                <div className="flex items-center gap-1 text-amber-700">
                  <AlertCircle className="w-3 h-3" />
                  <span className="font-medium">Draft saved</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notebook Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {poemLines.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  No Poem Loaded
                </h3>
                <p className="text-sm text-gray-600">
                  Complete the Guide Rail to load a poem and start translating.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Drop Zone Area */}
              <div className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <NotebookDropZone
                  cells={
                    currentLineIndex !== null
                      ? droppedCells.map((cell) => ({
                          id: cell.id,
                          words: [],
                          isEditing: editingCellId === cell.id,
                          isLocked:
                            (cell.translation.lockedWords?.length ?? 0) > 0,
                          isModified: modifiedCells.has(cell.id),
                          customText: cell.translation.text,
                          translationText: cell.translation.text,
                          sourceLineNumber: cell.lineIndex + 1,
                        }))
                      : []
                  }
                  mode={mode}
                  canDrop={currentLineIndex !== null}
                  isActive={isDragActive}
                  inactiveTitle="Select a Line to Translate"
                  inactiveDescription="Choose a line from the Workshop panel to begin arranging your translation."
                  inactiveAction={
                    <Button
                      onClick={togglePoemAssembly}
                      variant="outline"
                      size="sm"
                    >
                      View Progress
                    </Button>
                  }
                  onEditCell={(cellId) => setEditingCellId(cellId)}
                  onSaveCell={(id, text) => {
                    updateCellText(id, text);
                    markCellModified(id);
                    setEditingCellId(null);
                  }}
                  onCancelEdit={() => setEditingCellId(null)}
                  onRemoveCell={removeCell}
                  onToggleLock={() => console.log("Toggle lock")}
                />
              </div>

              {/* Compiled Line - Fixed at Bottom */}
              {currentLineIndex !== null && (
                <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Compiled line
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={recompileFromCells}
                          className="text-xs h-6 px-2"
                          disabled={droppedCells.length === 0}
                          title="Recompile from cells"
                        >
                          Recompile
                        </Button>
                        <span className="text-[11px] text-gray-400">
                          Click to edit • Used for AI assist & saving
                        </span>
                      </div>
                    </div>
                    <Textarea
                      value={composerValue}
                      onChange={(e) => handleComposerChange(e.target.value)}
                      placeholder="Assemble your translation here… (You can edit this directly)"
                      className="min-h-[70px] text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {currentLineIndex !== null && droppedCells.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  {showShortcutsHelp ? "Hide" : "Show"} keyboard shortcuts
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetLine(currentLineIndex)}
                >
                  Reset Line
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowFinalizeDialog(true)}
                  disabled={!getCurrentTranslation().trim()}
                >
                  Save Line (⌘↵)
                </Button>
              </div>
            </div>

            {/* Shortcuts help panel */}
            {showShortcutsHelp && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <KeyboardShortcutsHint />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Finalize Dialog */}
      <FinalizeLineDialog
        open={showFinalizeDialog}
        onOpenChange={setShowFinalizeDialog}
        lineIndex={currentLineIndex ?? 0}
        sourceText={
          currentLineIndex !== null ? poemLines[currentLineIndex] : ""
        }
        translationText={getCurrentTranslation()}
        onConfirm={handleFinalize}
        showWarning={true}
      />

      {/* Comparison View */}
      <ComparisonView
        open={showComparisonView}
        onOpenChange={setShowComparisonView}
        highlightDiffs={true}
        showLineNumbers={false}
      />

      {/* Journey Summary */}
      <JourneySummary
        open={showJourneySummary}
        onOpenChange={setShowJourneySummary}
      />

      {/* Journey Reflection */}
      <JourneyReflection
        open={showJourneyReflection}
        onOpenChange={setShowJourneyReflection}
        projectId={projectId || ""}
      />

      {/* Completion Celebration */}
      <CompletionCelebration
        open={showCelebration}
        onOpenChange={setShowCelebration}
        totalLines={poemLines.length}
        onViewComparison={() => {
          setShowCelebration(false);
          setShowComparisonView(true);
        }}
        onViewJourney={() => {
          setShowCelebration(false);
          setShowJourneySummary(true);
        }}
        onExport={() => {
          setShowCelebration(false);
          togglePoemAssembly();
        }}
      />

      {/* AI Assistant Panel Overlay */}
      {showAIPanel &&
        currentLineIndex !== null &&
        threadId &&
        composerValue.trim() && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <AIAssistantPanel
              selectedWords={selectedWordsForAI}
              sourceLineText={
                currentLineIndex !== null
                  ? poemLines[currentLineIndex] || ""
                  : ""
              }
              guideAnswers={guideAnswers}
              threadId={threadId}
              cellId={`line-${currentLineIndex}`}
              onApplySuggestion={handleApplyAISuggestion}
              onClose={handleCloseAIPanel}
              instruction="refine"
            />
          </div>
        )}

      {/* Poem Suggestions Panel Overlay (macro-level suggestions) */}
      {showPoemSuggestions && threadId && poem.text && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6 z-50 overflow-y-auto">
          <PoemSuggestionsPanel
            threadId={threadId}
            sourcePoem={poem.text}
            translationPoem={
              droppedCells
                .map((cell) => cell.translation.text)
                .filter(Boolean)
                .join("\n") || ""
            }
            guideAnswers={guideAnswers as Record<string, unknown>}
            onClose={() => setShowPoemSuggestions(false)}
          />
        </div>
      )}
    </div>
  );
}
