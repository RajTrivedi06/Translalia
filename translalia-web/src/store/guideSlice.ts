"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveThreadId, threadStorage } from "@/lib/threadStorage";

export interface GuideAnswers {
  /**
   * Free-form description supplied by the user. This now captures
   * target language, tone, constraints, and any other preferences.
   */
  translationIntent?: string | null;

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

  // Collected answers saved to Supabase (legacy compatible)
  answers: GuideAnswers;

  // UI state
  isCollapsed: boolean;
  width: number;

  // Actions
  setPoem: (text: string) => void;
  submitPoem: () => void;
  setPreserveFormatting: (preserve: boolean) => void;
  setTranslationZone: (zone: string) => void;
  submitTranslationZone: () => void;
  setTranslationIntent: (intent: string) => void;
  submitTranslationIntent: () => void;
  mergeAnswers: (updates: Partial<GuideAnswers>) => void;
  toggleCollapse: () => void;
  setWidth: (width: number) => void;
  reset: () => void;
}

const initialState: Pick<
  GuideState,
  | "currentStep"
  | "poem"
  | "translationIntent"
  | "translationZone"
  | "answers"
  | "isCollapsed"
  | "width"
> = {
  currentStep: "setup",
  poem: {
    text: "",
    isSubmitted: false,
    preserveFormatting: true,
  },
  translationIntent: {
    text: null,
    isSubmitted: false,
  },
  translationZone: {
    text: "",
    isSubmitted: false,
  },
  answers: {},
  isCollapsed: false,
  width: 320,
};

function normalizeLegacyStep(step: any): GuideStep {
  if (step === "complete") return "ready";
  if (step === "ready") return "ready";
  return "setup";
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set) => ({
      hydrated: false,
      meta: { threadId: getActiveThreadId() },
      ...initialState,

      setPoem: (text: string) =>
        set((state) => ({
          poem: { ...state.poem, text },
          meta: { threadId: getActiveThreadId() },
        })),

      submitPoem: () =>
        set((state) => ({
          poem: { ...state.poem, isSubmitted: true },
        })),

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
    }),
    {
      name: "guide-storage",
      version: 2,
      storage: createJSONStorage(() => threadStorage),
      merge: (persisted, current) => {
        const tid = getActiveThreadId();
        const p = persisted as any;

        if (!p || !tid) {
          return {
            ...current,
            hydrated: true,
            meta: { threadId: tid ?? null },
          };
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

        return {
          ...current,
          ...p,
          hydrated: true,
          meta: { threadId: tid },
          currentStep: normalizeLegacyStep(p.currentStep),
          poem: {
            text: p.poem?.text ?? current.poem.text ?? "",
            isSubmitted: p.poem?.isSubmitted ?? current.poem.isSubmitted,
            preserveFormatting: p.poem?.preserveFormatting ?? false,
          },
          translationZone: {
            text: p.translationZone?.text ?? current.translationZone.text ?? "",
            isSubmitted:
              p.translationZone?.isSubmitted ?? current.translationZone.isSubmitted,
          },
          translationIntent: {
            text: legacyIntent,
            isSubmitted: legacyIntentSubmitted && !!legacyIntent,
          },
          answers: {
            ...(p.answers || {}),
            translationIntent: legacyIntent,
          },
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
        translationZone: state.translationZone,
        answers: state.answers,
      }),
    }
  )
);
