"use client";

import React, { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RhythmSuggestion, RhythmAlternative } from "@/types/rhymeWorkshop";

interface RhythmWorkshopPanelProps {
  suggestions: RhythmSuggestion[];
  onApplyAlternative: (lineIndex: number, newText: string) => void;
  onDismiss: (suggestionIndex: number) => void;
  className?: string;
}

export function RhythmWorkshopPanel({
  suggestions,
  onApplyAlternative,
  onDismiss,
  className,
}: RhythmWorkshopPanelProps) {
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

  const getMatchLabel = (match: RhythmAlternative["match"]): string => {
    switch (match) {
      case "exact":
        return "Exact Match";
      case "close":
        return "Close Match";
      case "compressed":
        return "Compressed";
      case "expanded":
        return "Expanded";
      default:
        return match;
    }
  };

  const getMatchColor = (
    match: RhythmAlternative["match"]
  ): { bg: string; border: string; text: string } => {
    switch (match) {
      case "exact":
        return {
          bg: "bg-emerald-100",
          border: "border-emerald-300",
          text: "text-emerald-700",
        };
      case "close":
        return {
          bg: "bg-sky-100",
          border: "border-sky-300",
          text: "text-sky-700",
        };
      case "compressed":
        return {
          bg: "bg-amber-100",
          border: "border-amber-300",
          text: "text-amber-700",
        };
      case "expanded":
        return {
          bg: "bg-violet-100",
          border: "border-violet-300",
          text: "text-violet-700",
        };
      default:
        return {
          bg: "bg-slate-100",
          border: "border-slate-300",
          text: "text-slate-700",
        };
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Activity className="h-4 w-4 text-teal-600" />
        <span>Rhythm & Meter</span>
        <Badge variant="secondary" className="text-xs">
          {visibleSuggestions.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          if (dismissedSuggestions.has(idx)) return null;

          const isExpanded = expandedSuggestion === idx;
          const syllableDiff =
            suggestion.analysis.current.syllables -
            suggestion.analysis.source.syllables;

          return (
            <div
              key={idx}
              className="rounded-lg border border-teal-200 bg-teal-50/50 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedSuggestion(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between p-3 hover:bg-teal-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      syllableDiff === 0
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : syllableDiff > 0
                        ? "bg-amber-100 border-amber-300 text-amber-700"
                        : "bg-sky-100 border-sky-300 text-sky-700"
                    )}
                  >
                    {syllableDiff === 0
                      ? "Matched"
                      : syllableDiff > 0
                      ? `+${syllableDiff} syllables`
                      : `${syllableDiff} syllables`}
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
                  {/* Issue Description */}
                  <p className="text-sm text-slate-600">{suggestion.issue}</p>

                  {/* Side-by-side Comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Source */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">
                        Source
                      </div>
                      <p className="text-sm text-slate-700 mb-2">
                        "{suggestion.analysis.source.text}"
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-50 border-emerald-200"
                        >
                          {suggestion.analysis.source.syllables} syllables
                        </Badge>
                      </div>
                      <div className="mt-2 font-mono text-xs text-slate-500 break-all">
                        {suggestion.analysis.source.stress}
                      </div>
                    </div>

                    {/* Current Translation */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">
                        Your translation
                      </div>
                      <p className="text-sm text-slate-700 mb-2">
                        "{suggestion.analysis.current.text}"
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            syllableDiff === 0
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-amber-50 border-amber-200"
                          )}
                        >
                          {suggestion.analysis.current.syllables} syllables
                        </Badge>
                      </div>
                      <div className="mt-2 font-mono text-xs text-slate-500 break-all">
                        {suggestion.analysis.current.stress}
                      </div>
                    </div>
                  </div>

                  {/* Stress Pattern Legend */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      <strong>DUM</strong> = stressed syllable
                    </span>
                    <span>
                      <strong>da</strong> = unstressed syllable
                    </span>
                  </div>

                  {/* Alternatives */}
                  {suggestion.alternatives.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-500">
                        Suggested alternatives:
                      </div>
                      <div className="space-y-2">
                        {suggestion.alternatives.map((alt, aidx) => (
                          <RhythmAlternativeCard
                            key={aidx}
                            alternative={alt}
                            sourceSyllables={suggestion.analysis.source.syllables}
                            getMatchLabel={getMatchLabel}
                            getMatchColor={getMatchColor}
                            onApply={() =>
                              onApplyAlternative(suggestion.lineIndex, alt.text)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="flex items-start gap-2 p-3 bg-teal-100 rounded-lg border border-teal-200">
                    <Lightbulb className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-teal-800">
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
// Rhythm Alternative Card
// ============================================================================

interface RhythmAlternativeCardProps {
  alternative: RhythmAlternative;
  sourceSyllables: number;
  getMatchLabel: (match: RhythmAlternative["match"]) => string;
  getMatchColor: (
    match: RhythmAlternative["match"]
  ) => { bg: string; border: string; text: string };
  onApply: () => void;
}

function RhythmAlternativeCard({
  alternative,
  sourceSyllables,
  getMatchLabel,
  getMatchColor,
  onApply,
}: RhythmAlternativeCardProps) {
  const colors = getMatchColor(alternative.match);
  const syllableDiff = alternative.syllables - sourceSyllables;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs", colors.bg, colors.border, colors.text)}
            >
              {getMatchLabel(alternative.match)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {alternative.syllables} syllables
              {syllableDiff !== 0 && (
                <span className="ml-1 text-slate-400">
                  ({syllableDiff > 0 ? "+" : ""}
                  {syllableDiff})
                </span>
              )}
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-800">
            "{alternative.text}"
          </p>
          <div className="font-mono text-xs text-slate-500">
            {alternative.stress}
          </div>
          {alternative.note && (
            <p className="text-xs text-slate-500">{alternative.note}</p>
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
