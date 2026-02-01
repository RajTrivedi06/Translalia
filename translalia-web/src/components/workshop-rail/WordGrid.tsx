"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useTranslateLine } from "@/lib/hooks/useTranslateLine";
import { useThreadId } from "@/hooks/useThreadId";
import { useGuideStore } from "@/store/guideSlice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DragData } from "@/types/drag";
import { cn } from "@/lib/utils";
import { Preloader } from "@/components/ui/preloader";
import type { LineTranslationVariant } from "@/types/lineTranslation";
import {
  AdditionalSuggestions,
  type WordSuggestion,
} from "@/components/workshop/AdditionalSuggestions";
import { TokenSuggestionsPopover } from "@/components/workshop/TokenSuggestionsPopover";
import { FullTranslationEditor } from "@/components/notebook/FullTranslationEditor";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";
import { Sparkles } from "lucide-react";

/**
 * Map all suggestion failure reasons to user-friendly messages
 */
function getSuggestionErrorMessage(reason?: string): string {
  switch (reason) {
    case "rate_limited":
      return "You've hit the daily suggestions limit. Try again tomorrow.";
    case "anchors_missing":
      return "Add a draft or choose a variant first.";
    case "thread_not_found":
      return "We couldn't find this thread. Try refreshing the page.";
    case "target_language_missing":
    case "invalid_request":
      return "Set a target language in Let's Get Started.";
    case "internal_error":
      return "Something went wrong on our side. Please try again.";
    case "too_many_invalid":
      return "Too many suggestions were filtered out. Add a draft or pick a variant, then try again.";
    case "english_leakage":
      return "Suggestions couldn't be generated in your target language. Try again.";
    case "invalid_response":
    case "repair_invalid_response":
      return "AI returned unexpected format. Retrying may help.";
    case "too_few_valid":
      return "Couldn't find enough valid suggestions. Try with a longer line or more context.";
    case "repair_failed":
      return "Couldn't repair suggestions. Try with different context.";
    case "non_english_script":
      return "Suggestions contained unexpected characters. Try again.";
    case "generation_failed":
      return "Failed to generate suggestions. Please try again.";
    default:
      return "Couldn't load suggestions. Please try again.";
  }
}

// Part of speech type and color mapping - soft pastels for readability
const POS_COLORS = {
  noun: "bg-sky-50/80 text-sky-700 border-sky-200/80",
  verb: "bg-emerald-50/80 text-emerald-700 border-emerald-200/80",
  adjective: "bg-violet-50/80 text-violet-700 border-violet-200/80",
  adverb: "bg-amber-50/80 text-amber-700 border-amber-200/80",
  pronoun: "bg-rose-50/80 text-rose-700 border-rose-200/80",
  preposition: "bg-lime-50/80 text-lime-700 border-lime-200/80",
  conjunction: "bg-indigo-50/80 text-indigo-700 border-indigo-200/80",
  article: "bg-stone-50/80 text-stone-600 border-stone-200/80",
  interjection: "bg-red-50/80 text-error border-red-200/80",
  neutral: "bg-muted text-foreground-secondary border-border-subtle",
} as const;

function normalizePartOfSpeechTag(
  tag?: string | null
): keyof typeof POS_COLORS {
  if (!tag) return "neutral";
  const normalized = tag.toLowerCase() as keyof typeof POS_COLORS;
  return normalized in POS_COLORS ? normalized : "neutral";
}

function determineStanzaIndex(lineIndex: number, allLines: string[]): number {
  // Heuristic: empty lines separate stanzas
  let stanzaIndex = 0;
  for (let i = 0; i < lineIndex; i++) {
    if ((allLines[i] ?? "").trim() === "") {
      stanzaIndex++;
    }
  }
  return stanzaIndex;
}

function buildLineContextForIndex(lineIndex: number, allLines: string[]) {
  return {
    fullPoem: allLines.join("\n"),
    prevLine: lineIndex > 0 ? (allLines[lineIndex - 1] ?? "").trimEnd() : null,
    nextLine:
      lineIndex < allLines.length - 1
        ? (allLines[lineIndex + 1] ?? "").trimEnd()
        : null,
    stanzaIndex: determineStanzaIndex(lineIndex, allLines),
    position: {
      isFirst: lineIndex === 0,
      isLast: lineIndex === allLines.length - 1,
      isOnly: allLines.length === 1,
    },
  };
}

