"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGenerateOptions } from "@/lib/hooks/useWorkshopFlow";
import { useTranslateLine } from "@/lib/hooks/useTranslateLine";
import { useThreadId } from "@/hooks/useThreadId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Edit3, GripVertical } from "lucide-react";
import { DragData } from "@/types/drag";
import { cn } from "@/lib/utils";
import { ContextNotes } from "./ContextNotes";
import { usePrefetchContext } from "@/lib/hooks/usePrefetchContext";
import type { LineTranslationVariant } from "@/types/lineTranslation";

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

const POS_LABELS = {
  noun: "NOUN",
  verb: "VERB",
  adjective: "ADJ",
  adverb: "ADV",
  pronoun: "PRON",
  preposition: "PREP",
  conjunction: "CONJ",
  article: "ART",
  interjection: "INTJ",
  neutral: "—",
} as const;

// Simple heuristic to detect part of speech from word characteristics
// This is a placeholder - ideally the API should return POS tags
function detectPartOfSpeech(
  word: string,
  index: number
): keyof typeof POS_COLORS {
  const lower = word.toLowerCase();

  // Articles
  if (
    ["a", "an", "the", "le", "la", "les", "un", "une", "des"].includes(lower)
  ) {
    return "article";
  }

  // Common prepositions
  if (
    [
      "in",
      "on",
      "at",
      "by",
      "for",
      "with",
      "from",
      "to",
      "of",
      "dans",
      "sur",
      "avec",
      "de",
    ].includes(lower)
  ) {
    return "preposition";
  }

  // Common pronouns
  if (
    [
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "je",
      "tu",
      "il",
      "elle",
      "nous",
      "vous",
    ].includes(lower)
  ) {
    return "pronoun";
  }

  // Common conjunctions
  if (["and", "or", "but", "yet", "so", "et", "ou", "mais"].includes(lower)) {
    return "conjunction";
  }

  // Verbs (ending patterns - very basic heuristic)
  if (
    lower.endsWith("ing") ||
    lower.endsWith("ed") ||
    lower.endsWith("er") ||
    lower.endsWith("ez")
  ) {
    return "verb";
  }

  // Adjectives (ending patterns)
  if (
    lower.endsWith("ful") ||
    lower.endsWith("less") ||
    lower.endsWith("ous") ||
    lower.endsWith("able")
  ) {
    return "adjective";
  }

  // Adverbs
  if (lower.endsWith("ly") || lower.endsWith("ment")) {
    return "adverb";
  }

  // Default to noun for content words, neutral for unknown
  return index % 3 === 0 ? "noun" : "neutral";
}

