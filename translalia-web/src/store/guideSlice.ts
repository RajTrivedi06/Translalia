"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";
import {
  splitPoemIntoStanzas,
  type SimplePoemStanzas,
} from "@/lib/utils/stanzaUtils";
import { customSegmentationToStanzas } from "@/lib/utils/customSegmentationToStanzas";

export interface GuideAnswers {
  /**
   * Free-form description supplied by the user. This now captures
   * target language, tone, constraints, and any other preferences.
   */
  translationIntent?: string | null;

  /**
   * Optional: user-described source language variety/dialect/register.
   * Examples: "Scouse English", "Garhwali", "Brazilian Portuguese".
   */
  sourceLanguageVariety?: string | null;

  /**
   * Viewpoint range mode for prismatic variants.
   * - focused: tight, high relevance
   * - balanced: default, best overall
   * - adventurous: wide range, still guarded
   */
  viewpointRangeMode?: "focused" | "balanced" | "adventurous";

  /**
   * Translation model selection for processing.
   * Allows users to choose which OpenAI model to use for translation.
   */
  translationModel?:
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-5"
    | "gpt-5-mini";

  /**
   * Translation method selection.
   * - method-1: P1 Literalness Spectrum (legacy, kept for backward compatibility)
   * - method-2: P6-P8 Recipe-Driven Prismatic Variants (default)
   */
  translationMethod?: "method-1" | "method-2";

  /**
   * Legacy structured fields are kept optional so previously saved
   * projects keep loading without errors. New flows won't populate these.
   */
  targetLanguage?: { lang: string; variety: string; script: string };
  audience?: { audience: string; goal: string[] };
  stance?: { closeness: "close" | "in_between" | "natural" };
  style?: { vibes: string[] };
  translanguaging?: { allow: boolean; scopes: string[] };
  policy?: { must_keep: string[]; no_go: string[] };
  form?: { line_breaks: string; rhyme: string; line_length: string };
  style_anchors?: string[];
  translationZone?: string | null;
}

export type GuideStep = "setup" | "ready";

export interface GuideState {
  // Hydration flag
  hydrated: boolean;
  // Thread metadata
  meta: { threadId: string | null };

  // Current step in the guide
  currentStep: GuideStep;

  // Poem data
  poem: {
    text: string;
    isSubmitted: boolean;
    preserveFormatting: boolean;
    stanzas: SimplePoemStanzas | null;
    customSegmentation: {
      lineToSegment: Record<number, number>; // Map of line index -> segment number (1-indexed)
      totalSegments: number;
    } | null;
  };

  // Translation intent (free-form instructions)
  translationIntent: {
    text: string | null;
    isSubmitted: boolean;
  };
  // Translation zone (structured input)
  translationZone: {
    text: string;
    isSubmitted: boolean;
  };

  // Source language variety (optional)
  sourceLanguageVariety: {
    text: string | null;
    isSubmitted: boolean;
  };

  // Collected answers saved to Supabase (legacy compatible)
  answers: GuideAnswers;

  // UI state
  isCollapsed: boolean;
  width: number;
  isWorkshopUnlocked: boolean;

  // Viewpoint range mode for prismatic variants
  viewpointRangeMode: "focused" | "balanced" | "adventurous";
  // Translation model selection
  translationModel:
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-5"
    | "gpt-5-mini";
  // Translation method selection (experimental)
  translationMethod: "method-1" | "method-2";

  // Actions
  setPoem: (text: string) => void;
  submitPoem: () => void;
  getPoemStanzas: () => SimplePoemStanzas | null;
  setCustomSegmentation: (
    segmentation: {
      lineToSegment: Record<number, number>;
      totalSegments: number;
    } | null
  ) => void;
  setPreserveFormatting: (preserve: boolean) => void;
  setSourceLanguageVariety: (value: string) => void;
  submitSourceLanguageVariety: () => void;
  editSourceLanguageVariety: () => void;
  setTranslationZone: (zone: string) => void;
  submitTranslationZone: () => void;
  setTranslationIntent: (intent: string) => void;
  submitTranslationIntent: () => void;
  setViewpointRangeMode: (mode: "focused" | "balanced" | "adventurous") => void;
  setTranslationModel: (
    model: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-5" | "gpt-5-mini"
  ) => void;
  setTranslationMethod: (method: "method-1" | "method-2") => void;
  mergeAnswers: (updates: Partial<GuideAnswers>) => void;
  toggleCollapse: () => void;
  setWidth: (width: number) => void;
  reset: () => void;
  checkGuideComplete: () => boolean;
  unlockWorkshop: () => void;
  resetToDefaults: () => void;
  setThreadId: (threadId: string | null) => void;
}

const initialState: Pick<
  GuideState,
  | "currentStep"
  | "poem"
  | "translationIntent"
  | "translationZone"
  | "sourceLanguageVariety"
  | "answers"
  | "isCollapsed"
  | "width"
  | "isWorkshopUnlocked"
  | "viewpointRangeMode"
  | "translationModel"
  | "translationMethod"
