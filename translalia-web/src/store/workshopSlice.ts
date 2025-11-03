"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";

export interface WordOption {
  original: string;
  position: number;
  options: string[];
  partOfSpeech?:
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "pronoun"
    | "preposition"
    | "conjunction"
    | "article"
    | "interjection"
    | "neutral";
}

export interface WorkshopState {
  // Hydration flag
  hydrated: boolean;
  // Thread metadata
  meta: { threadId: string | null };

  // Active line
  selectedLineIndex: number | null;

  // Generated options for current line
  wordOptions: WordOption[] | null;

  // User selections for current line (position -> selected word)
  selections: Record<number, string>;

  // UI state
  isGenerating: boolean;
  isApplying: boolean;

  // Poem lines (from Guide Rail)
  poemLines: string[];

  // Compiled translations (lineIndex -> translated line)
  completedLines: Record<number, string>;

  // AI model used for current generation
  modelUsed: string | null;

  // Actions
  selectLine: (index: number) => void;
  deselectLine: () => void;
  setWordOptions: (options: WordOption[] | null) => void;
  selectWord: (position: number, word: string) => void;
  deselectWord: (position: number) => void;
  clearSelections: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsApplying: (isApplying: boolean) => void;
  setPoemLines: (lines: string[]) => void;
  setCompletedLine: (index: number, translation: string) => void;
  setCompletedLines: (lines: Record<number, string>) => void;
  reset: () => void;
}

const initialState = {
  selectedLineIndex: null,
  wordOptions: null,
  selections: {},
  isGenerating: false,
  isApplying: false,
  poemLines: [],
  completedLines: {},
  modelUsed: null,
};

export const useWorkshopStore = create<WorkshopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: getActiveThreadId() },
      ...initialState,

      selectLine: (index: number) =>
        set({
          selectedLineIndex: index,
          wordOptions: null,
          selections: {},
        }),

      deselectLine: () =>
        set({
          selectedLineIndex: null,
          wordOptions: null,
          selections: {},
        }),

      setWordOptions: (options: WordOption[] | null) =>
        set({
          wordOptions: options,
          isGenerating: false,
        }),

      selectWord: (position: number, word: string) =>
        set((state) => ({
          selections: {
            ...state.selections,
            [position]: word,
          },
        })),

      deselectWord: (position: number) =>
        set((state) => {
          const { [position]: _, ...rest } = state.selections;
          return { selections: rest };
        }),

      clearSelections: () =>
        set({
          selections: {},
        }),

      setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),

      setIsApplying: (isApplying: boolean) => set({ isApplying }),

      setPoemLines: (lines: string[]) =>
        set({
          poemLines: lines,
          meta: { threadId: getActiveThreadId() },
        }),

      setCompletedLine: (index: number, translation: string) =>
        set((state) => ({
          completedLines: {
            ...state.completedLines,
            [index]: translation,
          },
        })),

      setCompletedLines: (lines: Record<number, string>) =>
        set({
          completedLines: lines,
        }),

      reset: () =>
        set({ ...initialState, meta: { threadId: getActiveThreadId() } }),
    }),
    {
      name: "workshop-storage",
      version: 1,
      storage: createJSONStorage(() => threadStorage),
      // If the persisted payload is for a different thread, ignore it
      merge: (persisted, current) => {
        const tid = getActiveThreadId();
        const p = persisted as WorkshopState;
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
        poemLines: state.poemLines,
        completedLines: state.completedLines,
        modelUsed: state.modelUsed,
        selectedLineIndex: state.selectedLineIndex,
      }),
    }
  )
);
