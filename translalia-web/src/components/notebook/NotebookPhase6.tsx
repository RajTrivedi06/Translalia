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
import { useDndMonitor } from "@dnd-kit/core";
import { LineProgressIndicator } from "./LineProgressIndicator";
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
import Sheet, {
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FileText,
  Save,
  Undo2,
  Redo2,
  AlertCircle,
  CheckCircle,
  ArrowRightLeft, // Correct import name
  Sparkles,
  Menu,
  X,
} from "lucide-react";

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
  const cellEditMode = useNotebookStore((s) => s.cellEditMode);
  const modifiedCells = useNotebookStore((s) => s.modifiedCells);

  // Notebook actions
  const finalizeCurrentLine = useNotebookStore((s) => s.finalizeCurrentLine);
  const navigateToLine = useNotebookStore((s) => s.navigateToLine);
  const resetLine = useNotebookStore((s) => s.resetLine);
  const togglePoemAssembly = useNotebookStore((s) => s.togglePoemAssembly);
  const startSession = useNotebookStore((s) => s.startSession);
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
  const [showComparison, setShowComparison] = React.useState(false);
  const [showJourneySummary, setShowJourneySummary] = React.useState(false);
  const [showJourneyReflection, setShowJourneyReflection] =
    React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [hasShownCelebration, setHasShownCelebration] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [composerValue, setComposerValue] = React.useState("");
  const [actionMenuOpen, setActionMenuOpen] = React.useState(false);

  // AI Assistant state
  const [showAIPanel, setShowAIPanel] = React.useState(false);
  const [showPoemSuggestions, setShowPoemSuggestions] = React.useState(false);
  const threadId = useThreadId();
  const guideAnswers = useGuideStore((s) => s.answers);
  const poem = useGuideStore((s) => s.poem);

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

    // Always recompile from droppedCells when cells change
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
  ]);

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

  const createMenuActionHandler = React.useCallback(
    (fn: () => void | Promise<void>) => {
      return async () => {
        await fn();
        setActionMenuOpen(false);
      };
    },
    [setActionMenuOpen]
  );

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
              <Sheet open={actionMenuOpen} onOpenChange={setActionMenuOpen}>
                <Button
                  variant="outline"
                  size="sm"
                  className="inline-flex items-center gap-2 px-3"
                  onClick={() => setActionMenuOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <SheetContent
                  side="right"
                  className="max-w-[400px]"
                  ariaLabelledby="notebook-actions-title"
                >
                  <SheetHeader className="bg-slate-50">
                    <SheetTitle
                      id="notebook-actions-title"
                      className="text-base text-slate-900"
                    >
                      Notebook actions
                    </SheetTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-slate-900"
                      onClick={() => setActionMenuOpen(false)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close actions</span>
                    </Button>
                  </SheetHeader>
                  <div className="space-y-4 overflow-y-auto p-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Session
                      </p>
                      <NotebookActionButton
                        icon={Save}
                        label="Save now"
                        description="Cmd/Ctrl + S"
                        onClick={createMenuActionHandler(saveNow)}
                        disabled={!isDirty}
                      />
                      <NotebookActionButton
                        icon={Undo2}
                        label="Undo"
                        description="Cmd/Ctrl + Z"
                        onClick={createMenuActionHandler(undo)}
                        disabled={!canUndoAction}
                      />
                      <NotebookActionButton
                        icon={Redo2}
                        label="Redo"
                        description="Cmd/Ctrl + Shift + Z"
                        onClick={createMenuActionHandler(redo)}
                        disabled={!canRedoAction}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Line tools
                      </p>
                      <NotebookActionButton
                        icon={ArrowRightLeft}
                        label={
                          showComparison
                            ? "Hide inline compare"
                            : "Inline compare"
                        }
                        description="Peek at the source beside your draft"
                        onClick={createMenuActionHandler(() =>
                          setShowComparison((prev) => !prev)
                        )}
                      />
                      {currentLineIndex !== null && composerValue.trim() && (
                        <NotebookActionButton
                          icon={Sparkles}
                          label="AI Assist"
                          description="Let AI refine this line (Cmd/Ctrl+Shift+A)"
                          onClick={createMenuActionHandler(handleOpenAIAssist)}
                        />
                      )}
                      <NotebookActionButton
                        icon={ArrowRightLeft}
                        label="Compare in modal"
                        description="Open a detailed comparison view"
                        onClick={createMenuActionHandler(() =>
                          setShowComparisonView(true)
                        )}
                      />
                      {Object.keys(completedLines).length > 0 && threadId && (
                        <NotebookActionButton
                          icon={Sparkles}
                          label="Poem suggestions"
                          description="Ideas for tone, flow, style"
                          onClick={createMenuActionHandler(() =>
                            setShowPoemSuggestions(true)
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Workflow
                      </p>
                      <NotebookActionButton
                        icon={Sparkles}
                        label="Journey reflection"
                        description="Capture what you’ve learned"
                        onClick={createMenuActionHandler(() =>
                          setShowJourneyReflection(true)
                        )}
                        disabled={Object.keys(completedLines).length === 0}
                      />
                      <NotebookActionButton
                        icon={FileText}
                        label="View assembled poem"
                        description="Open the poem assembly canvas"
                        onClick={createMenuActionHandler(() =>
                          togglePoemAssembly()
                        )}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
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

interface NotebookActionButtonProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  description?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

function NotebookActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled = false,
}: NotebookActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-900">{label}</p>
          {description ? (
            <p className="text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
