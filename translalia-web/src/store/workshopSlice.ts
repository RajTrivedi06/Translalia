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

  // Active line
  selectedLineIndex: number | null;

  // Line-level translations (new workflow) - lineIndex -> LineTranslationResponse
  lineTranslations: Record<number, LineTranslationResponse | null>;

  // Selected variant for each line (lineIndex -> variant 1|2|3)
  selectedVariant: Record<number, 1 | 2 | 3 | null>;

  // UI state
  isApplying: boolean;

  // Poem lines (from Guide Rail)
  poemLines: string[];

  // Compiled translations (lineIndex -> translated line)
  completedLines: Record<number, string>;

  /**
   * Translation Studio drafts (lineIndex -> edited translation text).
   * This is intentionally separate from `completedLines` because `completedLines`
   * can be hydrated from background variants, while the Studio should default
   * to showing only confirmed-saved lines.
   */
  studioDraftLines: Record<number, string>;

  // AI model used for current generation
  modelUsed: string | null;

  // Actions
  selectLine: (index: number) => void;
  deselectLine: () => void;
  setIsApplying: (isApplying: boolean) => void;
  setPoemLines: (lines: string[]) => void;
  setCompletedLine: (index: number, translation: string) => void;
  setCompletedLines: (lines: Record<number, string>) => void;
  setStudioDraftLine: (index: number, translation: string) => void;
  setStudioDraftLines: (lines: Record<number, string>) => void;
  // New line translation actions
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
  selectedLineIndex: null,
  isApplying: false,
  poemLines: [],
  completedLines: {},
  studioDraftLines: {},
  modelUsed: null,
  lineTranslations: {},
  selectedVariant: {},
};

export const useWorkshopStore = create<WorkshopState>()(
  persist(
    (set) => ({
      hydrated: false,
      meta: { threadId: null }, // ✅ Safe default - will be set by component
      ...initialState,

      selectLine: (index: number) =>
        set({
          selectedLineIndex: index,
          // Don't clear line translations/variants - they persist per line
        }),

      deselectLine: () =>
        set({
          selectedLineIndex: null,
          // Don't clear line translations - they persist
        }),

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

      setStudioDraftLine: (index: number, translation: string) =>
        set((state) => ({
          studioDraftLines: {
            ...state.studioDraftLines,
            [index]: translation,
          },
        })),

      setStudioDraftLines: (lines: Record<number, string>) =>
        set({
          studioDraftLines: lines,
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

        // Restore persisted state
        return {
          ...current,
          selectedLineIndex:
            typeof p.selectedLineIndex === "number" ||
            p.selectedLineIndex === null
              ? p.selectedLineIndex
              : current.selectedLineIndex,
          poemLines: Array.isArray(p.poemLines)
            ? p.poemLines
            : current.poemLines,
          completedLines: p.completedLines ?? current.completedLines,
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
        studioDraftLines: state.studioDraftLines,
        modelUsed: state.modelUsed,
        selectedLineIndex: state.selectedLineIndex,
        lineTranslations: state.lineTranslations,
        selectedVariant: state.selectedVariant,
      }),
    }
  )
);
