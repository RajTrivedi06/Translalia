"use client";

import React, { useState } from "react";
import { Waves, ChevronDown, ChevronUp, Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SoundPatternSuggestion, SoundOption } from "@/types/rhymeWorkshop";

interface SoundPatternPanelProps {
  suggestions: SoundPatternSuggestion[];
  onApplyOption: (lineIndex: number, newText: string) => void;
  onDismiss: (suggestionIndex: number) => void;
  className?: string;
}

export function SoundPatternPanel({
  suggestions,
  onApplyOption,
  onDismiss,
  className,
}: SoundPatternPanelProps) {
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

  const getSoundTypeLabel = (type: SoundPatternSuggestion["type"]): string => {
    switch (type) {
      case "alliteration":
        return "Alliteration";
      case "assonance":
        return "Assonance";
      case "consonance":
        return "Consonance";
      default:
        return "Sound Pattern";
    }
  };

  const getSoundTypeDescription = (
    type: SoundPatternSuggestion["type"]
  ): string => {
    switch (type) {
      case "alliteration":
        return "Repeated consonant sounds at the beginning of words";
      case "assonance":
        return "Repeated vowel sounds within words";
      case "consonance":
        return "Repeated consonant sounds at the end of words";
      default:
        return "Sound pattern";
    }
  };

  const getSoundTypeColor = (
    type: SoundPatternSuggestion["type"]
  ): { bg: string; border: string; text: string } => {
    switch (type) {
      case "alliteration":
        return {
          bg: "bg-sky-50",
          border: "border-sky-200",
          text: "text-sky-700",
        };
      case "assonance":
        return {
          bg: "bg-rose-50",
          border: "border-rose-200",
          text: "text-rose-700",
        };
      case "consonance":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-700",
        };
      default:
        return {
          bg: "bg-slate-50",
          border: "border-slate-200",
          text: "text-slate-700",
        };
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Waves className="h-4 w-4 text-sky-600" />
        <span>Sound Patterns</span>
        <Badge variant="secondary" className="text-xs">
          {visibleSuggestions.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          if (dismissedSuggestions.has(idx)) return null;

          const isExpanded = expandedSuggestion === idx;
          const colors = getSoundTypeColor(suggestion.type);

          return (
            <div
              key={idx}
              className={cn(
                "rounded-lg border overflow-hidden",
                colors.border,
                colors.bg
              )}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedSuggestion(isExpanded ? null : idx)}
                className={cn(
                  "w-full flex items-center justify-between p-3 hover:opacity-80 transition-opacity"
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      colors.bg,
                      colors.border,
                      colors.text
                    )}
                  >
                    {getSoundTypeLabel(suggestion.type)}
                  </Badge>
                  <span className="text-sm text-slate-700">
                    Line {suggestion.lineIndex + 1}
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
                  {/* Sound Type Description */}
                  <p className="text-xs text-slate-500 italic">
                    {getSoundTypeDescription(suggestion.type)}
                  </p>

                  {/* Source Pattern */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2">
                    <div className="text-xs font-medium text-slate-500">
                      Source pattern:
                    </div>
                    <p className="text-sm text-slate-700">
                      {suggestion.sourcePattern}
                    </p>
                  </div>

                  {/* Target Sound */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Target sound:
                    </span>
                    <Badge className={cn("text-white", 
                      suggestion.type === "alliteration" ? "bg-sky-600" :
                      suggestion.type === "assonance" ? "bg-rose-600" : "bg-amber-600"
                    )}>
                      {suggestion.targetSound}
                    </Badge>
                  </div>

                  {/* Current Text */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="text-xs font-medium text-slate-500 mb-2">
                      Your current line:
                    </div>
                    <p className="text-sm">{suggestion.currentText}</p>
                  </div>

                  {/* Analysis */}
                  {suggestion.analysis && (
                    <p className="text-sm text-slate-600">{suggestion.analysis}</p>
                  )}

                  {/* Sound Options */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">
                      Suggested alternatives:
                    </div>
                    <div className="space-y-2">
                      {suggestion.options.map((option, oidx) => (
                        <SoundOptionCard
                          key={oidx}
                          option={option}
                          type={suggestion.type}
                          onApply={() =>
                            onApplyOption(suggestion.lineIndex, option.text)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <Lightbulb className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800">
                      {suggestion.recommendation}
                    </p>
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
// Sound Option Card
// ============================================================================

interface SoundOptionCardProps {
  option: SoundOption;
  type: SoundPatternSuggestion["type"];
  onApply: () => void;
}

function SoundOptionCard({ option, type, onApply }: SoundOptionCardProps) {
  const soundIcon = type === "alliteration" ? "s" : type === "assonance" ? "o" : "t";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-slate-800">"{option.text}"</p>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs bg-slate-100 border-slate-300"
            >
              {option.soundCount}x "{soundIcon}" sound
            </Badge>
          </div>
          {option.note && (
            <p className="text-xs text-slate-500">{option.note}</p>
          )}
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
    </div>
  );
}
