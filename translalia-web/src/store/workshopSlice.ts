"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";
import type { LineTranslationResponse } from "@/types/lineTranslation";

export interface WorkshopState {
  // Hydration flag
  hydrated: boolean;
  // Thread metadata
  meta: { threadId: string | null };

  // Active line (renamed from selectedLineIndex for consistency)
  currentLineIndex: number | null;

  // Line-level translations (new workflow) - lineIndex -> LineTranslationResponse
  lineTranslations: Record<number, LineTranslationResponse | null>;

  // Selected variant for each line (lineIndex -> variant 1|2|3)
  selectedVariant: Record<number, 1 | 2 | 3 | null>;

  // UI state
  isApplying: boolean;

  // Poem lines (from Guide Rail)
  poemLines: string[];

  // Completed/finalized translations (lineIndex -> translated line)
  completedLines: Record<number, string>;

  /**
   * UNIFIED draft system (lineIndex -> draft translation text).
   * Single source of truth for all work-in-progress translations.
   * Replaces: notebookSlice.draftTranslations + workshopSlice.studioDraftLines
   */
  draftLines: Record<number, string>;

  // AI model used for current generation
  modelUsed: string | null;

  // Actions
  selectLine: (index: number) => void;
  setCurrentLineIndex: (index: number | null) => void;
  deselectLine: () => void;
  setIsApplying: (isApplying: boolean) => void;
  setPoemLines: (lines: string[]) => void;
  setCompletedLine: (index: number, translation: string) => void;
  setCompletedLines: (lines: Record<number, string>) => void;
  setDraft: (index: number, translation: string) => void;
  setDraftLines: (lines: Record<number, string>) => void;
  appendToDraft: (lineIndex: number, text: string) => void;
  clearDraft: (lineIndex: number) => void;
  getDisplayText: (lineIndex: number) => string;
  // Line translation actions
  setLineTranslation: (
    lineIndex: number,
    translation: LineTranslationResponse | null
  ) => void;
  selectVariant: (lineIndex: number, variant: 1 | 2 | 3 | null) => void;
  clearLineTranslation: (lineIndex: number) => void;
  reset: () => void;
  resetToDefaults: () => void;
  setThreadId: (threadId: string | null) => void;
}

const initialState = {
  currentLineIndex: null,
  isApplying: false,
  poemLines: [],
  completedLines: {},
  draftLines: {},
  modelUsed: null,
  lineTranslations: {},
  selectedVariant: {},
};

