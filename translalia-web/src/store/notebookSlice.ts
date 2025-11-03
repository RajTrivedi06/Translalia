"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";
import { NotebookCell, NotebookFilter } from "@/types/notebook";
import {
  HistoryManager,
  createInitialHistory,
  addToHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
} from "@/lib/notebook/historyManager";

export type NotebookMode = "arrange" | "edit";

export interface NotebookState {
  // Hydration flag
  hydrated: boolean;
  // Thread metadata
  meta: { threadId: string | null };

  // Cells
  cells: NotebookCell[];

  // Focus
  focusedCellIndex: number | null;

  // UI
  view: {
    showPrismatic: boolean;
    showLineNumbers: boolean;
    compareMode: boolean;
  };
  filter: NotebookFilter;

  // Editing
  editingCellIndex: number | null;
  isDirty: boolean;

  // Drag and Drop state
  droppedCells: NotebookCell[];
  cellEditMode: boolean;
  currentLineIndex: number | null;

  // Mode Management (Phase 4)
  mode: NotebookMode;
  modifiedCells: Set<string>; // Track which cells have been modified

  // History Management (Phase 4)
  history: HistoryManager;

  // Phase 6: Line Progression & Poem Assembly
  draftTranslations: Map<number, string>; // Work-in-progress translations per line
  lastEditedLine: number | null; // Track where user left off
  sessionStartTime: Date | null; // For analytics
  autoSaveTimestamp: Date | null; // Track last auto-save
  showPoemAssembly: boolean; // Toggle poem assembly view

  // Actions
  setCells: (cells: NotebookCell[]) => void;
  updateCell: (index: number, updates: Partial<NotebookCell>) => void;
  focusCell: (index: number) => void;
  startEditing: (index: number) => void;
  stopEditing: () => void;
  togglePrismatic: () => void;
  setFilter: (filter: NotebookFilter) => void;
  addNote: (cellIndex: number, note: string) => void;
  toggleLock: (cellIndex: number, wordPosition: number) => void;
  setShowLineNumbers: (show: boolean) => void;
  setCompareMode: (enabled: boolean) => void;

  // Drag and Drop actions
  addCell: (cell: NotebookCell, position?: number) => void;
  removeCell: (cellId: string) => void;
  reorderCells: (startIndex: number, endIndex: number) => void;
  updateCellText: (cellId: string, text: string) => void;
  setCellEditMode: (enabled: boolean) => void;
  setCurrentLineIndex: (index: number | null) => void;

  // Mode Management actions (Phase 4)
  setMode: (mode: NotebookMode) => void;
  toggleMode: () => void;
  markCellModified: (cellId: string) => void;
  clearModifiedCells: () => void;

  // History Management actions (Phase 4)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Phase 6: Line Progression actions
  saveDraftTranslation: (lineIndex: number, translation: string) => void;
  finalizeCurrentLine: () => void;
  navigateToLine: (lineIndex: number) => void;
  resetLine: (lineIndex: number) => void;
  togglePoemAssembly: () => void;
  setAutoSaveTimestamp: () => void;
  startSession: () => void;

  reset: () => void;
}