> = {
  currentStep: "setup",
  poem: {
    text: "",
    isSubmitted: false,
    preserveFormatting: true,
    stanzas: null,
    customSegmentation: null,
  },
  translationIntent: {
    text: null,
    isSubmitted: false,
  },
  sourceLanguageVariety: {
    text: null,
    isSubmitted: false,
  },
  translationZone: {
    text: "",
    isSubmitted: false,
  },
  answers: { sourceLanguageVariety: null },
  isCollapsed: false,
  width: 320,
  isWorkshopUnlocked: false,
  viewpointRangeMode: "balanced",
  translationModel: "gpt-4o",
  translationMethod: "method-2",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLegacyStep(step: any): GuideStep {
  if (step === "complete") return "ready";
  if (step === "ready") return "ready";
  return "setup";
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      meta: { threadId: null }, // ✅ Safe default - will be set by component
      ...initialState,

      setPoem: (text: string) => {
        const state = get();
        let stanzas: SimplePoemStanzas;

        // Use custom segmentation if available, otherwise use default 4-lines-per-segment
        if (state.poem.customSegmentation) {
          const poemLines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          const lineToSegmentMap = new Map(
            Object.entries(state.poem.customSegmentation.lineToSegment).map(
              ([k, v]) => [Number(k), v]
            )
          );

          stanzas = customSegmentationToStanzas(poemLines, {
            lineToSegment: lineToSegmentMap,
            totalSegments: state.poem.customSegmentation.totalSegments,
          });
        } else {
          // Default: 4 lines per segment
          stanzas = splitPoemIntoStanzas(text);
        }

        set((state) => ({
          poem: {
            ...state.poem,
            text,
            stanzas,
          },
          meta: { threadId: getActiveThreadId() },
        }));
      },

      submitPoem: () =>
        set((state) => ({
          poem: { ...state.poem, isSubmitted: true },
        })),

      getPoemStanzas: () => {
        return get().poem.stanzas;
      },

      setCustomSegmentation: (segmentation) =>
        set((state) => {
          // If segmentation is provided, regenerate stanzas
          let stanzas = state.poem.stanzas;
          if (segmentation && state.poem.text) {
            const poemLines = state.poem.text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

            const lineToSegmentMap = new Map(
              Object.entries(segmentation.lineToSegment).map(([k, v]) => [
                Number(k),
                v,
              ])
            );

            stanzas = customSegmentationToStanzas(poemLines, {
              lineToSegment: lineToSegmentMap,
              totalSegments: segmentation.totalSegments,
            });
          }

          return {
            poem: {
              ...state.poem,
              customSegmentation: segmentation,
              stanzas,
            },
            meta: { threadId: getActiveThreadId() },
          };
        }),

      setPreserveFormatting: (preserve: boolean) =>
        set((state) => ({
          poem: { ...state.poem, preserveFormatting: preserve },
          meta: { threadId: getActiveThreadId() },
        })),

      setTranslationIntent: (intent: string) =>
        set((state) => ({
          currentStep: "setup",
          translationIntent: {
            text: intent,
            isSubmitted: false,
          },
          answers: {
            ...state.answers,
            translationIntent: intent,
          },
        })),

      setSourceLanguageVariety: (value: string) =>
        set((state) => ({
          currentStep: "setup",
          sourceLanguageVariety: {
            text: value,
            isSubmitted: false,
          },
          answers: {
            ...state.answers,
            sourceLanguageVariety: value,
          },
          meta: { threadId: getActiveThreadId() },
        })),

      submitSourceLanguageVariety: () =>
        set((state) => ({
          sourceLanguageVariety: {
            ...state.sourceLanguageVariety,
            isSubmitted: true,
          },
        })),

      editSourceLanguageVariety: () =>
        set((state) => ({
          sourceLanguageVariety: {
            ...state.sourceLanguageVariety,
            isSubmitted: false,
          },
        })),

      setTranslationZone: (zone: string) =>
        set((state) => ({
          currentStep: "setup",
          translationZone: {
            text: zone,
            isSubmitted: false,
          },
          answers: {
            ...state.answers,
            translationZone: zone,
          },
          meta: { threadId: getActiveThreadId() },
        })),

      submitTranslationZone: () =>
        set((state) => ({
          translationZone: {
            ...state.translationZone,
            isSubmitted: true,
          },
        })),

      submitTranslationIntent: () =>
        set((state) => ({
          currentStep: "ready",
          translationIntent: {
            ...state.translationIntent,
            isSubmitted: !!state.translationIntent.text,
          },
          answers: {
            ...state.answers,
            translationIntent: state.translationIntent.text,
          },
        })),

      setViewpointRangeMode: (mode: "focused" | "balanced" | "adventurous") =>
        set((state) => ({
          viewpointRangeMode: mode,
          answers: {
            ...state.answers,
            viewpointRangeMode: mode,
          },
        })),

      setTranslationModel: (
        model: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-5" | "gpt-5-mini"
      ) =>
        set((state) => ({
          translationModel: model,
          answers: {
            ...state.answers,
            translationModel: model,
          },
        })),

      setTranslationMethod: (method: "method-1" | "method-2") =>
        set((state) => ({
          translationMethod: method,
          answers: {
            ...state.answers,
            translationMethod: method,
          },
        })),

      mergeAnswers: (updates: Partial<GuideAnswers>) =>
        set((state) => {
          const incomingIntent =
            updates.translationIntent !== undefined
              ? updates.translationIntent
              : state.translationIntent.text;

          const isIntentSubmitted =
            updates.translationIntent !== undefined
              ? !!updates.translationIntent
              : state.translationIntent.isSubmitted;

          return {
            answers: {
              ...state.answers,
              ...updates,
            },
            translationIntent: {
              text: incomingIntent ?? null,
              isSubmitted: isIntentSubmitted,
            },
            currentStep:
              isIntentSubmitted && (state.poem.isSubmitted || incomingIntent)
                ? "ready"
                : state.currentStep,
          };
        }),

      toggleCollapse: () =>
        set((state) => ({
          isCollapsed: !state.isCollapsed,
        })),

      setWidth: (width: number) => set({ width }),

      reset: () =>
        set({
          ...initialState,
          meta: { threadId: getActiveThreadId() },
        }),

      checkGuideComplete: () => {
        const state = get();

        const hasPoem = state.poem.text.trim().length > 0;
        const hasTranslationZone = state.translationZone.text.trim().length > 0;
        const hasTranslationIntent =
          (state.translationIntent.text?.trim().length ?? 0) > 0;

        // If method-2 is selected, viewpointRangeMode is mandatory
        const hasViewpointRange =
          state.translationMethod !== "method-2" || !!state.viewpointRangeMode;

        return (
          hasPoem &&
          hasTranslationZone &&
          hasTranslationIntent &&
          hasViewpointRange
        );
      },

      unlockWorkshop: () =>
        set({
          isWorkshopUnlocked: true,
        }),

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
      name: "guide-storage",
      version: 2,
      storage: createJSONStorage(() => threadStorage),
      merge: (persisted, current) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = persisted as any;

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

        // CRITICAL: If thread IDs don't match, return fresh state
        // This prevents state leakage between threads
        if (tid && p.meta?.threadId && p.meta.threadId !== tid) {
          console.log(
            `[guideSlice] Thread switch detected: ${p.meta.threadId} → ${tid}. Returning fresh state.`
          );
          return { ...current, hydrated: true, meta: { threadId: tid } };
        }

        const legacyIntent =
          p.translationIntent?.text ??
          p.translationIntent ??
          p.translationDescription ??
          p.answers?.translationIntent ??
          null;

        const legacyIntentSubmitted =
          p.translationIntent?.isSubmitted ??
          (p.currentStep === "complete" || p.currentStep === "ready");

        // Restore persisted state
        return {
          ...current,
          ...p,
          hydrated: true,
          meta: { threadId: tid ?? p.meta?.threadId ?? null },
          currentStep: normalizeLegacyStep(p.currentStep),
          poem: {
            text: p.poem?.text ?? current.poem.text ?? "",
            isSubmitted: p.poem?.isSubmitted ?? current.poem.isSubmitted,
            preserveFormatting: p.poem?.preserveFormatting ?? false,
            stanzas: p.poem?.stanzas
              ? p.poem.stanzas
              : p.poem?.text
              ? splitPoemIntoStanzas(p.poem.text)
              : null,
          },
          translationZone: {
            text: p.translationZone?.text ?? current.translationZone.text ?? "",
            isSubmitted:
              p.translationZone?.isSubmitted ??
              current.translationZone.isSubmitted,
          },
          translationIntent: {
            text: legacyIntent,
            isSubmitted: legacyIntentSubmitted && !!legacyIntent,
          },
          answers: {
            ...(p.answers || {}),
            translationIntent: legacyIntent,
          },
          // Restore UI state if present
          isWorkshopUnlocked:
            p.isWorkshopUnlocked ?? current.isWorkshopUnlocked,
          isCollapsed: p.isCollapsed ?? current.isCollapsed,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && !state.hydrated) {
          state.hydrated = true;
        }
      },
      partialize: (state) => ({
        meta: state.meta,
        currentStep: state.currentStep,
        poem: state.poem,
        translationIntent: state.translationIntent,
        sourceLanguageVariety: state.sourceLanguageVariety,
        translationZone: state.translationZone,
        answers: state.answers,
        // ADD CRITICAL FIELDS:
        isWorkshopUnlocked: state.isWorkshopUnlocked,
        isCollapsed: state.isCollapsed,
      }),
    }
  )
);
