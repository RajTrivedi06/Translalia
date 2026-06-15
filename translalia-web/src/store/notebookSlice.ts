"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";

/** A single undo entry for text-based editing */
export interface UndoEntry {
  lineIndex: number;
  text: string;
  timestamp: number;
}

/** Font size options for notebook display */
export type NotebookFontSize = "small" | "medium" | "large";

export interface NotebookState {
  // Thread isolation
  hydrated: boolean;
  meta: { threadId: string | null };

  // Session metadata
  lastEditedLine: number | null;
  sessionStartTime: Date | null;
  autoSaveTimestamp: Date | null;

  // UI preferences
  showLineNumbers: boolean;
  fontSize: NotebookFontSize;

  // Simple undo stack (text-based, not cell-based)
  undoStack: UndoEntry[];

  // Notes state
  threadNote: string | null;
  lineNotes: Record<number, string>;
  noteEditingLineIndex: number | null;
  notesSheetOpen: boolean;

  // Actions
  setLastEditedLine: (lineIndex: number | null) => void;
  updateAutoSaveTimestamp: () => void;
  setFontSize: (size: NotebookFontSize) => void;
  setShowLineNumbers: (show: boolean) => void;
  pushUndo: (lineIndex: number, text: string) => void;
  popUndo: () => UndoEntry | null;
  clearUndoStack: () => void;
  resetSession: () => void;
  reset: () => void;
  resetToDefaults: () => void;
  setThreadId: (threadId: string | null) => void;
  // Notes actions
  setThreadNote: (note: string | null) => void;
  setLineNote: (lineIndex: number, note: string | null) => void;
  setNotes: (
    threadNote: string | null,
    lineNotes: Record<number, string>
  ) => void;
  openNotePopover: (lineIndex: number) => void;
  closeNotePopover: () => void;
  toggleNotesSheet: () => void;
  setNotesSheetOpen: (open: boolean) => void;
}

const initialState = {
  lastEditedLine: null,
  sessionStartTime: null,
  autoSaveTimestamp: null,
  showLineNumbers: true,
  fontSize: "medium" as NotebookFontSize,
  undoStack: [],
  threadNote: null,
  lineNotes: {},
  noteEditingLineIndex: null,
  notesSheetOpen: false,
};

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: null },
      ...initialState,

      setLastEditedLine: (lineIndex: number | null) =>
        set({ lastEditedLine: lineIndex }),

      updateAutoSaveTimestamp: () => set({ autoSaveTimestamp: new Date() }),

      setFontSize: (size: NotebookFontSize) => set({ fontSize: size }),

      setShowLineNumbers: (show: boolean) => set({ showLineNumbers: show }),

      pushUndo: (lineIndex: number, text: string) =>
        set((state) => ({
          undoStack: [
            ...state.undoStack.slice(-19),
            { lineIndex, text, timestamp: Date.now() },
          ],
        })),

      popUndo: () => {
        const state = get();
        if (state.undoStack.length === 0) return null;
        const last = state.undoStack[state.undoStack.length - 1];
        set({ undoStack: state.undoStack.slice(0, -1) });
        return last;
      },

      clearUndoStack: () => set({ undoStack: [] }),

      resetSession: () =>
        set({
          sessionStartTime: new Date(),
          autoSaveTimestamp: null,
          undoStack: [],
        }),

      reset: () =>
        set({ ...initialState, meta: { threadId: getActiveThreadId() } }),

      setThreadId: (threadId: string | null) => {
        set((state) => ({
          meta: { ...state.meta, threadId },
        }));
      },

      resetToDefaults: () => {
        const tid = getActiveThreadId();
        set({
          ...initialState,
          hydrated: true,
          meta: { threadId: tid },
        });
      },

      setThreadNote: (note: string | null) => set({ threadNote: note }),

      setLineNote: (lineIndex: number, note: string | null) =>
        set((state) => {
          const newLineNotes = { ...state.lineNotes };
          if (note === null || note.trim() === "") {
            delete newLineNotes[lineIndex];
          } else {
            newLineNotes[lineIndex] = note;
          }
          return { lineNotes: newLineNotes };
        }),

      setNotes: (
        threadNote: string | null,
        lineNotes: Record<number, string>
      ) => set({ threadNote, lineNotes }),

      openNotePopover: (lineIndex: number) =>
        set({ noteEditingLineIndex: lineIndex }),

      closeNotePopover: () => set({ noteEditingLineIndex: null }),

      toggleNotesSheet: () =>
        set((state) => ({ notesSheetOpen: !state.notesSheetOpen })),

      setNotesSheetOpen: (open: boolean) => set({ notesSheetOpen: open }),
    }),
    {
      name: "notebook-storage",
      version: 2,
      storage: createJSONStorage(() => threadStorage),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          console.log(
            "[notebookSlice] Migrating from v1 to v2 - clearing old cell-based data"
          );
          return initialState;
        }
        return persistedState as NotebookState;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<NotebookState> | undefined;

        if (!p) {
          return {
            ...current,
            hydrated: true,
            meta: { threadId: null },
          };
        }

        const tid = getActiveThreadId();

        if (tid && p.meta?.threadId && p.meta.threadId !== tid) {
          console.log(
            `[notebookSlice] Thread switch detected: ${p.meta.threadId} → ${tid}. Returning fresh state.`
          );
          return { ...current, hydrated: true, meta: { threadId: tid } };
        }

        return {
          ...current,
          lastEditedLine: p.lastEditedLine ?? current.lastEditedLine,
          showLineNumbers: p.showLineNumbers ?? current.showLineNumbers,
          fontSize: p.fontSize ?? current.fontSize,
          hydrated: true,
          meta: { threadId: tid ?? p.meta?.threadId ?? null },
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && !state.hydrated) {
          state.hydrated = true;
        }
      },
      partialize: (state) => ({
        meta: state.meta,
        showLineNumbers: state.showLineNumbers,
        fontSize: state.fontSize,
        lastEditedLine: state.lastEditedLine,
      }),
    }
  )
);
