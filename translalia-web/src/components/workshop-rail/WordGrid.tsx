"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGenerateOptions } from "@/lib/hooks/useWorkshopFlow";
import { useThreadId } from "@/hooks/useThreadId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Edit3, GripVertical } from "lucide-react";
import { DragData } from "@/types/drag";
import { cn } from "@/lib/utils";

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

export function WordGrid({ threadId: pThreadId }: { threadId?: string }) {
  const threadHook = useThreadId();
  const thread = pThreadId || threadHook || undefined;
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const wordOptions = useWorkshopStore((s) => s.wordOptions);
  const selections = useWorkshopStore((s) => s.selections);
  const selectWord = useWorkshopStore((s) => s.selectWord);
  const deselectWord = useWorkshopStore((s) => s.deselectWord);
  const setWordOptions = useWorkshopStore((s) => s.setWordOptions);
  const setIsGenerating = useWorkshopStore((s) => s.setIsGenerating);
  const modelUsed = useWorkshopStore((s) => s.modelUsed);

  const { mutate: generateOptions, isPending, error } = useGenerateOptions();

  // Derive source words from the raw line (instant, no LLM wait)
  const sourceWords = React.useMemo(() => {
    if (selectedLineIndex === null) return [];
    const line = poemLines[selectedLineIndex];
    return line.split(/\s+/).filter(Boolean);
  }, [selectedLineIndex, poemLines]);

  React.useEffect(() => {
    if (selectedLineIndex !== null && thread && poemLines[selectedLineIndex]) {
      setIsGenerating(true);
      generateOptions(
        {
          threadId: thread,
          lineIndex: selectedLineIndex,
          lineText: poemLines[selectedLineIndex],
        },
        {
          onSuccess: (data) => {
            setWordOptions(data.words);
            // Store the model used
            useWorkshopStore.setState({ modelUsed: data.modelUsed || null });
          },
          onError: () => setWordOptions(null),
        }
      );
    }
  }, [
    selectedLineIndex,
    thread,
    generateOptions,
    poemLines,
    setIsGenerating,
    setWordOptions,
  ]);

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
                  generateOptions({
                    threadId: thread,
                    lineIndex: selectedLineIndex,
                    lineText: poemLines[selectedLineIndex],
                  });
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

  if (!wordOptions || isPending) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Generating translation options...
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
      {/* Source words section - available IMMEDIATELY */}
      {sourceWords.length > 0 && (
        <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-blue-900">
              Source text words
            </p>
          </div>
          <p className="text-xs text-blue-700 mb-3">
            Drag these to keep the original words in your translation
          </p>
          <div className="flex flex-wrap gap-2">
            {sourceWords.map((word, idx) => (
              <DraggableSourceWord
                key={`source-${selectedLineIndex}-${idx}`}
                word={word}
                index={idx}
                lineNumber={selectedLineIndex ?? 0}
              />
            ))}
          </div>
        </div>
      )}

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
                <WordColumn
                  key={colIdx}
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
