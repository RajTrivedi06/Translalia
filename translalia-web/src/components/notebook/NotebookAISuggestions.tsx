"use client";

import * as React from "react";
import {
  Sparkles,
  Search,
  Wand2,
  Heart,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  RefreshCw,
  Lightbulb,
  AlertCircle,
  Music2,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useGuideStore } from "@/store/guideSlice";

import type {
  SuggestionStep,
  FormalFeaturesAnalysis,
  AdjustmentSuggestionsResponse,
  PersonalizedSuggestionsResponse,
  AdjustmentSuggestion,
  FormalFeature,
  PersonalizedSuggestion,
} from "@/types/notebookSuggestions";

interface NotebookAISuggestionsProps {
  /** Notes/diary content from the notebook */
  translationDiary?: string;
  /** Per-line notes */
  lineNotes?: Record<number, string>;
  /** Callback when an adjustment is applied */
  onApplyAdjustment?: (lineIndex: number, newText: string) => void;
  /** Additional class name */
  className?: string;
  /** Hide the header (when parent provides it, e.g. ReflectionRail) */
  hideHeader?: boolean;
}

export function NotebookAISuggestions({
  translationDiary,
  lineNotes,
  onApplyAdjustment,
  className,
  hideHeader = false,
}: NotebookAISuggestionsProps) {
  const threadId = useThreadId();
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const targetLanguage = useGuideStore((s) => s.answers.targetLanguage);
  const targetLanguageName = targetLanguage?.lang?.trim() || "English";

  // Selected lines for multi-line rhyme help
  const [selectedLines, setSelectedLines] = React.useState<Set<number>>(new Set());
  
  // State for each step
  const [formalFeatures, setFormalFeatures] =
    React.useState<FormalFeaturesAnalysis | null>(null);
  const [adjustments, setAdjustments] =
    React.useState<AdjustmentSuggestionsResponse | null>(null);
  const [personalized, setPersonalized] =
    React.useState<PersonalizedSuggestionsResponse | null>(null);

  // Loading and error states
  const [loading, setLoading] = React.useState<Record<SuggestionStep, boolean>>(
    {
      identify: false,
      adjust: false,
      personalize: false,
    }
  );
  const [errors, setErrors] = React.useState<
    Record<SuggestionStep, string | null>
  >({
    identify: null,
    adjust: null,
    personalize: null,
  });

  // Expanded sections - allow multiple to be open at once
  const [expandedSteps, setExpandedSteps] = React.useState<Set<SuggestionStep>>(
    () => new Set()
  );

  const toggleStepExpanded = React.useCallback((step: SuggestionStep) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  }, []);

  const expandStep = React.useCallback((step: SuggestionStep) => {
    setExpandedSteps((prev) => new Set(prev).add(step));
  }, []);

  // Build poems from state - use both completed and draft lines
  const sourcePoem = React.useMemo(() => poemLines.join("\n"), [poemLines]);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const translationPoem = React.useMemo(() => {
    return poemLines
      .map((_, idx) => {
        // Prefer completed, fall back to draft
        const completed = completedLines[idx];
        const draft = draftLines[idx];
        return completed || draft || "";
      })
      .join("\n");
  }, [poemLines, completedLines, draftLines]);

  // Check if there's enough translation to analyze (either completed or draft)
  const hasTranslation = React.useMemo(() => {
    const completedCount = Object.values(completedLines).filter(
      (line) => line && line.trim().length > 0
    ).length;
    const draftCount = Object.values(draftLines).filter(
      (line) => line && line.trim().length > 0
    ).length;
    return completedCount >= 1 || draftCount >= 1;
  }, [completedLines, draftLines]);

  // Toggle line selection
  const toggleLineSelection = React.useCallback((lineIndex: number) => {
    setSelectedLines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lineIndex)) {
        newSet.delete(lineIndex);
      } else {
        newSet.add(lineIndex);
      }
      return newSet;
    });
  }, []);

  // Select all lines
  const selectAllLines = React.useCallback(() => {
    const allIndices = new Set(poemLines.map((_, idx) => idx));
    setSelectedLines(allIndices);
  }, [poemLines]);

  // Clear selection
  const clearSelection = React.useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  // Fetch suggestions for a step. Returns the result data on success.
  const fetchSuggestions = React.useCallback(
    async (
      step: SuggestionStep,
      options?: { formalFeaturesOverride?: FormalFeaturesAnalysis }
    ) => {
      if (!threadId) return undefined;

      setLoading((prev) => ({ ...prev, [step]: true }));
      setErrors((prev) => ({ ...prev, [step]: null }));

      // For adjust step, include selected lines in the request
      const selectedLinesArray = Array.from(selectedLines).sort((a, b) => a - b);
      const featuresToUse =
        options?.formalFeaturesOverride ??
        (step === "adjust" || step === "personalize" ? formalFeatures : undefined);

      try {
        const response = await fetch("/api/notebook/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            step,
            sourcePoem,
            translationPoem,
            sourceLanguage: "source language",
            targetLanguage: targetLanguageName,
            translationDiary: step === "personalize" ? translationDiary : undefined,
            lineNotes: step === "personalize" ? lineNotes : undefined,
            formalFeatures: featuresToUse,
            // Include selected lines for coordinated rhyme suggestions
            selectedLines: step === "adjust" ? selectedLinesArray : undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error?.message || "Failed to get suggestions");
        }

        // Update state based on step
        switch (step) {
          case "identify":
            setFormalFeatures(data.formalFeatures);
            break;
          case "adjust":
            setAdjustments(data.adjustments);
            break;
          case "personalize":
            setPersonalized(data.personalized);
            break;
        }

        expandStep(step);
        return data;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Something went wrong";
        setErrors((prev) => ({ ...prev, [step]: message }));
        return undefined;
      } finally {
        setLoading((prev) => ({ ...prev, [step]: false }));
      }
    },
    [
      threadId,
      sourcePoem,
      translationPoem,
      targetLanguageName,
      translationDiary,
      lineNotes,
      formalFeatures,
      selectedLines,
    ]
  );

  if (!hasTranslation) {
    return null;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl">
            <Music2 className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Refine & Rhyme</h3>
            <p className="text-sm text-slate-500">
              Get help making your translation rhyme
            </p>
          </div>
        </div>
      )}

      {/* Line Selection Section */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Which lines need to rhyme together?
          </h4>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllLines}
              className="text-xs h-7"
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-xs h-7"
              disabled={selectedLines.size === 0}
            >
              Clear
            </Button>
          </div>
        </div>
        
        <p className="text-xs text-slate-500 mb-3">
          Select the lines you want help with. We'll give you coordinated suggestions so they rhyme together.
        </p>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {poemLines.map((sourceLine, idx) => {
            const translatedLine = completedLines[idx] || draftLines[idx] || "";
            const isSelected = selectedLines.has(idx);
            const hasTranslation = translatedLine.trim().length > 0;

            return (
              <button
                key={idx}
                onClick={() => toggleLineSelection(idx)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                  isSelected
                    ? "bg-violet-100 border-2 border-violet-400"
                    : "bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-violet-600" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      Line {idx + 1}
                    </Badge>
                    {!hasTranslation && (
                      <Badge variant="secondary" className="text-xs text-amber-600 bg-amber-50">
                        No translation yet
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block">Source:</span>
                      <span className="text-slate-600 line-clamp-1">{sourceLine}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Your translation:</span>
                      <span className={cn(
                        "line-clamp-1",
                        hasTranslation ? "text-slate-800" : "text-slate-400 italic"
                      )}>
                        {hasTranslation ? translatedLine : "Not translated yet"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedLines.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                <strong>{selectedLines.size}</strong> line{selectedLines.size !== 1 ? "s" : ""} selected
              </span>
              <Badge className="bg-violet-600">
                Lines {Array.from(selectedLines).sort((a, b) => a - b).map(l => l + 1).join(", ")}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Step 1: Identify Rhyme Scheme */}
      <SuggestionPromptCard
        icon={Search}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
        prompt="First, let me identify the rhyme scheme of your source text. I'll show you which lines rhyme and what sounds to use."
        buttonText="Analyze the rhyme scheme"
        isLoading={loading.identify}
        error={errors.identify}
        hasResult={!!formalFeatures}
        isExpanded={expandedSteps.has("identify")}
        onToggleExpand={() => toggleStepExpanded("identify")}
        onAction={() => fetchSuggestions("identify")}
        onRetry={() => fetchSuggestions("identify")}
      >
        {formalFeatures && (
          <FormalFeaturesDisplay features={formalFeatures} />
        )}
      </SuggestionPromptCard>

      {/* Step 2: Suggest Rhyme Adjustments - always visible, clickable when lines selected */}
      <SuggestionPromptCard
        icon={Wand2}
        iconColor="text-violet-600"
        iconBg="bg-violet-50"
        prompt={
          selectedLines.size > 0
            ? `Now I'll suggest how to make your ${selectedLines.size} selected line${selectedLines.size !== 1 ? "s" : ""} rhyme together.`
            : "Select lines above, then I'll suggest how to make them rhyme together."
        }
        buttonText={
          selectedLines.size > 0
            ? `Get rhyme suggestions for ${selectedLines.size} line${selectedLines.size !== 1 ? "s" : ""}`
            : "Get rhyme suggestions"
        }
        isLoading={loading.identify || loading.adjust}
        error={errors.adjust}
        hasResult={!!adjustments}
        isExpanded={expandedSteps.has("adjust")}
        onToggleExpand={() => toggleStepExpanded("adjust")}
        onAction={async () => {
          if (selectedLines.size === 0) return;
          let features = formalFeatures;
          if (!features) {
            const identifyData = await fetchSuggestions("identify");
            features = identifyData?.formalFeatures;
            if (!features) return;
          }
          await fetchSuggestions("adjust", { formalFeaturesOverride: features });
        }}
        onRetry={() => fetchSuggestions("adjust")}
        disabled={selectedLines.size === 0}
      >
        {adjustments && (
          <AdjustmentsDisplay
            adjustments={adjustments}
            onApply={onApplyAdjustment}
          />
        )}
      </SuggestionPromptCard>

      {/* Step 3: Personalized Suggestions (only if step 1 complete) */}
      {formalFeatures && (
        <SuggestionPromptCard
          icon={Heart}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
          prompt="Want more ideas? I'll look at your translation diary and give you personalized suggestions for your rhyming choices."
          buttonText="Give me personalized ideas"
          isLoading={loading.personalize}
          error={errors.personalize}
          hasResult={!!personalized}
          isExpanded={expandedSteps.has("personalize")}
          onToggleExpand={() => toggleStepExpanded("personalize")}
          onAction={() => fetchSuggestions("personalize")}
          onRetry={() => fetchSuggestions("personalize")}
        >
          {personalized && (
            <PersonalizedDisplay personalized={personalized} />
          )}
        </SuggestionPromptCard>
      )}
    </div>
  );
}

// ============================================================================
// Suggestion Prompt Card
// ============================================================================

interface SuggestionPromptCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  prompt: string;
  buttonText: string;
  isLoading: boolean;
  error: string | null;
  hasResult: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAction: () => void;
  onRetry: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

function SuggestionPromptCard({
  icon: Icon,
  iconColor,
  iconBg,
  prompt,
  buttonText,
  isLoading,
  error,
  hasResult,
  isExpanded,
  onToggleExpand,
  onAction,
  onRetry,
  disabled,
  children,
}: SuggestionPromptCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Prompt Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">{prompt}</p>

            {/* Action button or status */}
            <div className="mt-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              ) : error ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try again
                  </Button>
                </div>
              ) : hasResult ? (
                <button
                  onClick={onToggleExpand}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Done! Click to {isExpanded ? "hide" : "show"} results</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAction}
                  disabled={disabled}
                  className={cn(
                    "bg-slate-50 hover:bg-slate-100",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {buttonText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Results */}
      {hasResult && isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Formal Features Display
// ============================================================================

function FormalFeaturesDisplay({
  features,
}: {
  features: FormalFeaturesAnalysis;
}) {
  return (
    <div className="space-y-4">
      {/* Rhyme Scheme */}
      {features.rhymeScheme && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-600 text-lg px-3 py-1">
              {features.rhymeScheme}
            </Badge>
            <span className="text-sm font-medium text-slate-700">Rhyme Scheme</span>
          </div>
          {features.rhymeSchemeDescription && (
            <p className="text-sm text-slate-600 pl-2 border-l-2 border-violet-200">
              {features.rhymeSchemeDescription}
            </p>
          )}
        </div>
      )}

      {!features.rhymeScheme && (
        <p className="text-sm text-slate-500 italic">
          No rhyme scheme detected in the source poem. You can still add rhymes to your translation!
        </p>
      )}

      {/* Other Features */}
      {features.otherFeatures.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Other Sound Patterns
          </h4>
          {features.otherFeatures.map((feature, idx) => (
            <FeatureCard key={idx} feature={feature} />
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 p-3 bg-violet-50 rounded-lg border border-violet-100">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-violet-600 mt-0.5" />
          <p className="text-sm text-violet-800">{features.summary}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: FormalFeature }) {
  const getFeatureColor = (type: FormalFeature["type"]) => {
    switch (type) {
      case "alliteration":
        return "bg-sky-100 text-sky-700";
      case "repetition":
        return "bg-amber-100 text-amber-700";
      case "anaphora":
        return "bg-violet-100 text-violet-700";
      case "assonance":
        return "bg-rose-100 text-rose-700";
      case "consonance":
        return "bg-teal-100 text-teal-700";
      case "meter":
        return "bg-emerald-100 text-emerald-700";
      case "sentence_structure":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={getFeatureColor(feature.type)}>
          {feature.name}
        </Badge>
        {feature.lineNumbers && feature.lineNumbers.length > 0 && (
          <span className="text-xs text-slate-400">
            Lines {feature.lineNumbers.map((n) => n + 1).join(", ")}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-2">{feature.description}</p>
      {feature.examples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {feature.examples.map((ex, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 bg-slate-100 rounded font-mono"
            >
              "{ex}"
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Adjustments Display
// ============================================================================

function AdjustmentsDisplay({
  adjustments,
  onApply,
}: {
  adjustments: AdjustmentSuggestionsResponse;
  onApply?: (lineIndex: number, newText: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Feasibility */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          adjustments.imitationFeasibility === "full"
            ? "bg-emerald-50 border-emerald-200"
            : adjustments.imitationFeasibility === "partial"
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-200"
        )}
      >
        <p className="text-sm">
          <span className="font-medium">
            {adjustments.imitationFeasibility === "full"
              ? "Great news! "
              : adjustments.imitationFeasibility === "partial"
              ? "Here's how to get close: "
              : "Some creative options: "}
          </span>
          {adjustments.feasibilityExplanation || adjustments.generalGuidance}
        </p>
      </div>

      {/* Adjustments */}
      {adjustments.adjustments.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Suggested Changes
          </h4>
          {adjustments.adjustments.map((adj, idx) => (
            <AdjustmentCard key={idx} adjustment={adj} onApply={onApply} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">
          No specific adjustments suggested. Try selecting different lines.
        </p>
      )}
    </div>
  );
}

function AdjustmentCard({
  adjustment,
  onApply,
}: {
  adjustment: AdjustmentSuggestion;
  onApply?: (lineIndex: number, newText: string) => void;
}) {
  const getDifficultyColor = (difficulty: AdjustmentSuggestion["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "bg-emerald-100 text-emerald-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "challenging":
        return "bg-red-100 text-red-700";
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-violet-50 border-violet-200">
            Line{adjustment.targetLines.length > 1 ? "s" : ""} {adjustment.targetLines.map((n) => n + 1).join(", ")}
          </Badge>
          <Badge variant="outline" className={getDifficultyColor(adjustment.difficulty)}>
            {adjustment.difficulty}
          </Badge>
        </div>
        {onApply && adjustment.targetLines.length === 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onApply(adjustment.targetLines[0], adjustment.suggestedText)
            }
            className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          >
            <Check className="h-3 w-3 mr-1" />
            Apply this
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        <div className="p-3 bg-slate-100 rounded-lg text-sm">
          <span className="text-xs text-slate-500 block mb-1">Current:</span>
          <span className="text-slate-600">{adjustment.currentText}</span>
        </div>
        <div className="p-3 bg-violet-50 rounded-lg text-sm border-2 border-violet-200">
          <span className="text-xs text-violet-600 block mb-1">Try this instead:</span>
          <span className="text-violet-900 font-medium text-base">
            {adjustment.suggestedText}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600">{adjustment.explanation}</p>

      {adjustment.tradeOff && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
          <span className="font-medium">Note:</span> {adjustment.tradeOff}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Personalized Display
// ============================================================================

function PersonalizedDisplay({
  personalized,
}: {
  personalized: PersonalizedSuggestionsResponse;
}) {
  return (
    <div className="space-y-4">
      {/* Insight */}
      <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-200">
        <p className="text-sm text-rose-800 mb-3">
          {personalized.insight.observation}
        </p>
        {personalized.insight.interests.length > 0 && (
          <div className="mb-2">
            <span className="text-xs font-medium text-rose-600">
              What interests you:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {personalized.insight.interests.map((interest, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs bg-white border-rose-200"
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {personalized.insight.aims.length > 0 && (
          <div>
            <span className="text-xs font-medium text-rose-600">
              What you're trying to achieve:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {personalized.insight.aims.map((aim, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs bg-white border-rose-200"
                >
                  {aim}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {personalized.suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Ideas for You
          </h4>
          {personalized.suggestions.map((suggestion, idx) => (
            <PersonalizedSuggestionCard key={idx} suggestion={suggestion} index={idx} />
          ))}
        </div>
      )}

      {/* Encouragement */}
      <div className="p-3 bg-gradient-to-r from-purple-50 to-rose-50 rounded-xl border border-purple-100">
        <div className="flex items-start gap-2">
          <Heart className="h-4 w-4 text-rose-500 mt-0.5" />
          <p className="text-sm text-slate-700">{personalized.encouragement}</p>
        </div>
      </div>
    </div>
  );
}

function PersonalizedSuggestionCard({
  suggestion,
  index,
}: {
  suggestion: PersonalizedSuggestion;
  index: number;
}) {
  const [expanded, setExpanded] = React.useState(index === 0);

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center justify-center">
            {index + 1}
          </span>
          <span className="font-medium text-sm text-slate-800">
            {suggestion.title}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 pl-8 space-y-2">
          <p className="text-sm text-slate-600">{suggestion.description}</p>
          <p className="text-sm text-purple-700">
            <span className="font-medium">Why this might work for you:</span>{" "}
            {suggestion.rationale}
          </p>
          {suggestion.focusArea && (
            <p className="text-xs text-slate-500">
              <span className="font-medium">Focus on:</span>{" "}
              {suggestion.focusArea}
            </p>
          )}
          {suggestion.howTo && (
            <p className="text-xs text-slate-500">
              <span className="font-medium">How to start:</span>{" "}
              {suggestion.howTo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
