"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ReflectionHeader } from "@/components/reflection-rail/ReflectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen, Lightbulb, CheckCircle2 } from "lucide-react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useNotebookStore } from "@/store/notebookSlice";
import { CongratulationsModal } from "@/components/workshop/CongratulationsModal";

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
  const guideAnswers = useGuideStore((s) => s.answers);
  const threadNote = useNotebookStore((s) => s.threadNote);
  const lineNotes = useNotebookStore((s) => s.lineNotes);

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

    console.log('[ReflectionRail] State reset for thread:', threadId);
  }, [threadId]);

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

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Introduction */}
          <div className="space-y-2">
            <p className="text-slate-600 text-sm leading-relaxed">
              {t("reflectionDescription")}
            </p>
            {completedCount === 0 && (
              <p className="text-amber-600 text-sm">
                Complete at least one translation line to unlock reflection
                features.
              </p>
            )}
          </div>

          {/* AI Assist Step C: Contextual Suggestions */}
          <Card className="p-4 border-blue-200 bg-blue-50/30">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">
                    Translation Insights
                  </h3>
                </div>
                {hasNotes && (
                  <Badge variant="outline" className="text-xs">
                    Notes included
                  </Badge>
                )}
              </div>

              <p className="text-sm text-slate-600">
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
                <p className="text-sm text-red-600">{errorSuggestions}</p>
              )}

              {aiSuggestions && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      Your Translation Aims:
                    </h4>
                    <p className="text-sm text-slate-600">{aiSuggestions.aims}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Suggestions:
                    </h4>
                    {aiSuggestions.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-lg border border-slate-200"
                      >
                        <h5 className="font-medium text-slate-900 mb-1">
                          {idx + 1}. {suggestion.title}
                        </h5>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
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
          </Card>

          {/* Journey Summary */}
          <Card className="p-4 border-purple-200 bg-purple-50/30">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-slate-900">
                  Journey Summary
                </h3>
              </div>

              <p className="text-sm text-slate-600">
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
                <p className="text-sm text-red-600">{errorJourney}</p>
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
                              <div className="p-3 bg-white rounded-lg border border-purple-200">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">
                                  Key Insights:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                  {journeyReflection.insights.map(
                                    (insight, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-purple-500 mt-1">
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
                              <div className="p-3 bg-white rounded-lg border border-green-200">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">
                                  Strengths:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                  {journeyReflection.strengths.map(
                                    (strength, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-green-500 mt-1">
                                          ✓
                                        </span>
                                        <span>{strength}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {journeyReflection.challenges &&
                            journeyReflection.challenges.length > 0 && (
                              <div className="p-3 bg-white rounded-lg border border-orange-200">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">
                                  Challenges:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                  {journeyReflection.challenges.map(
                                    (challenge, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-orange-500 mt-1">
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
                              <div className="p-3 bg-white rounded-lg border border-amber-200">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">
                                  To Explore Further:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                  {journeyReflection.recommendations.map(
                                    (rec, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-amber-500 mt-1">
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
                        <div className="p-3 bg-white rounded-lg border border-purple-200">
                          <div className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
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
          </Card>

          {/* Finish Button - Show when all lines are completed */}
          {allLinesCompleted && (
            <Card className="p-4 border-green-200 bg-green-50/30">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-slate-900">
                    {t("translationComplete")}
                  </h3>
                </div>
                <p className="text-sm text-slate-600">
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
          <div className="text-xs text-slate-500 space-y-1">
            <p>
              💡 <strong>Tip:</strong> Add notes to your translation for more
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