function DraggableSourceWord({
  word,
  index,
  lineNumber,
  onSuggest,
}: {
  word: string;
  index: number;
  lineNumber: number;
  onSuggest?: (payload: {
    word: string;
    originalWord: string;
    partOfSpeech: string;
    position: number;
    sourceType: "source";
  }) => void;
}) {
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);
  const [clicked, setClicked] = React.useState(false);
  const justDraggedRef = React.useRef(false);
  const longPressRef = React.useRef<number | null>(null);

  const dragData: DragData = {
    id: `source-${lineNumber}-${index}`,
    text: word,
    originalWord: word,
    sourceLineNumber: lineNumber,
    position: index,
    dragType: "sourceWord",
    partOfSpeech: "neutral",
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragData.id,
      data: dragData,
    });

  React.useEffect(() => {
    if (isDragging) justDraggedRef.current = true;
  }, [isDragging]);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      data-draggable="true"
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "px-3 py-1.5 bg-accent-light/30 border border-accent/30 rounded-md text-sm font-medium",
        "cursor-pointer hover:bg-accent-light/50 hover:border-accent/50 transition-all duration-fast",
        "select-none touch-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        isDragging && "opacity-40 cursor-grabbing",
        clicked && "scale-[1.03] ring-2 ring-success/40"
      )}
      role="button"
      tabIndex={0}
      aria-label={`Add "${word}" to notebook`}
      onPointerDown={() => {
        // Reset so a normal click isn't blocked by a prior drag.
        justDraggedRef.current = false;
        if (longPressRef.current) clearTimeout(longPressRef.current);
        longPressRef.current = window.setTimeout(() => {
          if (onSuggest) {
            onSuggest({
              word,
              originalWord: word,
              partOfSpeech: "neutral",
              position: index,
              sourceType: "source",
            });
          }
        }, 450);
      }}
      onPointerUp={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
      }}
      onPointerLeave={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
      }}
      onContextMenu={(e) => {
        if (!onSuggest) return;
        e.preventDefault();
        onSuggest({
          word,
          originalWord: word,
          partOfSpeech: "neutral",
          position: index,
          sourceType: "source",
        });
      }}
      onClick={(e) => {
        e.stopPropagation();
        // If the user just dragged, browsers can fire a click on mouseup—ignore once.
        if (justDraggedRef.current) {
          justDraggedRef.current = false;
          return;
        }
        const targetLine = dragData.sourceLineNumber ?? currentLineIndex ?? 0;
        if (targetLine !== currentLineIndex) {
          setCurrentLineIndex(targetLine);
        }
        appendToDraft(targetLine, dragData.text);
        setClicked(true);
        window.setTimeout(() => setClicked(false), 250);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const targetLine = dragData.sourceLineNumber ?? currentLineIndex ?? 0;
          if (targetLine !== currentLineIndex) {
            setCurrentLineIndex(targetLine);
          }
          appendToDraft(targetLine, dragData.text);
          setClicked(true);
          window.setTimeout(() => setClicked(false), 250);
        }
      }}
    >
      {word}
    </div>
  );
}

interface WordGridProps {
  threadId?: string;
  lineContext?: {
    prevLine?: string;
    nextLine?: string;
    stanzaIndex?: number;
    fullPoem?: string;
  } | null;
}