export const useWorkshopStore = create<WorkshopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: null }, // ✅ Safe default - will be set by component
      ...initialState,

      selectLine: (index: number) =>
        set({
          currentLineIndex: index,
          // Don't clear line translations/variants - they persist per line
        }),

      setCurrentLineIndex: (index: number | null) =>
        set({
          currentLineIndex: index,
        }),

      deselectLine: () =>
        set({
          currentLineIndex: null,
          // Don't clear line translations - they persist
        }),

      setIsApplying: (isApplying: boolean) => set({ isApplying }),

      setPoemLines: (lines: string[]) =>
        set({
          poemLines: lines,
          meta: { threadId: getActiveThreadId() },
        }),

      setCompletedLine: (index: number, translation: string) =>
        set((state) => {
          // Clear draft when completing a line
          const { [index]: _, ...remainingDrafts } = state.draftLines;
          return {
            completedLines: {
              ...state.completedLines,
              [index]: translation,
            },
            draftLines: remainingDrafts,
          };
        }),

      setCompletedLines: (lines: Record<number, string>) =>
        set((state) => {
          // Clear drafts for lines that are being set as completed
          // This ensures green tick appears instead of yellow label
          const savedLineIndices = new Set(Object.keys(lines).map(Number));
          const remainingDrafts = Object.fromEntries(
            Object.entries(state.draftLines).filter(
              ([key]) => !savedLineIndices.has(Number(key))
            )
          );
          return {
            completedLines: lines,
            draftLines: remainingDrafts,
          };
        }),

      setDraft: (index: number, translation: string) =>
        set((state) => ({
          draftLines: {
            ...state.draftLines,
            [index]: translation,
          },
        })),

      setDraftLines: (lines: Record<number, string>) =>
        set({
          draftLines: lines,
        }),

      appendToDraft: (lineIndex: number, text: string) => {
        const state = get();
        const current = state.draftLines[lineIndex] ?? state.completedLines[lineIndex] ?? "";
        const separator = current.trim() ? " " : "";
        set({
          draftLines: {
            ...state.draftLines,
            [lineIndex]: current + separator + text,
          },
        });
      },

      clearDraft: (lineIndex: number) =>
        set((state) => {
          const { [lineIndex]: _, ...rest } = state.draftLines;
          return { draftLines: rest };
        }),

      getDisplayText: (lineIndex: number) => {
        const state = get();
        return state.draftLines[lineIndex] ?? state.completedLines[lineIndex] ?? "";
      },

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
          const nextTranslations = { ...state.lineTranslations };
          const nextVariants = { ...state.selectedVariant };
          delete nextTranslations[lineIndex];
          delete nextVariants[lineIndex];
          return {
            lineTranslations: nextTranslations,
            selectedVariant: nextVariants,
          };
        }),

      reset: () =>
        set({ ...initialState, meta: { threadId: getActiveThreadId() } }),

      // Add method to update thread ID after mount
      setThreadId: (threadId: string | null) => {
        set((state) => ({
          meta: { ...state.meta, threadId },
        }));
      },

      // ADD THIS NEW METHOD: Reset to defaults for new thread
      resetToDefaults: () => {
        const tid = getActiveThreadId();
        set({
          ...initialState,
          hydrated: true,
          meta: { threadId: tid },
        });
      },
    }),
    {
      name: "workshop-storage",
      version: 2,
      storage: createJSONStorage(() => threadStorage),
      // If the persisted payload is for a different thread, ignore it
      merge: (persisted, current) => {
        const p = persisted as Partial<WorkshopState> | undefined;

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
            `[workshopSlice] Thread switch detected: ${p.meta.threadId} → ${tid}. Returning fresh state.`
          );
          return { ...current, hydrated: true, meta: { threadId: tid } };
        }

        // Restore persisted state with migration support
        // Support both new (currentLineIndex) and old (selectedLineIndex) field names
        const pWithMigration = p as Partial<WorkshopState> & { selectedLineIndex?: number | null; studioDraftLines?: Record<number, string> };
        const persistedCurrentLineIndex = pWithMigration.currentLineIndex ?? pWithMigration.selectedLineIndex;
        const persistedDraftLines = pWithMigration.draftLines ?? pWithMigration.studioDraftLines ?? {};

        return {
          ...current,
          currentLineIndex:
            typeof persistedCurrentLineIndex === "number" ||
            persistedCurrentLineIndex === null
              ? persistedCurrentLineIndex
              : current.currentLineIndex,
          poemLines: Array.isArray(p.poemLines)
            ? p.poemLines
            : current.poemLines,
          completedLines: p.completedLines ?? current.completedLines,
          draftLines: persistedDraftLines,
          modelUsed:
            typeof p.modelUsed === "string" || p.modelUsed === null
              ? p.modelUsed
              : current.modelUsed,
          lineTranslations: p.lineTranslations ?? current.lineTranslations,
          selectedVariant: p.selectedVariant ?? current.selectedVariant,
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
        poemLines: state.poemLines,
        completedLines: state.completedLines,
        draftLines: state.draftLines,
        modelUsed: state.modelUsed,
        currentLineIndex: state.currentLineIndex,
        lineTranslations: state.lineTranslations,
        selectedVariant: state.selectedVariant,
      }),
    }
  )
);
