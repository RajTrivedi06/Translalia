"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";
import type { LineTranslationResponse } from "@/types/lineTranslation";

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

  // Generated options for current line (old per-word workflow) - DEPRECATED, use wordOptionsCache
  wordOptions: WordOption[] | null;

  // Per-line cache of word options (lineIndex -> WordOption[])
  // This prevents re-fetching when switching between lines
  wordOptionsCache: Record<number, WordOption[]>;

  // User selections for current line (position -> selected word) (old workflow)
  selections: Record<number, string>;

  // Line-level translations (new workflow) - lineIndex -> LineTranslationResponse
  lineTranslations: Record<number, LineTranslationResponse | null>;

  // Selected variant for each line (lineIndex -> variant 1|2|3)
  selectedVariant: Record<number, 1 | 2 | 3 | null>;

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
  setWordOptionsForLine: (lineIndex: number, options: WordOption[]) => void;
  selectWord: (position: number, word: string) => void;
  deselectWord: (position: number) => void;
  clearSelections: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsApplying: (isApplying: boolean) => void;
  setPoemLines: (lines: string[]) => void;
  setCompletedLine: (index: number, translation: string) => void;
  setCompletedLines: (lines: Record<number, string>) => void;
  // New line translation actions
  setLineTranslation: (
    lineIndex: number,
    translation: LineTranslationResponse | null
  ) => void;
  selectVariant: (lineIndex: number, variant: 1 | 2 | 3 | null) => void;
  clearLineTranslation: (lineIndex: number) => void;
  reset: () => void;
}

const initialState = {
  selectedLineIndex: null,
  wordOptions: null,
  wordOptionsCache: {},
  selections: {},
  isGenerating: false,
  isApplying: false,
  poemLines: [],
  completedLines: {},
  modelUsed: null,
  lineTranslations: {},
  selectedVariant: {},
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
          // DON'T reset wordOptions here - they persist per line in state
          // This was causing the "Generating..." buffer when switching to ready lines
          // The wordOptions will be managed by WordGrid based on the current line's state
          selections: {},
          // Don't clear line translations - they persist
        }),

      deselectLine: () =>
        set({
          selectedLineIndex: null,
          wordOptions: null,
          selections: {},
          // Don't clear line translations - they persist
        }),

      setWordOptions: (options: WordOption[] | null) =>
        set({
          wordOptions: options,
          isGenerating: false,
        }),

      setWordOptionsForLine: (lineIndex: number, options: WordOption[]) =>
        set((state) => ({
          wordOptionsCache: {
            ...state.wordOptionsCache,
            [lineIndex]: options,
          },
          // Also set the global wordOptions for backward compatibility
          wordOptions: options,
          isGenerating: false,
        })),

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

      setLineTranslation: (
        lineIndex: number,
        translation: LineTranslationResponse | null
      ) =>
        set((state) => ({
          lineTranslations: {
            ...state.lineTranslations,
            [lineIndex]: translation,
          },
        })),

      selectVariant: (lineIndex: number, variant: 1 | 2 | 3 | null) =>
        set((state) => ({
          selectedVariant: {
            ...state.selectedVariant,
            [lineIndex]: variant,
          },
        })),

      clearLineTranslation: (lineIndex: number) =>
        set((state) => {
          const { [lineIndex]: _, ...restTranslations } =
            state.lineTranslations;
          const { [lineIndex]: __, ...restVariants } = state.selectedVariant;
          return {
            lineTranslations: restTranslations,
            selectedVariant: restVariants,
          };
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
        lineTranslations: state.lineTranslations,
        selectedVariant: state.selectedVariant,
      }),
    }
  )
);
