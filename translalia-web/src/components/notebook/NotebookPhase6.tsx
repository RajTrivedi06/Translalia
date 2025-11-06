"use client";

import * as React from "react";
import { useNotebookStore } from "@/store/notebookSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useWorkspace } from "@/store/workspace";
import {
  useKeyboardShortcuts,
  KeyboardShortcutsHint,
} from "@/lib/hooks/useKeyboardShortcuts";
import { useAutoSave, useAutoSaveIndicator } from "@/lib/hooks/useAutoSave";
import { useDndMonitor } from "@dnd-kit/core";
import { LineProgressIndicator } from "./LineProgressIndicator";
import { LineNavigation } from "./LineNavigation";
import { FinalizeLineDialog } from "./FinalizeLineDialog";
import { PoemAssembly } from "./PoemAssembly";
import { ComparisonView } from "./ComparisonView";
import { JourneySummary } from "./JourneySummary";
import { JourneyReflection } from "./JourneyReflection";
import { CompletionCelebration } from "./CompletionCelebration";
import { NotebookDropZone } from "./NotebookDropZone";
import { ModeSwitcher } from "./ModeSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Save,
  Undo2,
  Redo2,
  AlertCircle,
  CheckCircle,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react";

interface NotebookPhase6Props {
  projectId?: string;
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
export default function NotebookPhase6({ projectId: propProjectId }: NotebookPhase6Props = {}) {
  // Notebook state
  const droppedCells = useNotebookStore((s) => s.droppedCells);
  const currentLineIndex = useNotebookStore((s) => s.currentLineIndex);
  const draftTranslations = useNotebookStore((s) => s.draftTranslations);
  const isDirty = useNotebookStore((s) => s.isDirty);
  const showPoemAssembly = useNotebookStore((s) => s.showPoemAssembly);
  const mode = useNotebookStore((s) => s.mode);
  const cellEditMode = useNotebookStore((s) => s.cellEditMode);
  const modifiedCells = useNotebookStore((s) => s.modifiedCells);

  // Notebook actions
  const finalizeCurrentLine = useNotebookStore((s) => s.finalizeCurrentLine);
  const navigateToLine = useNotebookStore((s) => s.navigateToLine);
  const resetLine = useNotebookStore((s) => s.resetLine);
  const togglePoemAssembly = useNotebookStore((s) => s.togglePoemAssembly);
  const startSession = useNotebookStore((s) => s.startSession);
  const setMode = useNotebookStore((s) => s.setMode);
  const updateCellText = useNotebookStore((s) => s.updateCellText);
  const removeCell = useNotebookStore((s) => s.removeCell);
  const setCellEditMode = useNotebookStore((s) => s.setCellEditMode);
  const markCellModified = useNotebookStore((s) => s.markCellModified);
  const undo = useNotebookStore((s) => s.undo);
  const redo = useNotebookStore((s) => s.redo);
  const canUndoAction = useNotebookStore((s) => s.canUndo)();
  const canRedoAction = useNotebookStore((s) => s.canRedo)();
  const saveDraftTranslation = useNotebookStore((s) => s.saveDraftTranslation);

  // Workshop state
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const workshopSelectedLine = useWorkshopStore((s) => s.selectedLineIndex);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);

  // Workspace state - use prop if provided, otherwise fall back to store
  const storeProjectId = useWorkspace((s) => s.projectId);
  const projectId = propProjectId || storeProjectId;

  // Dialog state
  const [showFinalizeDialog, setShowFinalizeDialog] = React.useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = React.useState(false);
  const [showComparisonView, setShowComparisonView] = React.useState(false);
  const [showJourneySummary, setShowJourneySummary] = React.useState(false);
  const [showJourneyReflection, setShowJourneyReflection] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [hasShownCelebration, setHasShownCelebration] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [composerValue, setComposerValue] = React.useState("");

  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  // Start session on mount
  React.useEffect(() => {
    startSession();
  }, [startSession]);

  // Keep notebook line in sync with workshop selection
  React.useEffect(() => {
    if (
      workshopSelectedLine !== null &&
      workshopSelectedLine !== currentLineIndex
    ) {
      navigateToLine(workshopSelectedLine);
    }
  }, [workshopSelectedLine, currentLineIndex, navigateToLine]);