function normalizePartOfSpeechTag(
  tag?: string | null
): keyof typeof POS_COLORS {
  if (!tag) return "neutral";
  const normalized = tag.toLowerCase() as keyof typeof POS_COLORS;
  return normalized in POS_COLORS ? normalized : "neutral";
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

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium",
        "cursor-move hover:bg-blue-100 hover:border-blue-300 transition-colors",
        "select-none touch-none",
        isDragging && "opacity-40"
      )}
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
  const wordOptions = useWorkshopStore((s) => s.wordOptions);
  const wordOptionsCache = useWorkshopStore((s) => s.wordOptionsCache);
  const selections = useWorkshopStore((s) => s.selections);
  const selectWord = useWorkshopStore((s) => s.selectWord);
  const deselectWord = useWorkshopStore((s) => s.deselectWord);
  const setWordOptions = useWorkshopStore((s) => s.setWordOptions);
  const setWordOptionsForLine = useWorkshopStore(
    (s) => s.setWordOptionsForLine
  );
  const setIsGenerating = useWorkshopStore((s) => s.setIsGenerating);
  const modelUsed = useWorkshopStore((s) => s.modelUsed);

  const {
    mutate: generateOptions,
    isPending: isGeneratingOptions,
    error: generateError,
  } = useGenerateOptions();
  const {
    mutate: translateLine,
    isPending: isTranslatingLine,
    error: translateError,
  } = useTranslateLine();

  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const setLineTranslation = useWorkshopStore((s) => s.setLineTranslation);
  const selectVariant = useWorkshopStore((s) => s.selectVariant);

  const isPending = isGeneratingOptions || isTranslatingLine;
  const error = generateError || translateError;

  // Derive source words from the raw line (instant, no LLM wait)
  const sourceWords = React.useMemo(() => {
    if (selectedLineIndex === null) return [];
    const line = poemLines[selectedLineIndex];
    return line.split(/\s+/).filter(Boolean);
  }, [selectedLineIndex, poemLines]);

  // Prefetch context notes when word options are loaded (include options for unsaved lines)
  usePrefetchContext(
    thread,
    selectedLineIndex,
    wordOptions?.length || 0,
    wordOptions || undefined
  );

  // Check if we should use new line translation or old word-by-word workflow
  const hasLineTranslation =
    selectedLineIndex !== null &&
    lineTranslations[selectedLineIndex] !== undefined;

  // Check if word options are cached for this specific line
  const cachedWordOptions =
    selectedLineIndex !== null ? wordOptionsCache[selectedLineIndex] : null;

  // If we have cached options for this line, restore them to the global state
  React.useEffect(() => {
    if (cachedWordOptions && cachedWordOptions.length > 0) {
      setWordOptions(cachedWordOptions);
    }
  }, [cachedWordOptions, selectedLineIndex, setWordOptions]);

  React.useEffect(() => {
    if (
      selectedLineIndex === null ||
      !thread ||
      !poemLines[selectedLineIndex]
    ) {
      return;
    }

    const lineText = poemLines[selectedLineIndex];

    // If line translation already exists, don't fetch again
    if (hasLineTranslation) {
      return;
    }

    // Also check if word options are cached for this specific line
    if (cachedWordOptions && cachedWordOptions.length > 0) {
      // Restore from cache
      setWordOptions(cachedWordOptions);
      return;
    }

    // Try new line translation workflow first (if context is available)
    // Fall back to old word-by-word if context is missing or translation fails
    if (lineContext) {
      setIsGenerating(true);
      translateLine(
        {
          threadId: thread,
          lineIndex: selectedLineIndex,
          lineText,
          fullPoem: lineContext.fullPoem,
          stanzaIndex: lineContext.stanzaIndex,
          prevLine: lineContext.prevLine,
          nextLine: lineContext.nextLine,
        },
        {
          onSuccess: (data) => {
            setLineTranslation(selectedLineIndex, data);
            useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
            setIsGenerating(false);
          },
          onError: () => {
            // Fall back to old workflow on error
            console.warn(
              "[WordGrid] Line translation failed, falling back to word-by-word"
            );
            setIsGenerating(true);
            generateOptions(
              {
                threadId: thread,
                lineIndex: selectedLineIndex,
                lineText,
              },
              {
                onSuccess: (data) => {
                  // Cache options per line
                  setWordOptionsForLine(selectedLineIndex, data.words);
                  useWorkshopStore.setState({
                    modelUsed: data.modelUsed || null,
                  });
                  setIsGenerating(false);
                },
                onError: () => {
                  setWordOptions(null);
                  setIsGenerating(false);
                },
              }
            );
          },
        }
      );
    } else {
      // No context available, use old workflow
      setIsGenerating(true);
      generateOptions(
        {
          threadId: thread,
          lineIndex: selectedLineIndex,
          lineText,
        },
        {
          onSuccess: (data) => {
            // Cache options per line
            setWordOptionsForLine(selectedLineIndex, data.words);
            useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
            setIsGenerating(false);
          },
          onError: () => {
            setWordOptions(null);
            setIsGenerating(false);
          },
        }
      );
    }
  }, [
    selectedLineIndex,
    thread,
    poemLines,
    lineContext,
    hasLineTranslation,
    cachedWordOptions,
    translateLine,
    generateOptions,
    setLineTranslation,
    setWordOptions,
    setWordOptionsForLine,
    setIsGenerating,
  ]);

  // Get current line translation if available
  const currentLineTranslation =
    selectedLineIndex !== null ? lineTranslations[selectedLineIndex] : null;
  const currentSelectedVariant =
    selectedLineIndex !== null ? selectedVariant[selectedLineIndex] : null;

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 text-center mb-4">
              Failed to generate translation options.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (
                  selectedLineIndex !== null &&
                  thread &&
                  poemLines[selectedLineIndex]
                ) {
                  if (lineContext) {
                    translateLine({
                      threadId: thread,
                      lineIndex: selectedLineIndex,
                      lineText: poemLines[selectedLineIndex],
                      fullPoem: lineContext.fullPoem,
                      stanzaIndex: lineContext.stanzaIndex,
                      prevLine: lineContext.prevLine,
                      nextLine: lineContext.nextLine,
                    });
                  } else {
                    generateOptions({
                      threadId: thread,
                      lineIndex: selectedLineIndex,
                      lineText: poemLines[selectedLineIndex],
                    });
                  }
                }
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
      </div>
    );
  }

  // Fall back to old word-by-word UI
  // Only show loading if we don't have word options AND we're actually pending
  // (isPending from a previous line should not block display of current line's options)
  if (!wordOptions) {
    // Show loading state while fetching
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Generating translation options..."
              : "No options available"}
          </p>
        </div>
      </div>
    );
  }

  // Check if this is a blank line (no words)
  const isBlankLine = wordOptions.length === 0;

  if (isBlankLine) {
    return (
      <div className="h-full bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="text-4xl opacity-20">⏸</div>
          <h3 className="text-lg font-medium text-gray-700">Blank Line</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            This line is empty or contains only whitespace. It will be preserved
            in the formatting.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Auto-complete blank lines
              if (selectedLineIndex !== null) {
                useWorkshopStore.setState({
                  completedLines: {
                    ...useWorkshopStore.getState().completedLines,
                    [selectedLineIndex]: "", // Save empty string for blank line
                  },
                });
              }
            }}
            className="mt-4"
          >
            Mark as Complete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <SourceWordsPalette
        sourceWords={sourceWords}
        lineNumber={selectedLineIndex}
      />

      {/* Existing translation options grid */}
      <div className="h-full bg-gradient-to-b from-gray-50 to-white flex flex-col">
        {/* Model indicator banner */}
        {modelUsed && (
          <div className="mx-6 mt-6 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-500 text-white">
                AI Model
              </Badge>
              <span className="text-sm font-medium text-blue-900">
                {modelUsed}
              </span>
            </div>
          </div>
        )}

        {/* Horizontal word-by-word translation layout - Single line with horizontal scroll */}
        <div className="flex-1 overflow-x-auto overflow-y-auto px-6 pb-6">
          <div className="flex gap-6 min-w-min justify-center items-start">
            {wordOptions.map((w, colIdx) => {
              const pos =
                w.partOfSpeech || detectPartOfSpeech(w.original, colIdx);
              const isSelected = selections[w.position] !== undefined;
              const selectedValue = selections[w.position];

              return (
                <div key={colIdx} className="flex flex-col">
                  <WordColumn
                    word={w}
                    pos={pos}
                    isSelected={isSelected}
                    selectedValue={selectedValue}
                    onSelectOption={(opt) => {
                      // Toggle: if clicking the same option, deselect it
                      if (selectedValue === opt) {
                        deselectWord(w.position);
                      } else {
                        selectWord(w.position, opt);
                      }
                    }}
                  />
                  {/* Context Notes for this token */}
                  {thread && selectedLineIndex !== null && (
                    <ContextNotes
                      threadId={thread}
                      lineIndex={selectedLineIndex}
                      tokenIndex={colIdx}
                      wordOptionsForLine={wordOptions}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DraggableWordOptionProps {
  word: { original: string; position: number };
  option: string;
  pos: keyof typeof POS_COLORS;
  isSelected: boolean;
  sourceLineNumber: number;
  onClick: () => void;
}

function DraggableWordOption({
  word,
  option,
  pos,
  isSelected,
  sourceLineNumber,
  onClick,
}: DraggableWordOptionProps) {
  const dragData: DragData = {
    id: `${sourceLineNumber}-${word.position}-${option}`,
    text: option,
    originalWord: word.original,
    partOfSpeech: pos,
    sourceLineNumber,
    position: word.position,
    dragType: "option",
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragData.id,
      data: dragData,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative w-full text-center rounded-lg border-2 px-3 py-2
        transition-all duration-200 text-sm font-medium select-none
        ${
          isSelected
            ? "border-green-500 bg-green-50 text-green-800 shadow-md scale-105"
            : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm"
        }
        ${isDragging ? "opacity-60 scale-95" : ""}
      `}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      <span className="w-full h-full inline-block">{option}</span>

      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        <span className="text-[10px] text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
          Drag to notebook →
        </span>
      </div>
    </div>
  );
}

interface WordColumnProps {
  word: { original: string; position: number; options: string[] };
  pos: keyof typeof POS_COLORS;
  isSelected: boolean;
  selectedValue?: string;
  onSelectOption: (option: string) => void;
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
        !disabled && "cursor-move hover:-translate-y-0.5 hover:shadow",
        isDragging && "opacity-60 scale-95 cursor-grabbing",
        disabled && "opacity-40 cursor-not-allowed",
        POS_COLORS[pos]
      )}
      title={
        token.original
          ? `Original: ${token.original}\nTranslation: ${token.translation}`
          : token.translation
      }
      onClick={(e) => {
        // Stop propagation to prevent card selection when clicking (not dragging)
        e.stopPropagation();
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

function WordColumn({
  word,
  pos,
  isSelected,
  selectedValue,
  onSelectOption,
}: WordColumnProps) {
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const customInputRef = React.useRef<HTMLInputElement>(null);
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);

  React.useEffect(() => {
    if (showCustomInput) {
      customInputRef.current?.focus();
    }
  }, [showCustomInput]);

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onSelectOption(customValue.trim());
      setCustomValue("");
      setShowCustomInput(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-w-[140px] max-w-[180px]">
      {/* Original Word Header */}
      <div className="mb-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h3 className="text-lg font-semibold text-gray-800">
            {word.original}
          </h3>
          {isSelected && (
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          )}
        </div>
        <Badge
          variant="secondary"
          className={`${POS_COLORS[pos]} text-[10px] font-medium px-2 py-0.5 border`}
        >
          {POS_LABELS[pos]}
        </Badge>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-3" />

      {/* Translation Options */}
      <div className="w-full space-y-2">
        {word.options.map((opt, i) => {
          const isThisSelected = selectedValue === opt;

          return (
            <DraggableWordOption
              key={i}
              word={word}
              option={opt}
              pos={pos}
              isSelected={isThisSelected}
              sourceLineNumber={selectedLineIndex ?? 0}
              onClick={() => onSelectOption(opt)}
            />
          );
        })}

        {/* Custom Translation Input */}
        {showCustomInput ? (
          <div className="pt-1">
            <input
              ref={customInputRef}
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Type here..."
              className="w-full text-sm text-center px-2 py-2 border-2 border-dashed border-blue-400 rounded-lg focus:outline-none focus:border-blue-600 bg-blue-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCustomSubmit();
                } else if (e.key === "Escape") {
                  setShowCustomInput(false);
                  setCustomValue("");
                }
              }}
              onBlur={() => {
                if (!customValue.trim()) {
                  setShowCustomInput(false);
                }
              }}
            />
            <div className="flex gap-1 mt-1">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-7 text-xs"
                onClick={handleCustomSubmit}
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-7 text-xs"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="w-full text-center text-xs text-gray-500 hover:text-blue-600 py-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
          >
            <Edit3 className="w-3 h-3 inline mr-1" />
            Custom
          </button>
        )}
      </div>
    </div>
  );
}
