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
  notesExpanded: boolean;
  notesLastSaved: Date | null;

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
  toggleNotesPanel: () => void;
  setNotesExpanded: (expanded: boolean) => void;
  updateNotesLastSaved: () => void;
  setNotes: (
    threadNote: string | null,
    lineNotes: Record<number, string>
  ) => void;
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
  notesExpanded: false,
  notesLastSaved: null,
};

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: null }, // ✅ Safe default - will be set by component
      ...initialState,

      setLastEditedLine: (lineIndex: number | null) =>
        set({ lastEditedLine: lineIndex }),

      updateAutoSaveTimestamp: () => set({ autoSaveTimestamp: new Date() }),

      setFontSize: (size: NotebookFontSize) => set({ fontSize: size }),

      setShowLineNumbers: (show: boolean) => set({ showLineNumbers: show }),

      pushUndo: (lineIndex: number, text: string) =>
        set((state) => ({
          undoStack: [
            ...state.undoStack.slice(-19), // Keep last 20
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

      // Add method to update thread ID after mount
      setThreadId: (threadId: string | null) => {
        set((state) => ({
          meta: { ...state.meta, threadId },
        }));
      },

      // Reset to defaults for new thread
      resetToDefaults: () => {
        const tid = getActiveThreadId();
        set({
          ...initialState,
          hydrated: true,
          meta: { threadId: tid },
        });
      },

      // Notes actions
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

      toggleNotesPanel: () =>
        set((state) => ({ notesExpanded: !state.notesExpanded })),

      setNotesExpanded: (expanded: boolean) => set({ notesExpanded: expanded }),

      updateNotesLastSaved: () => set({ notesLastSaved: new Date() }),

      setNotes: (
        threadNote: string | null,
        lineNotes: Record<number, string>
      ) => set({ threadNote, lineNotes }),
    }),
    {
      name: "notebook-storage",
      version: 2, // Increment version due to breaking changes
      storage: createJSONStorage(() => threadStorage),
      migrate: (persistedState: unknown, version: number) => {
        // Migration from version 1 (old cell-based) to version 2 (simplified)
        // Just return empty state - old data is incompatible
        if (version < 2) {
          console.log(
            "[notebookSlice] Migrating from v1 to v2 - clearing old cell-based data"
          );
          return initialState;
        }
        return persistedState as NotebookState;
      },
      // If the persisted payload is for a different thread, ignore it
      merge: (persisted, current) => {
        const p = persisted as Partial<NotebookState> | undefined;

        // No persisted data - return current
        if (!p) {
          return {
            ...current,
            hydrated: true,
            meta: { threadId: null }, // ✅ Safe default
          };
        }

        // Get thread ID from URL (source of truth)
        const tid = getActiveThreadId();

        // Thread switch detection
        if (tid && p.meta?.threadId && p.meta.threadId !== tid) {
          console.log(
            `[notebookSlice] Thread switch detected: ${p.meta.threadId} → ${tid}. Returning fresh state.`
          );
          return { ...current, hydrated: true, meta: { threadId: tid } };
        }

        // Restore persisted state
        return {
          ...current,
          lastEditedLine: p.lastEditedLine ?? current.lastEditedLine,
          showLineNumbers: p.showLineNumbers ?? current.showLineNumbers,
          fontSize: p.fontSize ?? current.fontSize,
          notesExpanded: p.notesExpanded ?? current.notesExpanded,
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
        notesExpanded: state.notesExpanded,
        // Don't persist undoStack (session-only), sessionStartTime, autoSaveTimestamp
        // Notes are persisted in database, not localStorage
      }),
    }
  )
);
