"use client";

import React, { useState } from "react";
import { Music, ChevronDown, ChevronUp, Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RhymeSuggestion, RewriteOption } from "@/types/rhymeWorkshop";

interface RhymeWorkshopPanelProps {
  suggestions: RhymeSuggestion[];
  onApplyRewrite: (lineIndex: number, newText: string) => void;
  onDismiss: (suggestionIndex: number) => void;
  className?: string;
}

export function RhymeWorkshopPanel({
  suggestions,
  onApplyRewrite,
  onDismiss,
  className,
}: RhymeWorkshopPanelProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(
    suggestions.length > 0 ? 0 : null
  );
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(
    new Set()
  );

  if (suggestions.length === 0) {
    return null;
  }

  const visibleSuggestions = suggestions.filter(
    (_, idx) => !dismissedSuggestions.has(idx)
  );

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const handleDismiss = (index: number) => {
    setDismissedSuggestions((prev) => new Set([...prev, index]));
    onDismiss(index);
  };

  const getRhymeTypeLabel = (type: RhymeSuggestion["type"]): string => {
    switch (type) {
      case "perfect_rhyme":
        return "Perfect Rhyme";
      case "slant_rhyme":
        return "Slant Rhyme";
      case "internal_rhyme":
        return "Internal Rhyme";
      default:
        return "Rhyme";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Music className="h-4 w-4 text-violet-600" />
        <span>Rhyme Workshop</span>
        <Badge variant="secondary" className="text-xs">
          {visibleSuggestions.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          if (dismissedSuggestions.has(idx)) return null;

          const isExpanded = expandedSuggestion === idx;

          return (
            <div
              key={idx}
              className="rounded-lg border border-violet-200 bg-violet-50/50 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedSuggestion(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between p-3 hover:bg-violet-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs bg-violet-100 border-violet-300 text-violet-700"
                  >
                    {getRhymeTypeLabel(suggestion.type)}
                  </Badge>
                  <span className="text-sm text-slate-700">
                    Lines {suggestion.targetLines[0] + 1} &{" "}
                    {suggestion.targetLines[1] + 1}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Instruction */}
                  <p className="text-sm text-slate-600">{suggestion.instruction}</p>

                  {/* Target Sound */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Target sound:
                    </span>
                    <Badge className="bg-violet-600 text-white">
                      {suggestion.targetSound}
                    </Badge>
                  </div>

                  {/* Current Lines */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2">
                    <div className="text-xs font-medium text-slate-500 mb-2">
                      Your current lines:
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">
                        L{suggestion.targetLines[0] + 1}
                      </Badge>
                      <span className="text-sm">{suggestion.currentLines.line1}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">
                        L{suggestion.targetLines[1] + 1}
                      </Badge>
                      <span className="text-sm">{suggestion.currentLines.line2}</span>
                    </div>
                  </div>

                  {/* Candidate Words */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">
                      Rhyming words for "{suggestion.targetSound}":
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.candidateWords.map((word, widx) => {
                        const isRelevant = word in suggestion.semanticallyRelevant;
                        return (
                          <Badge
                            key={widx}
                            variant={isRelevant ? "default" : "outline"}
                            className={cn(
                              "text-xs cursor-default",
                              isRelevant
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "hover:bg-slate-100"
                            )}
                            title={
                              isRelevant
                                ? suggestion.semanticallyRelevant[word]
                                : undefined
                            }
                          >
                            {word}
                            {isRelevant && (
                              <Check className="h-3 w-3 ml-1" />
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                    {Object.keys(suggestion.semanticallyRelevant).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        <span className="font-medium">Best fits:</span>{" "}
                        {Object.entries(suggestion.semanticallyRelevant)
                          .map(([word, reason]) => `"${word}" (${reason})`)
                          .join(", ")}
                      </div>
                    )}
                  </div>

                  {/* Suggested Rewrites */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">
                      Suggested rewrites:
                    </div>
                    <div className="space-y-2">
                      {suggestion.suggestedRewrites.map((rewrite, ridx) => (
                        <RewriteOptionCard
                          key={ridx}
                          rewrite={rewrite}
                          optionLabel={String.fromCharCode(65 + ridx)} // A, B, C...
                          onApply={() =>
                            onApplyRewrite(suggestion.targetLines[1], rewrite.text)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{suggestion.recommendation}</p>
                  </div>

                  {/* Dismiss Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(idx)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Rewrite Option Card
// ============================================================================

interface RewriteOptionCardProps {
  rewrite: RewriteOption;
  optionLabel: string;
  onApply: () => void;
}

function RewriteOptionCard({
  rewrite,
  optionLabel,
  onApply,
}: RewriteOptionCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <Badge variant="outline" className="text-xs shrink-0">
            Option {optionLabel}
          </Badge>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-800">"{rewrite.text}"</p>
            <p className="text-xs text-slate-500">
              <span className="font-medium">Technique:</span> {rewrite.technique}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onApply}
          className="shrink-0 text-xs bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
        >
          <Check className="h-3 w-3 mr-1" />
          Apply
        </Button>
      </div>

      <div className="text-xs text-slate-600 pl-12">
        <span className="font-medium">Trade-off:</span> {rewrite.tradeOff}
      </div>

      {rewrite.syllables && (
        <div className="flex gap-3 text-xs text-slate-500 pl-12">
          <span>
            Current: <strong>{rewrite.syllables.current}</strong> syllables
          </span>
          <span>
            Suggested: <strong>{rewrite.syllables.suggested}</strong> syllables
          </span>
          <span>
            Source: <strong>{rewrite.syllables.source}</strong> syllables
          </span>
        </div>
      )}
    </div>
  );
}
