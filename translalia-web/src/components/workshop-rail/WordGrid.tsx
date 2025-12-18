"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useTranslateLine } from "@/lib/hooks/useTranslateLine";
import { useThreadId } from "@/hooks/useThreadId";
import { useNotebookStore } from "@/store/notebookSlice";
import { createCellFromDragData } from "@/lib/notebook/cellHelpers";
import { useGuideStore } from "@/store/guideSlice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DragData } from "@/types/drag";
import { cn } from "@/lib/utils";
import type { LineTranslationVariant } from "@/types/lineTranslation";
import {
  AdditionalSuggestions,
  type WordSuggestion,
} from "@/components/workshop/AdditionalSuggestions";

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
  const addCell = useNotebookStore((s) => s.addCell);
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
        addCell(createCellFromDragData(dragData));
        setClicked(true);
        window.setTimeout(() => setClicked(false), 250);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addCell(createCellFromDragData(dragData));
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
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const modelUsed = useWorkshopStore((s) => s.modelUsed);
  const translationIntent = useGuideStore(
    (s) => s.translationIntent.text ?? null
  );

  const [additionalSuggestions, setAdditionalSuggestions] = React.useState<
    WordSuggestion[]
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);

  const {
    mutate: translateLine,
    isPending: isTranslatingLine,
    error: translateError,
  } = useTranslateLine();

  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const setLineTranslation = useWorkshopStore((s) => s.setLineTranslation);
  const selectVariant = useWorkshopStore((s) => s.selectVariant);

  const isPending = isTranslatingLine;
  const error = translateError;

  // Derive source words from the raw line (instant, no LLM wait)
  const sourceWords = React.useMemo(() => {
    if (selectedLineIndex === null) return [];
    const line = poemLines[selectedLineIndex];
    // Guard against undefined line (can happen when store is reset or poemLines is empty)
    if (!line || typeof line !== "string") return [];
    return line.split(/\s+/).filter(Boolean);
  }, [selectedLineIndex, poemLines]);

  React.useEffect(() => {
    if (selectedLineIndex === null || !thread) return;
    const lineText = poemLines[selectedLineIndex];
    if (typeof lineText !== "string") return;

    // Already translated → no fetch
    if (lineTranslations[selectedLineIndex]) return;

    const ctx = buildLineContextForIndex(selectedLineIndex, poemLines);
    const fullPoem = lineContext?.fullPoem ?? ctx.fullPoem;

    translateLine(
      {
        threadId: thread,
        lineIndex: selectedLineIndex,
        lineText,
        fullPoem,
        stanzaIndex: lineContext?.stanzaIndex ?? ctx.stanzaIndex,
        prevLine: (lineContext?.prevLine ?? ctx.prevLine) || undefined,
        nextLine: (lineContext?.nextLine ?? ctx.nextLine) || undefined,
      },
      {
        onSuccess: (data) => {
          setLineTranslation(selectedLineIndex, data);
          useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
        },
      }
    );
  }, [
    selectedLineIndex,
    thread,
    poemLines,
    lineTranslations,
    lineContext,
    translateLine,
    setLineTranslation,
  ]);

  // Get current line translation if available
  const currentLineTranslation =
    selectedLineIndex !== null ? lineTranslations[selectedLineIndex] : null;
  const currentSelectedVariant =
    selectedLineIndex !== null ? selectedVariant[selectedLineIndex] : null;

  // Clear suggestions when switching lines
  React.useEffect(() => {
    setAdditionalSuggestions([]);
    setIsLoadingSuggestions(false);
  }, [selectedLineIndex]);

  const generateAdditionalSuggestions = React.useCallback(
    async (userGuidance?: string) => {
      if (!thread || selectedLineIndex === null) return;

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch("/api/workshop/additional-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: thread,
            lineIndex: selectedLineIndex,
            currentLine: poemLines[selectedLineIndex],
            previousLine:
              selectedLineIndex > 0 ? poemLines[selectedLineIndex - 1] : null,
            nextLine:
              selectedLineIndex < poemLines.length - 1
                ? poemLines[selectedLineIndex + 1]
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
    [thread, selectedLineIndex, poemLines, translationIntent]
  );

  const handleAdditionalWordClick = React.useCallback(
    (word: string) => {
      if (selectedLineIndex === null) return;
      const dragData: DragData = {
        id: `additional-${selectedLineIndex}-${Date.now()}-${word}`,
        text: word,
        originalWord: word,
        partOfSpeech: "neutral",
        sourceLineNumber: selectedLineIndex,
        position: 0,
        dragType: "variantWord",
        metadata: {
          source: "additional-suggestions",
        },
      };
      useNotebookStore.getState().addCell(createCellFromDragData(dragData));
    },
    [selectedLineIndex]
  );

  if (selectedLineIndex === null) {
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
                const lineText = poemLines[selectedLineIndex];
                if (typeof lineText !== "string") return;
                const ctx = buildLineContextForIndex(
                  selectedLineIndex,
                  poemLines
                );
                const fullPoem = lineContext?.fullPoem ?? ctx.fullPoem;
                translateLine({
                  threadId: thread,
                  lineIndex: selectedLineIndex,
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
    const ctx = buildLineContextForIndex(selectedLineIndex, poemLines);
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-700">
              Select a translation variant
            </div>
            <p className="text-xs text-gray-500">
              Drag any token from the variants or the original line into your
              notebook.
            </p>
            {ctx.position.isOnly ? (
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ Single-line poem — variants adapted for standalone impact
              </p>
            ) : ctx.position.isFirst || ctx.position.isLast ? (
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ {ctx.position.isFirst ? "Opening" : "Closing"} line —
                variants adapted for position
              </p>
            ) : null}
          </div>
          {modelUsed && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {modelUsed}
            </Badge>
          )}
        </div>

        <SourceWordsPalette
          sourceWords={sourceWords}
          lineNumber={selectedLineIndex}
        />

        <div className="space-y-4">
          {currentLineTranslation.translations.map((variant) => (
            <TranslationVariantCard
              key={variant.variant}
              variant={variant}
              isSelected={currentSelectedVariant === variant.variant}
              onSelect={() => {
                if (selectedLineIndex !== null) {
                  const next =
                    currentSelectedVariant === variant.variant
                      ? null
                      : variant.variant;
                  selectVariant(selectedLineIndex, next);
                }
              }}
              lineNumber={selectedLineIndex ?? 0}
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
          isExpanded={false}
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

  return (
    <Card
      onClick={(e) => {
        // Only select card if clicking on the card itself, not on draggable tokens
        const target = e.target as HTMLElement;
        if (!target.closest('[data-draggable="true"]')) {
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
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={onSelect}
        >
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
  const addCell = useNotebookStore((s) => s.addCell);
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
        addCell(createCellFromDragData(dragData));
        setClicked(true);
        window.setTimeout(() => setClicked(false), 250);
      }}
      onKeyDown={(e) => {
        if (disabled || !token.translation) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addCell(createCellFromDragData(dragData));
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