  // Check for completion and trigger celebration
  React.useEffect(() => {
    const isComplete =
      poemLines.length > 0 &&
      Object.keys(completedLines).length === poemLines.length;

    if (isComplete && !hasShownCelebration) {
      // Show celebration after a brief delay
      setTimeout(() => {
        setShowCelebration(true);
        setHasShownCelebration(true);
      }, 500);
    }
  }, [completedLines, poemLines.length, hasShownCelebration]);

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
      return;
    }

    const draft = draftForCurrentLine;

    // Get text from dropped cells, prioritizing customText over translation.text
    const joined = droppedCells
      .map((cell) => {
        return cell.translation.text;
      })
      .filter(Boolean)
      .join(" ");

    // If there's a draft, use it; otherwise use the compiled text from cells
    if (typeof draft === "string" && draft.trim()) {
      setComposerValue(draft);
    } else if (joined.trim()) {
      setComposerValue(joined);
    } else {
      setComposerValue("");
    }
  }, [currentLineIndex, draftForCurrentLine, droppedCells]);

  React.useEffect(() => {
    if (currentLineIndex === null) return;

    // Get text from dropped cells, prioritizing customText over translation.text
    const joined = droppedCells
      .map((cell) => {
        return cell.translation.text;
      })
      .filter(Boolean)
      .join(" ");

    const draft = draftTranslations.get(currentLineIndex);

    // Only auto-save if there's no existing draft and we have compiled text
    if (draft === undefined && joined.trim()) {
      saveDraftTranslation(currentLineIndex, joined);
    }
  }, [droppedCells, currentLineIndex, draftTranslations, saveDraftTranslation]);

  const handleComposerChange = React.useCallback(
    (value: string) => {
      setComposerValue(value);
      if (currentLineIndex !== null) {
        saveDraftTranslation(currentLineIndex, value);
      }
    },
    [currentLineIndex, saveDraftTranslation]
  );

  // Recompile text when cells change (for manual editing)
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
      saveDraftTranslation(currentLineIndex, joined);
    }
  }, [droppedCells, currentLineIndex, saveDraftTranslation]);

  // Handle finalization
  const handleFinalize = React.useCallback(() => {
    if (currentLineIndex === null) return;

    const translation = getCurrentTranslation();
    if (!translation.trim()) {
      alert("Cannot finalize an empty translation");
      return;
    }

    // Save to workshop completed lines
    setCompletedLine(currentLineIndex, translation);

    // Clear notebook state for this line
    finalizeCurrentLine();

    // Close dialog
    setShowFinalizeDialog(false);

    // Navigate to next line if available
    const nextLineIndex = currentLineIndex + 1;
    if (nextLineIndex < poemLines.length) {
      navigateToLine(nextLineIndex);
    }
  }, [
    currentLineIndex,
    getCurrentTranslation,
    setCompletedLine,
    finalizeCurrentLine,
    poemLines.length,
    navigateToLine,
  ]);

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
      if (showFinalizeDialog) {
        setShowFinalizeDialog(false);
      } else if (currentLineIndex !== null) {
        resetLine(currentLineIndex);
      }
    },
    isEnabled: !showPoemAssembly,
  });

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
    <div className="h-full flex flex-col">
      {/* Header with Progress */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium font-serif">Notebook</h2>

          <div className="flex items-center gap-2">
            {/* Auto-save indicator */}
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span>{timeSinceSave}</span>
              </div>
            )}

            {/* Manual save button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={saveNow}
              disabled={!isDirty}
              title="Save now (Cmd/Ctrl + S)"
            >
              <Save className="w-4 h-4" />
            </Button>

            {/* Undo/Redo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndoAction}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedoAction}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>

            {/* View Comparison */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComparisonView(true)}
              title="Compare source and translation"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Compare
            </Button>

            {/* View Journey - Reflection Feature */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJourneyReflection(true)}
              title="Reflect on your translation journey"
              disabled={Object.keys(completedLines).length === 0}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Journey
            </Button>

            {/* View Assembly */}
            <Button
              variant="outline"
              size="sm"
              onClick={togglePoemAssembly}
              title="View complete poem"
            >
              <FileText className="w-4 h-4 mr-2" />
              Poem
            </Button>
          </div>
        </div>

        {/* Line Badge */}
        {currentLineIndex !== null && (
          <div className="mb-3">
            <Badge variant="secondary" className="text-xs">
              Line {currentLineIndex + 1} of {poemLines.length}
            </Badge>
          </div>
        )}

        {/* Line Progress Indicator */}
        <LineProgressIndicator />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Line Navigation */}
        {poemLines.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <LineNavigation />
          </div>
        )}

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
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Translation Builder
                  </h3>
                  {currentLineIndex !== null ? (
                    <ModeSwitcher mode={mode} onModeChange={setMode} />
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-xs text-gray-700 bg-gray-200"
                    >
                      Select a line to begin
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <NotebookDropZone
                    cells={
                      currentLineIndex !== null
                        ? droppedCells.map((cell) => ({
                            id: cell.id,
                            words: [],
                            isEditing: cellEditMode,
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
                    onEditCell={() => setCellEditMode(true)}
                    onSaveCell={(id, text) => {
                      updateCellText(id, text);
                      markCellModified(id);
                      setCellEditMode(false);
                    }}
                    onCancelEdit={() => setCellEditMode(false)}
                    onRemoveCell={removeCell}
                    onToggleLock={() => console.log("Toggle lock")}
                  />
                </div>
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
                          Editable summary used for AI assist & saving
                        </span>
                      </div>
                    </div>
                    <Textarea
                      value={composerValue}
                      onChange={(e) => handleComposerChange(e.target.value)}
                      placeholder="Assemble your translation here…"
                      className="min-h-[70px] text-sm bg-white"
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
                  Finalize Line (⌘↵)
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
    </div>
  );
}