export function WordGrid({ threadId: pThreadId, lineContext }: WordGridProps) {
  const threadHook = useThreadId();
  const thread = pThreadId || threadHook || undefined;
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const modelUsed = useWorkshopStore((s) => s.modelUsed);
  const translationIntent = useGuideStore(
    (s) => s.translationIntent.text ?? null
  );
  const targetLanguage = useGuideStore((s) => s.answers.targetLanguage);
  const targetLanguageName = targetLanguage?.lang?.trim() || "";
  const targetLanguageVariety = targetLanguage?.variety?.trim() || "";
  const resolvedTargetLanguage = targetLanguageName
    ? `${targetLanguageName}${targetLanguageVariety ? ` (${targetLanguageVariety})` : ""}`
    : "the target language";
  const userSelectedModel = useGuideStore((s) => s.translationModel);

  const [additionalSuggestions, setAdditionalSuggestions] = React.useState<
    WordSuggestion[]
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const [additionalSuggestionsError, setAdditionalSuggestionsError] =
    React.useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [tokenSuggestions, setTokenSuggestions] = React.useState<
    WordSuggestion[]
  >([]);
  const [isLoadingTokenSuggestions, setIsLoadingTokenSuggestions] =
    React.useState(false);
  const [tokenSuggestionsError, setTokenSuggestionsError] = React.useState<
    string | null
  >(null);
  const [tokenSuggestionsOpen, setTokenSuggestionsOpen] =
    React.useState(false);
  const [tokenFocus, setTokenFocus] = React.useState<{
    word: string;
    originalWord: string;
    partOfSpeech: string;
    position: number;
    sourceType: "variant" | "source";
    variantId?: number;
  } | null>(null);

  // Track in-flight requests to prevent duplicates (React Strict Mode fires effects twice)
  const inFlightRequestRef = React.useRef<string | null>(null);
  const suggestionsAbortRef = React.useRef<AbortController | null>(null);
  const tokenSuggestionsAbortRef = React.useRef<AbortController | null>(null);

  const {
    mutate: translateLine,
    isPending: isTranslatingLine,
    error: translateError,
    cancelCurrentRequest,
  } = useTranslateLine();

  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const setLineTranslation = useWorkshopStore((s) => s.setLineTranslation);
  const selectVariant = useWorkshopStore((s) => s.selectVariant);
  const clearLineTranslation = useWorkshopStore((s) => s.clearLineTranslation);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const completedLines = useWorkshopStore((s) => s.completedLines);

  // State for full editor and congratulations
  const [showFullEditor, setShowFullEditor] = React.useState(false);
  const [showCongratulations, setShowCongratulations] = React.useState(false);

  // Check if all lines are completed
  const allLinesCompleted = React.useMemo(() => {
    if (poemLines.length === 0) return false;
    return poemLines.every((_, idx) => {
      const completed = completedLines[idx];
      return completed && completed.trim().length > 0;
    });
  }, [poemLines, completedLines]);

  const isPending = isTranslatingLine;
  const error = translateError;

  // Derive source words from the raw line (instant, no LLM wait)
  const sourceWords = React.useMemo(() => {
    if (currentLineIndex === null) return [];
    const line = poemLines[currentLineIndex];
    // Guard against undefined line (can happen when store is reset or poemLines is empty)
    if (!line || typeof line !== "string") return [];
    return line.split(/\s+/).filter(Boolean);
  }, [currentLineIndex, poemLines]);

  // Track if regenerate is in progress to avoid effect double-trigger
  const isRegeneratingRef = React.useRef(false);

  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Skip if regenerate is in progress (avoid double-trigger with handleRegenerateWithSelectedModel)
    if (isRegeneratingRef.current) return;

    // Already translated → no fetch (unless model changed)
    const existingTranslation = lineTranslations[currentLineIndex];
    if (existingTranslation) {
      // Check if model matches - if not, we might need to regenerate
      // But don't auto-regenerate, just skip (user must explicitly regenerate)
      return;
    }

    // Dedupe: prevent duplicate in-flight requests (include model in key)
    const requestKey = `${thread}:${currentLineIndex}:${userSelectedModel ?? "default"}`;
    if (inFlightRequestRef.current === requestKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[WordGrid] Duplicate request blocked for line ${currentLineIndex}`
        );
      }
      return;
    }
    inFlightRequestRef.current = requestKey;

    const ctx = buildLineContextForIndex(currentLineIndex, poemLines);
    const fullPoem = lineContext?.fullPoem ?? ctx.fullPoem;

    translateLine(
      {
        threadId: thread,
        lineIndex: currentLineIndex,
        lineText,
        fullPoem,
        stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
        prevLine: (lineContext?.prevLine ?? ctx.prevLine) || undefined,
        nextLine: (lineContext?.nextLine ?? ctx.nextLine) || undefined,
        // Pass model override from client to ensure we use the currently selected model
        modelOverride: userSelectedModel || undefined,
      },
      {
        onSuccess: (data) => {
          // Only update if this is still the current request (not cancelled)
          const currentKey = `${thread}:${currentLineIndex}:${userSelectedModel ?? "default"}`;
          if (inFlightRequestRef.current === currentKey) {
            setLineTranslation(currentLineIndex, data);
            useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
            inFlightRequestRef.current = null;
          }
        },
        onError: (err) => {
          // Only clear if this is still the current request and not aborted
          if (err instanceof Error && err.name === "AbortError") {
            // Request was cancelled, don't clear ref
            return;
          }
          inFlightRequestRef.current = null;
        },
      }
    );
  }, [
    currentLineIndex,
    thread,
    poemLines,
    lineTranslations,
    lineContext,
    translateLine,
    setLineTranslation,
    userSelectedModel,
  ]);

  // Get current line translation if available
  const currentLineTranslation =
    currentLineIndex !== null ? lineTranslations[currentLineIndex] : null;
  const currentSelectedVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;
  const badgeModelUsed = currentLineTranslation?.modelUsed ?? modelUsed;

  // Regression guard: warn if displayed translation model differs from user selection (dev only)
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if (
        currentLineTranslation?.modelUsed &&
        userSelectedModel &&
        currentLineTranslation.modelUsed !== userSelectedModel
      ) {
        console.warn(
          `[WordGrid] Model mismatch: displaying translation from "${currentLineTranslation.modelUsed}" ` +
            `but user selected "${userSelectedModel}". Line ${currentLineIndex} may need regeneration.`
        );
      }
    }
  }, [currentLineTranslation?.modelUsed, userSelectedModel, currentLineIndex]);

  // Detect model mismatch for UI
  const hasModelMismatch =
    currentLineTranslation?.modelUsed &&
    userSelectedModel &&
    currentLineTranslation.modelUsed !== userSelectedModel;

  // Handler to regenerate translation with currently selected model
  const handleRegenerateWithSelectedModel = React.useCallback(() => {
    if (currentLineIndex === null || !thread) return;

    // Cancel any in-flight request first
    cancelCurrentRequest();
    
    // Set flag to prevent effect from double-triggering
    isRegeneratingRef.current = true;
    setIsRegenerating(true);
    
    // Clear cached translation to force refetch
    clearLineTranslation(currentLineIndex);
    
    // Clear the in-flight request key so the new request can proceed
    inFlightRequestRef.current = null;

    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") {
      isRegeneratingRef.current = false;
      setIsRegenerating(false);
      return;
    }

    const ctx = buildLineContextForIndex(currentLineIndex, poemLines);
    const fullPoem = lineContext?.fullPoem ?? ctx.fullPoem;
    
    // Set new request key with model
    const requestKey = `${thread}:${currentLineIndex}:${userSelectedModel ?? "default"}`;
    inFlightRequestRef.current = requestKey;

    translateLine(
      {
        threadId: thread,
        lineIndex: currentLineIndex,
        lineText,
        fullPoem,
        stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
        prevLine: (lineContext?.prevLine ?? ctx.prevLine) || undefined,
        nextLine: (lineContext?.nextLine ?? ctx.nextLine) || undefined,
        // Pass model override from client to ensure we use the currently selected model
        modelOverride: userSelectedModel || undefined,
      },
      {
        onSuccess: (data) => {
          // Only update if model matches what we requested
          if (userSelectedModel && data.modelUsed && data.modelUsed !== userSelectedModel) {
            console.warn(
              `[WordGrid] Regenerate received different model: requested "${userSelectedModel}", got "${data.modelUsed}"`
            );
          }
          setLineTranslation(currentLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
          isRegeneratingRef.current = false;
          setIsRegenerating(false);
          inFlightRequestRef.current = null;
        },
        onError: (err) => {
          // Don't reset state if request was aborted (user switched models again)
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          isRegeneratingRef.current = false;
          setIsRegenerating(false);
          inFlightRequestRef.current = null;
        },
      }
    );
  }, [
    currentLineIndex,
    thread,
    poemLines,
    lineContext,
    translateLine,
    setLineTranslation,
    clearLineTranslation,
    cancelCurrentRequest,
    userSelectedModel,
  ]);

  // Clear suggestions and cancel requests when switching lines
  React.useEffect(() => {
    setAdditionalSuggestions([]);
    setIsLoadingSuggestions(false);
    setAdditionalSuggestionsError(null);
    suggestionsAbortRef.current?.abort();
    tokenSuggestionsAbortRef.current?.abort();
    setTokenSuggestions([]);
    setIsLoadingTokenSuggestions(false);
    setTokenSuggestionsOpen(false);
    // Cancel any in-flight translation request when switching lines
    cancelCurrentRequest();
    inFlightRequestRef.current = null;
  }, [currentLineIndex, cancelCurrentRequest]);

  const generateAdditionalSuggestions = React.useCallback(
    async (userGuidance?: string) => {
      if (!thread || currentLineIndex === null) return;

      const currentDraft = draftLines[currentLineIndex] || "";
      const variantFullTexts = currentLineTranslation
        ? currentLineTranslation.translations.reduce(
            (acc, variant) => {
              if (variant.variant === 1) acc.A = variant.fullText;
              if (variant.variant === 2) acc.B = variant.fullText;
              if (variant.variant === 3) acc.C = variant.fullText;
              return acc;
            },
            { A: "", B: "", C: "" }
          )
        : { A: "", B: "", C: "" };
      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      setIsLoadingSuggestions(true);
      setAdditionalSuggestionsError(null);
      try {
        const response = await fetch("/api/workshop/line-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: thread,
            lineIndex: currentLineIndex,
            currentLine: poemLines[currentLineIndex],
            sourceLine: poemLines[currentLineIndex],
            previousLine:
              currentLineIndex > 0 ? poemLines[currentLineIndex - 1] : null,
            nextLine:
              currentLineIndex < poemLines.length - 1
                ? poemLines[currentLineIndex + 1]
                : null,
            fullPoem: poemLines.join("\n"),
            poemTheme: translationIntent || undefined,
            userGuidance: userGuidance || null,
            targetLanguage: resolvedTargetLanguage,
            targetLineDraft: currentDraft || null,
            variantFullTexts,
            selectedVariant: currentSelectedVariant ?? null,
          }),
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          suggestions?: WordSuggestion[];
          reason?: string;
          limit?: number;
          remaining?: number;
          resetAt?: string;
        };
        if (!response.ok) {
          const message =
            data.reason === "rate_limited"
              ? "You’ve hit the daily suggestions limit. Try again tomorrow."
              : data.reason === "anchors_missing"
              ? "Add a draft or choose a variant first."
              : data.reason === "thread_not_found"
              ? "We couldn’t find this thread. Try refreshing the page."
              : data.reason === "target_language_missing" ||
                data.reason === "invalid_request"
              ? "Set a target language in Let’s Get Started."
              : "Couldn’t load suggestions. Please try again.";
          setAdditionalSuggestionsError(message);
          setAdditionalSuggestions([]);
          return;
        }
        if (controller.signal.aborted) return;
        if (!data.ok) {
          console.warn("[WordGrid] Suggestions rejected:", data.reason);
          setAdditionalSuggestionsError(
            data.reason === "rate_limited"
              ? "You’ve hit the daily suggestions limit. Try again tomorrow."
              : data.reason === "anchors_missing"
              ? "Add a draft or choose a variant first."
              : data.reason === "target_language_missing" ||
                data.reason === "invalid_request"
              ? "Set a target language in Let’s Get Started."
              : "Couldn’t load suggestions. Please try again."
          );
          setAdditionalSuggestions([]);
          return;
        }
        setAdditionalSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : []
        );
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
          return;
        }
        console.error("[WordGrid] Error generating suggestions:", error);
        setAdditionalSuggestionsError(
          "Couldn’t load suggestions. Check your connection and try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    },
    [
      thread,
      currentLineIndex,
      poemLines,
      translationIntent,
      resolvedTargetLanguage,
      currentLineTranslation,
      currentSelectedVariant,
      draftLines,
    ]
  );

  const generateTokenSuggestions = React.useCallback(
    async (options?: {
      userGuidance?: string;
      extraHints?: string[];
      suggestionRangeMode?: "focused" | "balanced" | "adventurous";
    }) => {
      if (!thread || currentLineIndex === null || !tokenFocus) return;

      const currentDraft = draftLines[currentLineIndex] || "";
      const variantFullTexts = currentLineTranslation
        ? currentLineTranslation.translations.reduce(
            (acc, variant) => {
              if (variant.variant === 1) acc.A = variant.fullText;
              if (variant.variant === 2) acc.B = variant.fullText;
              if (variant.variant === 3) acc.C = variant.fullText;
              return acc;
            },
            { A: "", B: "", C: "" }
          )
        : { A: "", B: "", C: "" };
      tokenSuggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      tokenSuggestionsAbortRef.current = controller;
      setIsLoadingTokenSuggestions(true);
      setTokenSuggestionsError(null);
      try {
        const response = await fetch("/api/workshop/token-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: thread,
            lineIndex: currentLineIndex,
            currentLine: poemLines[currentLineIndex],
            sourceLine: poemLines[currentLineIndex],
            previousLine:
              currentLineIndex > 0 ? poemLines[currentLineIndex - 1] : null,
            nextLine:
              currentLineIndex < poemLines.length - 1
                ? poemLines[currentLineIndex + 1]
                : null,
            fullPoem: poemLines.join("\n"),
            poemTheme: translationIntent || undefined,
            userGuidance: options?.userGuidance || null,
            extraHints: options?.extraHints ?? null,
            suggestionRangeMode: options?.suggestionRangeMode ?? "balanced",
            targetLanguage: resolvedTargetLanguage,
            targetLineDraft: currentDraft || null,
            variantFullTexts,
            selectedVariant: currentSelectedVariant ?? null,
            focus: {
              word: tokenFocus.word,
              originalWord: tokenFocus.originalWord,
              partOfSpeech: tokenFocus.partOfSpeech,
              position: tokenFocus.position,
              sourceType: tokenFocus.sourceType,
              variantId: tokenFocus.variantId ?? null,
            },
          }),
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          suggestions?: WordSuggestion[];
          reason?: string;
          limit?: number;
          remaining?: number;
          resetAt?: string;
        };
        if (!response.ok) {
          const message =
            data.reason === "rate_limited"
              ? "You’ve hit the daily suggestions limit. Try again tomorrow."
              : data.reason === "anchors_missing"
              ? "Add a draft or choose a variant first."
              : data.reason === "thread_not_found"
              ? "We couldn’t find this thread. Try refreshing the page."
              : data.reason === "target_language_missing" ||
                data.reason === "invalid_request"
              ? "Set a target language in Let’s Get Started."
              : "Couldn’t load suggestions. Please try again.";
          setTokenSuggestionsError(message);
          setTokenSuggestions([]);
          return;
        }
        if (controller.signal.aborted) return;
        if (!data.ok) {
          console.warn("[WordGrid] Token suggestions rejected:", data.reason);
          setTokenSuggestionsError(
            data.reason === "rate_limited"
              ? "You’ve hit the daily suggestions limit. Try again tomorrow."
              : data.reason === "anchors_missing"
              ? "Add a draft or choose a variant first."
              : data.reason === "target_language_missing" ||
                data.reason === "invalid_request"
              ? "Set a target language in Let’s Get Started."
              : "Couldn’t load suggestions. Please try again."
          );
          setTokenSuggestions([]);
          return;
        }
        setTokenSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : []
        );
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
          return;
        }
        console.error("[WordGrid] Error generating token suggestions:", error);
        setTokenSuggestionsError(
          "Couldn’t load suggestions. Check your connection and try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingTokenSuggestions(false);
        }
      }
    },
    [
      thread,
      currentLineIndex,
      poemLines,
      translationIntent,
      resolvedTargetLanguage,
      currentLineTranslation,
      currentSelectedVariant,
      draftLines,
      tokenFocus,
    ]
  );

  const handleOpenTokenSuggestions = React.useCallback(
    (payload: {
      word: string;
      originalWord: string;
      partOfSpeech: string;
      position: number;
      sourceType: "variant" | "source";
      variantId?: number;
    }) => {
      setTokenFocus(payload);
      setTokenSuggestions([]);
      setTokenSuggestionsError(null);
      setTokenSuggestionsOpen(true);
    },
    []
  );

  const handleAdditionalWordClick = React.useCallback(
    (word: string) => {
      if (currentLineIndex === null) return;
      const { appendToDraft } = useWorkshopStore.getState();
      const dragData: DragData = {
        id: `additional-${currentLineIndex}-${Date.now()}-${word}`,
        text: word,
        originalWord: word,
        partOfSpeech: "neutral",
        sourceLineNumber: currentLineIndex,
        position: 0,
        dragType: "variantWord",
        metadata: {
          source: "line-suggestions",
        },
      };
      appendToDraft(
        dragData.sourceLineNumber ?? currentLineIndex,
        dragData.text
      );
    },
    [currentLineIndex]
  );

  if (currentLineIndex === null) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-sm font-medium text-foreground-secondary">
            Select a line to begin translation
          </div>
          <p className="text-xs text-foreground-muted">
            You’ll get 3 full-line translation variants for every line.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-error/30 bg-error-light">
          <CardContent className="pt-6">
            <p className="text-sm text-error text-center mb-4">
              Translation failed. Please try again.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!thread) return;
                const lineText = poemLines[currentLineIndex];
                if (typeof lineText !== "string") return;
                const ctx = buildLineContextForIndex(
                  currentLineIndex,
                  poemLines
                );
                const fullPoem = lineContext?.fullPoem ?? ctx.fullPoem;
                translateLine({
                  threadId: thread,
                  lineIndex: currentLineIndex,
                  lineText,
                  fullPoem,
                  stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
                  prevLine:
                    (lineContext?.prevLine ?? ctx.prevLine) || undefined,
                  nextLine:
                    (lineContext?.nextLine ?? ctx.nextLine) || undefined,
                });
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show line translation UI if available, otherwise show old word-by-word UI
  if (currentLineTranslation) {
    // Navigation helpers
    const canGoPrevious = currentLineIndex !== null && currentLineIndex > 0;
    const canGoNext =
      currentLineIndex !== null && currentLineIndex < poemLines.length - 1;

    const handlePreviousLine = () => {
      if (canGoPrevious && currentLineIndex !== null) {
        setCurrentLineIndex(currentLineIndex - 1);
      }
    };

    const handleNextLine = () => {
      if (canGoNext && currentLineIndex !== null) {
        setCurrentLineIndex(currentLineIndex + 1);
      }
    };

    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Navigation arrows */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousLine}
              disabled={!canGoPrevious}
              className="h-10 w-10 p-0"
              title="Previous line"
              aria-label="Previous line"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextLine}
              disabled={!canGoNext}
              className="h-10 w-10 p-0"
              title="Next line"
              aria-label="Next line"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
            {currentLineIndex !== null && (
              <span className="text-sm text-foreground-muted ml-1">
                Line {currentLineIndex + 1} of {poemLines.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {badgeModelUsed && (
              <Badge variant="secondary" className="bg-accent-light/30 text-accent-dark">
                {badgeModelUsed}
              </Badge>
            )}
            {hasModelMismatch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateWithSelectedModel}
                disabled={isRegenerating}
                className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                title={`Regenerate with ${userSelectedModel}`}
              >
                {isRegenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Use {userSelectedModel}
              </Button>
            )}
          </div>
        </div>

        <SourceWordsPalette
          sourceWords={sourceWords}
          lineNumber={currentLineIndex}
          onSuggest={handleOpenTokenSuggestions}
        />

        <div className="space-y-4">
          {currentLineTranslation.translations.map((variant) => (
            <TranslationVariantCard
              key={variant.variant}
              variant={variant}
              isSelected={currentSelectedVariant === variant.variant}
              onSelect={() => {
                if (currentLineIndex !== null) {
                  const next =
                    currentSelectedVariant === variant.variant
                      ? null
                      : variant.variant;
                  selectVariant(currentLineIndex, next);
                }
              }}
              lineNumber={currentLineIndex ?? 0}
              stanzaIndex={lineContext?.stanzaIndex}
              onSuggest={handleOpenTokenSuggestions}
            />
          ))}
        </div>

        <AdditionalSuggestions
          suggestions={additionalSuggestions}
          isLoading={isLoadingSuggestions}
          errorMessage={additionalSuggestionsError}
          onGenerate={() => generateAdditionalSuggestions()}
          onRegenerate={(guidance) => generateAdditionalSuggestions(guidance)}
          onWordClick={handleAdditionalWordClick}
        />

        <TokenSuggestionsPopover
          open={tokenSuggestionsOpen}
          onOpenChange={setTokenSuggestionsOpen}
          focusLabel={tokenFocus?.word || ""}
          suggestions={tokenSuggestions}
          isLoading={isLoadingTokenSuggestions}
          errorMessage={tokenSuggestionsError}
          onGenerate={(options) => generateTokenSuggestions(options)}
          onRegenerate={(guidance, options) =>
            generateTokenSuggestions({ ...options, userGuidance: guidance })
          }
          onWordClick={handleAdditionalWordClick}
        />

        {/* Finalize Translation Button - Show when all lines are completed */}
        {allLinesCompleted && (
          <div className="mt-8 pt-6 border-t border-border-subtle">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">
                  All {poemLines.length} lines completed!
                </span>
              </div>
              <Button
                onClick={() => setShowFullEditor(true)}
                size="lg"
                className="px-8 py-6 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Finalize Translation
              </Button>
              <p className="text-xs text-foreground-muted text-center max-w-md">
                Review your complete translation, make final adjustments, and
                finalize your translation
              </p>
            </div>
          </div>
        )}

        {/* Full Translation Editor */}
        <FullTranslationEditor
          open={showFullEditor}
          onOpenChange={setShowFullEditor}
        />

        {/* Congratulations Modal */}
        <CongratulationsModal
          open={showCongratulations}
          onClose={() => setShowCongratulations(false)}
          totalLines={poemLines.length}
        />
      </div>
    );
  }

  // No translation yet (or request in-flight)
  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <Preloader size="6em" className="mx-auto block" />
        <p className="text-sm text-muted-foreground">
          {isPending
            ? "Generating translation variants..."
            : "No translation available"}
        </p>
      </div>
    </div>
  );
}

function SourceWordsPalette({
  sourceWords,
  lineNumber,
  onSuggest,
}: {
  sourceWords: string[];
  lineNumber: number | null;
  onSuggest?: (payload: {
    word: string;
    originalWord: string;
    partOfSpeech: string;
    position: number;
    sourceType: "source";
  }) => void;
}) {
  if (sourceWords.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-semibold text-blue-900">Source text words</p>
      </div>
      <p className="text-xs text-blue-700 mb-3">
        Drag these to keep the original words in your translation
      </p>
      <div className="flex flex-wrap gap-2">
        {sourceWords.map((word, idx) => (
          <DraggableSourceWord
            key={`source-${lineNumber ?? 0}-${idx}`}
            word={word}
            index={idx}
            lineNumber={lineNumber ?? 0}
            onSuggest={onSuggest}
          />
        ))}
      </div>
    </div>
  );
}

interface TranslationVariantCardProps {
  variant: LineTranslationVariant;
  isSelected: boolean;
  onSelect: () => void;
  lineNumber: number;
  stanzaIndex?: number;
  onSuggest?: (payload: {
    word: string;
    originalWord: string;
    partOfSpeech: string;
    position: number;
    sourceType: "variant";
    variantId: number;
  }) => void;
}

function TranslationVariantCard({
  variant,
  isSelected,
  onSelect,
  lineNumber,
  stanzaIndex,
  onSuggest,
}: TranslationVariantCardProps) {
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);

  const tokens = React.useMemo(() => {
    if (variant.words.length > 0) {
      return variant.words;
    }
    return variant.fullText
      .split(/\s+/)
      .filter(Boolean)
      .map((word, idx) => ({
        original: word,
        translation: word,
        partOfSpeech: "neutral",
        position: idx,
      }));
  }, [variant]);

  // Handler to add all tokens from this variant to the draft
  const handleAddAllTokens = React.useCallback(() => {
    // Collect all valid token translations
    const validTokens = tokens
      .filter((token) => token.translation && token.translation.trim())
      .map((token) => token.translation.trim());

    if (validTokens.length === 0) return;

    // Join tokens with spaces to form the complete variant text
    const fullVariantText = validTokens.join(" ");

    // Determine target line (use lineNumber from variant, or current line)
    const targetLine = lineNumber ?? currentLineIndex ?? 0;

    // Set current line if needed
    if (targetLine !== currentLineIndex) {
      setCurrentLineIndex(targetLine);
    }

    // Add all tokens to draft
    appendToDraft(targetLine, fullVariantText);
  }, [
    tokens,
    lineNumber,
    currentLineIndex,
    setCurrentLineIndex,
    appendToDraft,
  ]);

  return (
    <Card
      onClick={(e) => {
        // Only act if clicking on the card itself, not on draggable tokens
        const target = e.target as HTMLElement;
        if (!target.closest('[data-draggable="true"]')) {
          // Add all tokens to draft
          handleAddAllTokens();
          // Also toggle selection
          onSelect();
        }
      }}
      className={cn(
        "transition-all duration-fast border-2 rounded-md",
        isSelected
          ? "border-success bg-success-light shadow-panel-shadow"
          : "border-border-subtle hover:border-accent/50 hover:shadow-card"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <Badge
              variant={isSelected ? "default" : "secondary"}
              className={isSelected ? "bg-success" : ""}
            >
              Variant {variant.variant}
            </Badge>
            {isSelected && <CheckCircle2 className="w-4 h-4 text-success" />}
          </div>
          {/* <div className="text-xs text-foreground-muted">
            Literalness: {(variant.metadata.literalness * 100).toFixed(0)}%
          </div> */}
        </div>

        <div className="flex flex-wrap gap-2">
          {tokens.map((token, idx) => (
            <DraggableVariantToken
              key={`${variant.variant}-${token.position}-${idx}`}
              token={token}
              variantId={variant.variant}
              lineNumber={lineNumber}
              stanzaIndex={stanzaIndex}
              disabled={!token.translation}
              onSuggest={onSuggest}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {variant.metadata.preservesRhyme && (
            <Badge variant="outline" className="text-xs">
              Rhyme
            </Badge>
          )}
          {variant.metadata.preservesMeter && (
            <Badge variant="outline" className="text-xs">
              Meter
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {variant.metadata.characterCount} chars
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface DraggableVariantTokenProps {
  token: LineTranslationVariant["words"][number];
  variantId: number;
  lineNumber: number;
  stanzaIndex?: number;
  disabled?: boolean;
  onSuggest?: (payload: {
    word: string;
    originalWord: string;
    partOfSpeech: string;
    position: number;
    sourceType: "variant";
    variantId: number;
  }) => void;
}

function DraggableVariantToken({
  token,
  variantId,
  lineNumber,
  stanzaIndex,
  disabled,
  onSuggest,
}: DraggableVariantTokenProps) {
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);
  const [clicked, setClicked] = React.useState(false);
  const justDraggedRef = React.useRef(false);
  const longPressRef = React.useRef<number | null>(null);

  const pos = normalizePartOfSpeechTag(token.partOfSpeech);
  const dragData: DragData = {
    id: `variant-${variantId}-line-${lineNumber}-${token.position}-${token.translation}`,
    text: token.translation,
    originalWord: token.original || token.translation || "",
    partOfSpeech: pos,
    sourceLineNumber: lineNumber,
    position: token.position ?? 0,
    dragType: "variantWord",
    variantId,
    stanzaIndex,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragData.id,
      data: dragData,
      disabled: disabled || !token.translation,
    });

  React.useEffect(() => {
    if (isDragging) justDraggedRef.current = true;
  }, [isDragging]);

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      data-draggable="true"
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "px-3 py-2 rounded-lg border text-sm font-medium transition-all bg-white shadow-sm flex flex-col",
        "select-none touch-none",
        !disabled && "cursor-pointer hover:-translate-y-0.5 hover:shadow",
        isDragging && "opacity-60 scale-95 cursor-grabbing",
        disabled && "opacity-40 cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        clicked && "scale-[1.03] ring-2 ring-green-200",
        POS_COLORS[pos]
      )}
      title={
        token.original
          ? `Original: ${token.original}\nTranslation: ${token.translation}`
          : token.translation
      }
      aria-label={
        disabled
          ? undefined
          : `Add "${token.translation}" (from "${
              token.original || token.translation
            }") to notebook`
      }
      onPointerDown={() => {
        // Reset so a normal click isn't blocked by a prior drag.
        justDraggedRef.current = false;
        if (longPressRef.current) clearTimeout(longPressRef.current);
        longPressRef.current = window.setTimeout(() => {
          if (disabled || !token.translation) return;
          onSuggest?.({
            word: token.translation,
            originalWord: token.original || token.translation,
            partOfSpeech: pos,
            position: token.position ?? 0,
            sourceType: "variant",
            variantId,
          });
        }, 450);
      }}
      onPointerUp={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
      }}
      onPointerLeave={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
      }}
      onContextMenu={(e) => {
        if (disabled || !token.translation) return;
        e.preventDefault();
        onSuggest?.({
          word: token.translation,
          originalWord: token.original || token.translation,
          partOfSpeech: pos,
          position: token.position ?? 0,
          sourceType: "variant",
          variantId,
        });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled || !token.translation) return;
        // If the user just dragged, browsers can fire a click on mouseup—ignore once.
        if (justDraggedRef.current) {
          justDraggedRef.current = false;
          return;
        }
        const targetLine = dragData.sourceLineNumber ?? currentLineIndex ?? 0;
        if (targetLine !== currentLineIndex) {
          setCurrentLineIndex(targetLine);
        }
        appendToDraft(targetLine, dragData.text);
        setClicked(true);
        window.setTimeout(() => setClicked(false), 250);
      }}
      onKeyDown={(e) => {
        if (disabled || !token.translation) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const targetLine = dragData.sourceLineNumber ?? currentLineIndex ?? 0;
          if (targetLine !== currentLineIndex) {
            setCurrentLineIndex(targetLine);
          }
          appendToDraft(targetLine, dragData.text);
          setClicked(true);
          window.setTimeout(() => setClicked(false), 250);
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="text-foreground pointer-events-none">
        {token.translation || "…"}
      </span>
    </div>
  );
}
