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
import type { LineTranslationVariant } from "@/types/lineTranslation";
import {
  AdditionalSuggestions,
  type WordSuggestion,
} from "@/components/workshop/AdditionalSuggestions";
import { FullTranslationEditor } from "@/components/notebook/FullTranslationEditor";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";
import { Sparkles } from "lucide-react";

// Part of speech type and color mapping
const POS_COLORS = {
  noun: "bg-blue-50 text-blue-700 border-blue-200",
  verb: "bg-green-50 text-green-700 border-green-200",
  adjective: "bg-purple-50 text-purple-700 border-purple-200",
  adverb: "bg-orange-50 text-orange-700 border-orange-200",
  pronoun: "bg-pink-50 text-pink-700 border-pink-200",
  preposition: "bg-yellow-50 text-yellow-700 border-yellow-200",
  conjunction: "bg-indigo-50 text-indigo-700 border-indigo-200",
  article: "bg-gray-50 text-gray-700 border-gray-200",
  interjection: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
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
}: {
  word: string;
  index: number;
  lineNumber: number;
}) {
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);
  const [clicked, setClicked] = React.useState(false);
  const justDraggedRef = React.useRef(false);

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
        "px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium",
        "cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-colors",
        "select-none touch-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
        isDragging && "opacity-40 cursor-grabbing",
        clicked && "scale-[1.03] ring-2 ring-green-200"
      )}
      role="button"
      tabIndex={0}
      aria-label={`Add "${word}" to notebook`}
      onPointerDown={() => {
        // Reset so a normal click isn't blocked by a prior drag.
        justDraggedRef.current = false;
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
  const userSelectedModel = useGuideStore((s) => s.translationModel);

  const [additionalSuggestions, setAdditionalSuggestions] = React.useState<
    WordSuggestion[]
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  // Track in-flight requests to prevent duplicates (React Strict Mode fires effects twice)
  const inFlightRequestRef = React.useRef<string | null>(null);

  const {
    mutate: translateLine,
    isPending: isTranslatingLine,
    error: translateError,
  } = useTranslateLine();

  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
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

  React.useEffect(() => {
    if (currentLineIndex === null || !thread) return;
    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated → no fetch
    if (lineTranslations[currentLineIndex]) return;

    // Dedupe: prevent duplicate in-flight requests (React Strict Mode fires effects twice)
    const requestKey = `${thread}:${currentLineIndex}`;
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
      },
      {
        onSuccess: (data) => {
          setLineTranslation(currentLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
          inFlightRequestRef.current = null;
        },
        onError: () => {
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

    setIsRegenerating(true);
    // Clear cached translation to force refetch
    clearLineTranslation(currentLineIndex);

    const lineText = poemLines[currentLineIndex];
    if (typeof lineText !== "string") {
      setIsRegenerating(false);
      return;
    }

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
      },
      {
        onSuccess: (data) => {
          setLineTranslation(currentLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
          setIsRegenerating(false);
        },
        onError: () => {
          setIsRegenerating(false);
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
  ]);

  // Clear suggestions when switching lines
  React.useEffect(() => {
    setAdditionalSuggestions([]);
    setIsLoadingSuggestions(false);
  }, [currentLineIndex]);

  const generateAdditionalSuggestions = React.useCallback(
    async (userGuidance?: string) => {
      if (!thread || currentLineIndex === null) return;

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch("/api/workshop/additional-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: thread,
            lineIndex: currentLineIndex,
            currentLine: poemLines[currentLineIndex],
            previousLine:
              currentLineIndex > 0 ? poemLines[currentLineIndex - 1] : null,
            nextLine:
              currentLineIndex < poemLines.length - 1
                ? poemLines[currentLineIndex + 1]
                : null,
            fullPoem: poemLines.join("\n"),
            poemTheme: translationIntent || undefined,
            userGuidance: userGuidance || null,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          suggestions?: WordSuggestion[];
        };
        setAdditionalSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : []
        );
      } catch (error) {
        console.error("[WordGrid] Error generating suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [thread, currentLineIndex, poemLines, translationIntent]
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
          source: "additional-suggestions",
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
          <div className="text-sm font-medium text-gray-700">
            Select a line to begin translation
          </div>
          <p className="text-xs text-gray-500">
            You’ll get 3 full-line translation variants for every line.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 text-center mb-4">
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
              className="h-8 w-8 p-0"
              title="Previous line"
              aria-label="Previous line"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextLine}
              disabled={!canGoNext}
              className="h-8 w-8 p-0"
              title="Next line"
              aria-label="Next line"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {currentLineIndex !== null && (
              <span className="text-sm text-gray-500 ml-1">
                Line {currentLineIndex + 1} of {poemLines.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {badgeModelUsed && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
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
            />
          ))}
        </div>

        <AdditionalSuggestions
          suggestions={additionalSuggestions}
          isLoading={isLoadingSuggestions}
          onGenerate={() => generateAdditionalSuggestions()}
          onRegenerate={(guidance) => generateAdditionalSuggestions(guidance)}
          onWordClick={handleAdditionalWordClick}
        />

        {/* Finalize Poem Button - Show when all lines are completed */}
        {allLinesCompleted && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
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
                Finalize Poem
              </Button>
              <p className="text-xs text-gray-500 text-center max-w-md">
                Review your complete translation, make final adjustments, and
                finalize your masterpiece
              </p>
            </div>
          </div>
        )}

        {/* Full Translation Editor */}
        <FullTranslationEditor
          open={showFullEditor}
          onOpenChange={setShowFullEditor}
          onFinalize={() => {
            // Show congratulations after a short delay to allow editor to close
            setTimeout(() => {
              setShowCongratulations(true);
            }, 500);
          }}
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
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
}: {
  sourceWords: string[];
  lineNumber: number | null;
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
}

function TranslationVariantCard({
  variant,
  isSelected,
  onSelect,
  lineNumber,
  stanzaIndex,
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
        "transition-all border-2",
        isSelected
          ? "border-green-500 bg-green-50 shadow-md"
          : "border-gray-200 hover:border-blue-400 hover:shadow-sm"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <Badge
              variant={isSelected ? "default" : "secondary"}
              className={isSelected ? "bg-green-600" : ""}
            >
              Variant {variant.variant}
            </Badge>
            {isSelected && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          </div>
          {/* <div className="text-xs text-gray-500">
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
}

function DraggableVariantToken({
  token,
  variantId,
  lineNumber,
  stanzaIndex,
  disabled,
}: DraggableVariantTokenProps) {
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);
  const [clicked, setClicked] = React.useState(false);
  const justDraggedRef = React.useRef(false);

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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
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
      <span className="text-gray-900 pointer-events-none">
        {token.translation || "…"}
      </span>
      {token.original && (
        <span className="text-[11px] text-gray-600 pointer-events-none">
          {token.original}
        </span>
      )}
    </div>
  );
}
