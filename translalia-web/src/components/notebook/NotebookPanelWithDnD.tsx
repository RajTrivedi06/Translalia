"use client";

import * as React from "react";
import { useNotebookStore } from "@/store/notebookSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { NotebookDropZone } from "./NotebookDropZone";
import { TranslationCellData } from "./TranslationCell";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, Sparkles } from "lucide-react";
import { DragData } from "@/types/drag";

/**
 * NotebookPanelWithDnD - Enhanced notebook panel with drag-and-drop support
 *
 * This component replaces the simple textarea NotebookPanel with a full-featured
 * drag-and-drop interface for building translations from workshop words.
 *
 * Features:
 * - Drop zone for accepting dragged words
 * - Translation cells for managing dropped words
 * - Cell editing, reordering, locking, and removal
 * - State persistence via Zustand
 */
export default function NotebookPanelWithDnD() {
  const droppedCells = useNotebookStore((s) => s.droppedCells);
  const addCell = useNotebookStore((s) => s.addCell);
  const removeCell = useNotebookStore((s) => s.removeCell);
  const updateCellText = useNotebookStore((s) => s.updateCellText);
  const [editingCellId, setEditingCellId] = React.useState<string | null>(null);

  // Mode management
  const mode = useNotebookStore((s) => s.mode);
  const toggleMode = useNotebookStore((s) => s.toggleMode);
  const modifiedCells = useNotebookStore((s) => s.modifiedCells);
  const markCellModified = useNotebookStore((s) => s.markCellModified);

  // History management
  const undo = useNotebookStore((s) => s.undo);
  const redo = useNotebookStore((s) => s.redo);
  const canUndoAction = useNotebookStore((s) => s.canUndo)();
  const canRedoAction = useNotebookStore((s) => s.canRedo)();

  // AI Assistant state
  const [showAIPanel, setShowAIPanel] = React.useState(false);
  const [selectedCellForAI, setSelectedCellForAI] = React.useState<
    string | null
  >(null);

  // Get thread ID and guide answers for AI
  const threadId = useThreadId();
  const guideAnswers = useGuideStore((s) => s.answers);
  const poemLines = useWorkshopStore((s) => s.poemLines);

  // Convert NotebookCell[] to TranslationCellData[]
  const cells: TranslationCellData[] = React.useMemo(() => {
    return droppedCells.map((cell) => ({
      id: cell.id,
      words: [], // Will be populated when we store DragData in cells
      isEditing: editingCellId === cell.id,
      isLocked: (cell.translation.lockedWords?.length ?? 0) > 0,
      isModified: modifiedCells.has(cell.id),
      customText: cell.translation.text,
    }));
  }, [droppedCells, modifiedCells, editingCellId]);

  const handleEditCell = (cellId: string) => {
    // Toggle edit mode for the cell
    // For now, we'll use a simple approach - in a full implementation,
    // we'd track which specific cell is being edited
    setEditingCellId(cellId);
  };

  const handleSaveCell = (cellId: string, text: string) => {
    updateCellText(cellId, text);
    markCellModified(cellId);
    setEditingCellId(null);
  };

  const handleCancelEdit = (cellId: string) => {
    setEditingCellId(null);
  };

  const handleRemoveCell = (cellId: string) => {
    removeCell(cellId);
  };

  const handleToggleLock = (cellId: string) => {
    // TODO: Implement lock/unlock logic
    console.log("Toggle lock for cell:", cellId);
  };

  const handleOpenAIAssist = (cellId: string) => {
    setSelectedCellForAI(cellId);
    setShowAIPanel(true);
  };

  React.useEffect(() => {
    if (
      editingCellId &&
      !droppedCells.some((cell) => cell.id === editingCellId)
    ) {
      setEditingCellId(null);
    }
  }, [editingCellId, droppedCells]);

  const handleApplyAISuggestion = (cellId: string, suggestion: string) => {
    updateCellText(cellId, suggestion);
    markCellModified(cellId);
  };

  const handleCloseAIPanel = () => {
    setShowAIPanel(false);
    setSelectedCellForAI(null);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + E: Toggle mode
      if (modifier && e.key === "e") {
        e.preventDefault();
        toggleMode();
      }

      // Cmd/Ctrl + Z: Undo
      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndoAction) {
          undo();
        }
      }

      // Cmd/Ctrl + Shift + Z: Redo
      if (modifier && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedoAction) {
          redo();
        }
      }

      // Cmd/Ctrl + Y: Redo (Windows alternative)
      if (modifier && e.key === "y") {
        e.preventDefault();
        if (canRedoAction) {
          redo();
        }
      }

      // Cmd/Ctrl + Shift + A: AI Assist
      if (modifier && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (cells.length > 0) {
          const firstCell = cells[0];
          if (firstCell) {
            handleOpenAIAssist(firstCell.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMode, undo, redo, canUndoAction, canRedoAction, cells]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-end">
        <div className="flex items-center gap-2">
          {/* AI Assist Button - only show if there are cells */}
          {cells.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => {
                // For demo: assist on first cell. In production, this could be context-aware
                const firstCell = cells[0];
                if (firstCell) {
                  handleOpenAIAssist(firstCell.id);
                }
              }}
              title="AI Assist (Cmd/Ctrl+Shift+A)"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              AI Assist
            </Button>
          )}

          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-1 border-l pl-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={undo}
              disabled={!canUndoAction}
              title="Undo (Cmd/Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={redo}
              disabled={!canRedoAction}
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <NotebookDropZone
          cells={cells}
          mode={mode}
          onEditCell={handleEditCell}
          onSaveCell={handleSaveCell}
          onCancelEdit={handleCancelEdit}
          onRemoveCell={handleRemoveCell}
          onToggleLock={handleToggleLock}
        />

        {/* AI Assistant Panel Overlay */}
        {showAIPanel && selectedCellForAI && threadId && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <AIAssistantPanel
              selectedWords={
                // Get the words for the selected cell
                // For now, we'll create mock DragData from the cell text
                // In production, you'd store actual DragData with cells
                droppedCells
                  .find((c) => c.id === selectedCellForAI)
                  ?.translation.text.split(/\s+/)
                  .map((word, idx) => ({
                    id: `${selectedCellForAI}-${idx}`,
                    text: word,
                    originalWord: word, // TODO: Store original words
                    partOfSpeech: "neutral" as const,
                    sourceLineNumber: 0, // TODO: Store line number
                    position: idx,
                    dragType: "option" as const,
                  })) || []
              }
              sourceLineText={
                poemLines[
                  droppedCells.find((c) => c.id === selectedCellForAI)
                    ?.lineIndex ?? 0
                ] || ""
              }
              guideAnswers={guideAnswers}
              threadId={threadId}
              cellId={selectedCellForAI}
              onApplySuggestion={handleApplyAISuggestion}
              onClose={handleCloseAIPanel}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      {cells.length > 0 && (
        <div className="border-t bg-gray-50 px-4 py-2 flex items-center justify-between text-xs text-gray-600">
          <span>
            {cells.length} cell{cells.length !== 1 ? "s" : ""}
            {modifiedCells.size > 0 && (
              <span className="ml-2 text-green-600">
                • {modifiedCells.size} modified
              </span>
            )}
          </span>
          <button
            className="rounded-lg border px-3 py-1 hover:bg-white transition-colors"
            disabled
          >
            Export (soon)
          </button>
        </div>
      )}
    </div>
  );
}