const initialState = {
  cells: [],
  focusedCellIndex: null,
  view: {
    showPrismatic: false,
    showLineNumbers: true,
    compareMode: false,
  },
  filter: "all" as NotebookFilter,
  editingCellIndex: null,
  isDirty: false,
  droppedCells: [],
  cellEditMode: false,
  currentLineIndex: null,
  mode: "arrange" as NotebookMode,
  modifiedCells: new Set<string>(),
  history: createInitialHistory([]),
  // Phase 6
  draftTranslations: new Map<number, string>(),
  lastEditedLine: null,
  sessionStartTime: null,
  autoSaveTimestamp: null,
  showPoemAssembly: false,
};

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: getActiveThreadId() },
      ...initialState,

      setCells: (cells: NotebookCell[]) =>
        set({
          cells,
          meta: { threadId: getActiveThreadId() },
        }),

      updateCell: (index: number, updates: Partial<NotebookCell>) =>
        set((state) => {
          const cells = [...state.cells];
          if (cells[index]) {
            cells[index] = { ...cells[index], ...updates };
          }
          return { cells, isDirty: true };
        }),

      focusCell: (index: number) => set({ focusedCellIndex: index }),

      startEditing: (index: number) => set({ editingCellIndex: index }),

      stopEditing: () => set({ editingCellIndex: null, isDirty: false }),

      togglePrismatic: () =>
        set((state) => ({
          view: {
            ...state.view,
            showPrismatic: !state.view.showPrismatic,
          },
        })),

      setFilter: (filter: NotebookFilter) => set({ filter }),

      addNote: (cellIndex: number, note: string) =>
        set((state) => {
          const cells = [...state.cells];
          if (cells[cellIndex]) {
            const existingNotes = cells[cellIndex].notes || [];
            cells[cellIndex] = {
              ...cells[cellIndex],
              notes: [...existingNotes, note],
            };
          }
          return { cells, isDirty: true };
        }),

      toggleLock: (cellIndex: number, wordPosition: number) =>
        set((state) => {
          const cells = [...state.cells];
          if (cells[cellIndex]) {
            const lockedWords = cells[cellIndex].translation.lockedWords || [];
            const isLocked = lockedWords.includes(wordPosition);

            cells[cellIndex] = {
              ...cells[cellIndex],
              translation: {
                ...cells[cellIndex].translation,
                lockedWords: isLocked
                  ? lockedWords.filter((p) => p !== wordPosition)
                  : [...lockedWords, wordPosition],
              },
            };
          }
          return { cells, isDirty: true };
        }),

      setShowLineNumbers: (show: boolean) =>
        set((state) => ({
          view: {
            ...state.view,
            showLineNumbers: show,
          },
        })),

      setCompareMode: (enabled: boolean) =>
        set((state) => ({
          view: {
            ...state.view,
            compareMode: enabled,
          },
        })),

      // Drag and Drop actions
      addCell: (cell: NotebookCell, position?: number) =>
        set((state) => {
          const newDroppedCells = [...state.droppedCells];
          if (
            position !== undefined &&
            position >= 0 &&
            position <= newDroppedCells.length
          ) {
            newDroppedCells.splice(position, 0, cell);
          } else {
            newDroppedCells.push(cell);
          }
          const newHistory = addToHistory(state.history, newDroppedCells);
          return {
            droppedCells: newDroppedCells,
            history: newHistory,
            isDirty: true,
          };
        }),

      removeCell: (cellId: string) =>
        set((state) => {
          const newDroppedCells = state.droppedCells.filter(
            (c) => c.id !== cellId
          );
          const newHistory = addToHistory(state.history, newDroppedCells);
          return {
            droppedCells: newDroppedCells,
            history: newHistory,
            isDirty: true,
          };
        }),

      reorderCells: (startIndex: number, endIndex: number) =>
        set((state) => {
          const newDroppedCells = [...state.droppedCells];
          const [removed] = newDroppedCells.splice(startIndex, 1);
          newDroppedCells.splice(endIndex, 0, removed);
          const newHistory = addToHistory(state.history, newDroppedCells);
          return {
            droppedCells: newDroppedCells,
            history: newHistory,
            isDirty: true,
          };
        }),

      updateCellText: (cellId: string, text: string) =>
        set((state) => {
          const newDroppedCells = state.droppedCells.map((cell) =>
            cell.id === cellId
              ? {
                  ...cell,
                  translation: {
                    ...cell.translation,
                    text,
                  },
                }
              : cell
          );
          const newHistory = addToHistory(state.history, newDroppedCells);
          return {
            droppedCells: newDroppedCells,
            history: newHistory,
            isDirty: true,
          };
        }),

      setCellEditMode: (enabled: boolean) => set({ cellEditMode: enabled }),

      setCurrentLineIndex: (index: number | null) =>
        set({ currentLineIndex: index }),

      // Mode Management actions (Phase 4)
      setMode: (mode: NotebookMode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === "arrange" ? "edit" : "arrange",
        })),

      markCellModified: (cellId: string) =>
        set((state) => {
          const newModifiedCells = new Set(state.modifiedCells);
          newModifiedCells.add(cellId);
          return { modifiedCells: newModifiedCells };
        }),

      clearModifiedCells: () => set({ modifiedCells: new Set() }),

      // History Management actions (Phase 4)
      undo: () =>
        set((state) => {
          const newHistory = undoHistory(state.history);
          if (!newHistory) return {}; // Nothing to undo

          return {
            history: newHistory,
            droppedCells: newHistory.present.droppedCells,
          };
        }),

      redo: () =>
        set((state) => {
          const newHistory = redoHistory(state.history);
          if (!newHistory) return {}; // Nothing to redo

          return {
            history: newHistory,
            droppedCells: newHistory.present.droppedCells,
          };
        }),

      canUndo: () => {
        const state = get();
        return canUndo(state.history);
      },

      canRedo: () => {
        const state = get();
        return canRedo(state.history);
      },

      // Phase 6: Line Progression actions
      saveDraftTranslation: (lineIndex: number, translation: string) =>
        set((state) => {
          const draftTranslations = new Map(state.draftTranslations);
          if (translation.trim()) {
            draftTranslations.set(lineIndex, translation);
          } else {
            draftTranslations.delete(lineIndex);
          }
          return {
            draftTranslations,
            lastEditedLine: lineIndex,
            isDirty: true,
          };
        }),

      finalizeCurrentLine: () =>
        set((state) => {
          if (state.currentLineIndex === null) return {};

          const draftTranslations = new Map(state.draftTranslations);
          draftTranslations.delete(state.currentLineIndex);

          return {
            draftTranslations,
            isDirty: false,
            lastEditedLine: state.currentLineIndex,
          };
        }),

      navigateToLine: (lineIndex: number) =>
        set((state) => {
          // Save current work as draft if exists
          if (state.currentLineIndex !== null) {
            const currentTranslation = state.droppedCells
              .map((cell) => cell.translation.text)
              .filter(Boolean)
              .join(" ");

            if (currentTranslation.trim()) {
              const draftTranslations = new Map(state.draftTranslations);
              draftTranslations.set(state.currentLineIndex, currentTranslation);
              return {
                currentLineIndex: lineIndex,
                draftTranslations,
                droppedCells: [], // Clear cells for new line
                isDirty: false,
              };
            }
          }

          return {
            currentLineIndex: lineIndex,
            droppedCells: [], // Clear cells for new line
            isDirty: false,
          };
        }),

      resetLine: (lineIndex: number) =>
        set((state) => {
          const draftTranslations = new Map(state.draftTranslations);
          draftTranslations.delete(lineIndex);

          return {
            draftTranslations,
            droppedCells:
              state.currentLineIndex === lineIndex ? [] : state.droppedCells,
            isDirty: false,
          };
        }),

      togglePoemAssembly: () =>
        set((state) => ({
          showPoemAssembly: !state.showPoemAssembly,
        })),

      setAutoSaveTimestamp: () =>
        set({
          autoSaveTimestamp: new Date(),
        }),

      startSession: () =>
        set({
          sessionStartTime: new Date(),
        }),

      reset: () =>
        set({ ...initialState, meta: { threadId: getActiveThreadId() } }),
    }),
    {
      name: "notebook-storage",
      version: 1,
      storage: createJSONStorage(() => threadStorage),
      // If the persisted payload is for a different thread, ignore it
      merge: (persisted, current) => {
        const tid = getActiveThreadId();
        const p = persisted as NotebookState;
        if (!p || !tid) {
          return {
            ...current,
            hydrated: true,
            meta: { threadId: tid ?? null },
          };
        }
        if (p.meta?.threadId && p.meta.threadId !== tid) {
          return { ...current, hydrated: true, meta: { threadId: tid } };
        }
        return { ...current, ...p, hydrated: true, meta: { threadId: tid } };
      },
      onRehydrateStorage: () => (state) => {
        if (state && !state.hydrated) {
          state.hydrated = true;
        }
      },
      partialize: (state) => ({
        meta: state.meta,
        focusedCellIndex: state.focusedCellIndex,
        view: state.view,
        filter: state.filter,
      }),
    }
  )
);
