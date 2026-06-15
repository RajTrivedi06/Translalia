"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ReflectionHeader } from "@/components/reflection-rail/ReflectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen, Lightbulb, CheckCircle2, Music2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useNotebookStore } from "@/store/notebookSlice";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";
import { NotebookAISuggestions } from "@/components/notebook/NotebookAISuggestions";
import { useNotebookNotes } from "@/lib/hooks/useNotebookNotes";

interface ReflectionRailProps {
  showHeaderTitle?: boolean;
}

interface AISuggestion {
  title: string;
  description: string;
  lineReferences?: number[];
}

interface AIAssistStepCResponse {
  aims: string;
  suggestions: AISuggestion[];
  confidence?: number;
}

interface JourneyReflection {
  insights: string[];
  strengths: string[];
  challenges: string[];
  recommendations: string[];
  reflection?: string; // Optional narrative text
}

export function ReflectionRail({
  showHeaderTitle = true,
}: ReflectionRailProps) {
  const t = useTranslations("Thread");
  const params = useParams();
  const threadId = params?.threadId as string;

  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const setDraft = useWorkshopStore((s) => s.setDraft);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);
  const guideAnswers = useGuideStore((s) => s.answers);
  const threadNote = useNotebookStore((s) => s.threadNote);
  const lineNotes = useNotebookStore((s) => s.lineNotes);
  const { data: notebookNotes } = useNotebookNotes();

  const [aiSuggestions, setAISuggestions] =
    React.useState<AIAssistStepCResponse | null>(null);
  const [journeyReflection, setJourneyReflection] =
    React.useState<JourneyReflection | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const [loadingJourney, setLoadingJourney] = React.useState(false);
  const [errorSuggestions, setErrorSuggestions] = React.useState<string | null>(
    null
  );
  const [errorJourney, setErrorJourney] = React.useState<string | null>(null);
  const [showCongratulations, setShowCongratulations] = React.useState(false);
  const [showRefineRhyme, setShowRefineRhyme] = React.useState(false);
  const [showInsights, setShowInsights] = React.useState(true);
  const [showJourney, setShowJourney] = React.useState(true);
  const completedCount = Object.keys(completedLines).length;
  const allLinesCompleted = completedCount === poemLines.length && poemLines.length > 0;
  const hasNotes =
    !!threadNote ||
    Object.keys(lineNotes).filter((k) => lineNotes[parseInt(k)]).length > 0;

  // Reset all local state when switching workshops to prevent data leakage
  React.useEffect(() => {
    // Clear insights data
    setAISuggestions(null);
    setJourneyReflection(null);

    // Clear error states
    setErrorSuggestions(null);
    setErrorJourney(null);

    // Reset loading states
    setLoadingSuggestions(false);
    setLoadingJourney(false);

    // Reset collapse state
    setShowRefineRhyme(false);
    setShowInsights(true);
    setShowJourney(true);

    console.log('[ReflectionRail] State reset for thread:', threadId);
  }, [threadId]);

  // Handler for applying AI suggestion adjustments
  const handleApplyAdjustment = React.useCallback(
    (lineIndex: number, newText: string) => {
      setDraft(lineIndex, newText);
      setCurrentLineIndex(lineIndex);
    },
    [setDraft, setCurrentLineIndex]
  );

  const handleGetAISuggestions = async () => {
    if (!threadId || completedCount === 0) return;

    setLoadingSuggestions(true);
    setErrorSuggestions(null);

    try {
      const response = await fetch("/api/reflection/ai-assist-step-c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get AI suggestions");
      }

      const data: AIAssistStepCResponse = await response.json();
      setAISuggestions(data);
    } catch (error) {
      console.error("[ReflectionRail] AI suggestions error:", error);
      setErrorSuggestions(
        error instanceof Error ? error.message : "Failed to load suggestions"
      );
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleGetJourneyReflection = async () => {
    if (!threadId || completedCount === 0) return;

    setLoadingJourney(true);
    setErrorJourney(null);

    try {
      const response = await fetch("/api/journey/generate-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          context: {
            poemLines,
            completedLines,
            totalLines: poemLines.length,
            completedCount,
            guideAnswers,
            translationZone: guideAnswers.translationZone,
            translationIntent: guideAnswers.translationIntent,
            progressPercentage: Math.round(
              (completedCount / poemLines.length) * 100
            ),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get journey reflection");
      }

      const data = await response.json();
      console.log("[Journey] API response:", data);
      console.log("[Journey] reflection data:", data.reflection);
      setJourneyReflection(data.reflection);
    } catch (error) {
      console.error("[ReflectionRail] Journey reflection error:", error);
      setErrorJourney(
        error instanceof Error
          ? error.message
          : "Failed to load journey reflection"
      );
    } finally {
      setLoadingJourney(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {showHeaderTitle && <ReflectionHeader showTitle={showHeaderTitle} />}

      <div className="flex-1 overflow-y-auto p-4 pt-2">
        <div className="space-y-6">
          {completedCount === 0 && (
            <p className="text-warning text-sm">
              Complete at least one translation line to unlock reflection
              features.
            </p>
          )}

          {/* Refine & Rhyme - Rhyme Workshop */}
          <Card className="p-4 border-card-teal-border bg-card-teal-bg/30">
            <div className="space-y-3">
              <button
                onClick={() => setShowRefineRhyme(!showRefineRhyme)}
                className="w-full flex items-center justify-between"
                aria-expanded={showRefineRhyme}
                aria-controls="refine-rhyme-content"
              >
                <div className="flex items-center gap-2">
                  <Music2 className="h-5 w-5 text-success" />
                  <h3 className="font-semibold text-foreground">
                    Refine & Rhyme
                  </h3>
                </div>
                {showRefineRhyme ? (
                  <ChevronUp className="h-4 w-4 text-success" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-success" />
                )}
              </button>

              <p className="text-sm text-foreground-muted">
                Get help making your translation rhyme
              </p>

              {showRefineRhyme && completedCount > 0 && (
                <div id="refine-rhyme-content" className="mt-4 pt-4 border-t border-card-teal-border">
                  <NotebookAISuggestions
                    translationDiary={notebookNotes?.threadNote || undefined}
                    lineNotes={notebookNotes?.lineNotes}
                    onApplyAdjustment={handleApplyAdjustment}
                    hideHeader
                  />
                </div>
              )}

              {showRefineRhyme && completedCount === 0 && (
                <p className="text-sm text-warning mt-2">
                  Complete at least one translation line to use this feature.
                </p>
              )}
            </div>
          </Card>

          {/* AI Assist Step C: Contextual Suggestions */}
          <Card className="p-4 border-card-blue-border bg-card-blue-bg/30">
            <div className="space-y-3">
              <button
                onClick={() => setShowInsights(!showInsights)}
                className="w-full flex items-center justify-between"
                aria-expanded={showInsights}
                aria-controls="insights-content"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-foreground">
                    Translation Insights
                  </h3>
                  {hasNotes && (
                    <Badge variant="outline" className="text-xs">
                      Notes included
                    </Badge>
                  )}
                </div>
                {showInsights ? (
                  <ChevronUp className="h-4 w-4 text-accent" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-accent" />
                )}
              </button>

              {showInsights && (
                <div id="insights-content" className="space-y-3">
              <p className="text-sm text-foreground-muted">
                Get personalized suggestions based on your translation choices
                and notes.
              </p>

              <Button
                onClick={handleGetAISuggestions}
                disabled={completedCount === 0 || loadingSuggestions}
                className="w-full"
                variant="default"
              >
                {loadingSuggestions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get AI Suggestions
                  </>
                )}
              </Button>

              {errorSuggestions && (
                <p className="text-sm text-error">{errorSuggestions}</p>
              )}

              {aiSuggestions && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-surface rounded-lg border border-card-blue-border">
                    <h4 className="text-sm font-medium text-foreground-secondary mb-2">
                      Your Translation Aims:
                    </h4>
                    <p className="text-sm text-foreground-muted">{aiSuggestions.aims}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground-secondary">
                      Suggestions:
                    </h4>
                    {aiSuggestions.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-surface rounded-lg border border-border-subtle"
                      >
                        <h5 className="font-medium text-foreground mb-1">
                          {idx + 1}. {suggestion.title}
                        </h5>
                        <p className="text-sm text-foreground-muted whitespace-pre-wrap">
                          {suggestion.description}
                        </p>
                        {suggestion.lineReferences &&
                          suggestion.lineReferences.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {suggestion.lineReferences.map((lineIdx) => (
                                <Badge
                                  key={lineIdx}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  Line {lineIdx + 1}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          </Card>

          {/* Journey Summary */}
          <Card className="p-4 border-card-purple-border bg-card-purple-bg/30">
            <div className="space-y-3">
              <button
                onClick={() => setShowJourney(!showJourney)}
                className="w-full flex items-center justify-between"
                aria-expanded={showJourney}
                aria-controls="journey-content"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-foreground">
                    Journey Summary
                  </h3>
                </div>
                {showJourney ? (
                  <ChevronUp className="h-4 w-4 text-accent" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-accent" />
                )}
              </button>

              {showJourney && (
                <div id="journey-content" className="space-y-3">
              <p className="text-sm text-foreground-muted">
                Reflect on your translation process, growth, and creative
                decisions.
              </p>

              <Button
                onClick={handleGetJourneyReflection}
                disabled={completedCount === 0 || loadingJourney}
                className="w-full"
                variant="outline"
              >
                {loadingJourney ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Generate Journey Summary
                  </>
                )}
              </Button>

              {errorJourney && (
                <p className="text-sm text-error">{errorJourney}</p>
              )}

              {journeyReflection && (
                <div className="mt-4 space-y-4">
                  {(() => {
                    const hasBullets =
                      (journeyReflection?.insights?.length ?? 0) +
                      (journeyReflection?.strengths?.length ?? 0) +
                      (journeyReflection?.challenges?.length ?? 0) +
                      (journeyReflection?.recommendations?.length ?? 0) >
                      0;

                    if (hasBullets) {
                      return (
                        <>
                          {journeyReflection.insights &&
                            journeyReflection.insights.length > 0 && (
                              <div className="p-3 bg-surface rounded-lg border border-card-purple-border">
                                <h4 className="text-sm font-medium text-foreground-secondary mb-2">
                                  Key Insights:
                                </h4>
                                <ul className="space-y-1 text-sm text-foreground-muted">
                                  {journeyReflection.insights.map(
                                    (insight, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-accent mt-1">
                                          •
                                        </span>
                                        <span>{insight}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {journeyReflection.strengths &&
                            journeyReflection.strengths.length > 0 && (
                              <div className="p-3 bg-surface rounded-lg border border-card-green-border">
                                <h4 className="text-sm font-medium text-foreground-secondary mb-2">
                                  Strengths:
                                </h4>
                                <ul className="space-y-1 text-sm text-foreground-muted">
                                  {journeyReflection.strengths.map(
                                    (strength, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                                        <span>{strength}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {journeyReflection.challenges &&
                            journeyReflection.challenges.length > 0 && (
                              <div className="p-3 bg-surface rounded-lg border border-card-orange-border">
                                <h4 className="text-sm font-medium text-foreground-secondary mb-2">
                                  Challenges:
                                </h4>
                                <ul className="space-y-1 text-sm text-foreground-muted">
                                  {journeyReflection.challenges.map(
                                    (challenge, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-warning mt-1">
                                          !
                                        </span>
                                        <span>{challenge}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {journeyReflection.recommendations &&
                            journeyReflection.recommendations.length > 0 && (
                              <div className="p-3 bg-surface rounded-lg border border-card-amber-border">
                                <h4 className="text-sm font-medium text-foreground-secondary mb-2">
                                  To Explore Further:
                                </h4>
                                <ul className="space-y-1 text-sm text-foreground-muted">
                                  {journeyReflection.recommendations.map(
                                    (rec, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-warning mt-1">
                                          →
                                        </span>
                                        <span>{rec}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </>
                      );
                    } else {
                      // Fallback: show narrative text if arrays are empty
                      return (
                        <div className="p-3 bg-surface rounded-lg border border-card-purple-border">
                          <div className="whitespace-pre-wrap text-sm text-foreground-muted leading-relaxed">
                            {journeyReflection.reflection ||
                              "No reflection text returned."}
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
                </div>
              )}
            </div>
          </Card>

          {/* Finish Button - Show when all lines are completed */}
          {allLinesCompleted && (
            <Card className="p-4 border-card-green-border bg-card-green-bg/30">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <h3 className="font-semibold text-foreground">
                    {t("translationComplete")}
                  </h3>
                </div>
                <p className="text-sm text-foreground-muted">
                  {t("translationCompleteDescription", {
                    count: poemLines.length,
                  })}
                </p>
                <Button
                  onClick={() => setShowCongratulations(true)}
                  className="w-full"
                  variant="default"
                  size="lg"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {t("finish")}
                </Button>
              </div>
            </Card>
          )}

          {/* Help text */}
          <div className="text-xs text-foreground-muted space-y-1">
            <p>
              <Lightbulb className="inline w-3.5 h-3.5 mr-1 flex-shrink-0" /> <strong>Tip:</strong> Add notes to your translation for more
              personalized insights.
            </p>
            <p>
              Progress: {completedCount} of {poemLines.length} lines completed
            </p>
          </div>
        </div>
      </div>

      {/* Congratulations Modal */}
      <CongratulationsModal
        open={showCongratulations}
        onClose={() => setShowCongratulations(false)}
        totalLines={poemLines.length}
      />
    </div>
  );
}
