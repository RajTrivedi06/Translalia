"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  BookOpen,
  Copy,
  Download,
  Check,
  Loader2,
  Clock,
  TrendingUp,
} from "lucide-react";

export interface JourneySummaryProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

interface JourneyReflection {
  summary: string;
  insights: string[];
  strengths: string[];
  challenges: string[];
  recommendations: string[];
  overallAssessment: string;
}

/**
 * JourneySummary - AI-generated reflection on the translation journey
 *
 * Features:
 * - "Generate Journey" button to trigger AI analysis
 * - AI reflection on translation process (NOT comparison)
 * - Insights about decisions made
 * - Strengths and challenges identified
 * - Recommendations for future translations
 * - Save/export summary option
 * - Loading states with progress indication
 */
export function JourneySummary({ open, onOpenChange }: JourneySummaryProps) {
  const threadId = useThreadId();
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const guideAnswers = useGuideStore((s) => s.answers);
  const translationIntent = useGuideStore(
    (s) => s.translationIntent.text ?? null
  );

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [journeyData, setJourneyData] =
    React.useState<JourneyReflection | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const totalLines = poemLines.length;
  const completedCount = Object.keys(completedLines).length;
  const progressPercentage =
    totalLines > 0 ? Math.round((completedCount / totalLines) * 100) : 0;

  const handleGenerateJourney = async () => {
    if (!threadId) {
      setError("No thread ID available");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Prepare journey data for AI
      const journeyContext = {
        poemLines,
        completedLines,
        totalLines,
        completedCount,
        guideAnswers,
        translationIntent,
        progressPercentage,
      };

      // Call AI API for journey reflection
      const response = await fetch("/api/journey/generate-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          context: journeyContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate journey summary");
      }

      const data = await response.json();
      setJourneyData(data.reflection);
    } catch (err) {
      console.error("[JourneySummary] Generation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate journey summary"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!journeyData) return;

    const text = formatJourneyForExport(journeyData, {
      includeMetadata: false,
      format: "plain",
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExport = () => {
    if (!journeyData) return;

    const text = formatJourneyForExport(journeyData, {
      includeMetadata: true,
      format: "markdown",
    });

    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journey-summary-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            Translation Journey Summary
          </DialogTitle>
          <DialogDescription>
            Reflect on your translation process with AI-generated insights
          </DialogDescription>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4">
          {!journeyData && !isGenerating && !error && (
            <EmptyJourneyState
              completedCount={completedCount}
              totalLines={totalLines}
              progressPercentage={progressPercentage}
              onGenerate={handleGenerateJourney}
            />
          )}

          {isGenerating && <LoadingJourneyState />}

          {error && (
            <ErrorJourneyState error={error} onRetry={handleGenerateJourney} />
          )}

          {journeyData && !isGenerating && (
            <JourneyContent journey={journeyData} />
          )}
        </div>

        {/* Footer Actions */}
        {journeyData && (
          <DialogFooter className="border-t pt-4">
            <div className="flex items-center gap-2 w-full justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateJourney}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Empty state - Before journey is generated
 */
function EmptyJourneyState({
  completedCount,
  totalLines,
  progressPercentage,
  onGenerate,
}: {
  completedCount: number;
  totalLines: number;
  progressPercentage: number;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-purple-600" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Generate Your Translation Journey
      </h3>
      <p className="text-sm text-gray-600 max-w-md mb-6">
        AI will reflect on your translation process, analyzing the decisions you
        made, the challenges you faced, and the strengths of your approach.
      </p>

      {/* Progress Summary */}
      <Card className="p-4 mb-6 max-w-sm w-full bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">Translation Progress</span>
            <Badge variant="secondary">{progressPercentage}%</Badge>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">
            {completedCount} of {totalLines} lines completed
          </div>
        </div>
      </Card>

      <Button
        onClick={onGenerate}
        size="lg"
        disabled={completedCount === 0}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        Generate Journey Summary
      </Button>

      {completedCount === 0 && (
        <p className="text-xs text-amber-600 mt-4">
          Complete at least one line to generate a journey summary
        </p>
      )}
    </div>
  );
}

/**
 * Loading state - While AI is generating
 */
function LoadingJourneyState() {
  const [loadingMessage, setLoadingMessage] = React.useState(
    "Analyzing your translation journey..."
  );

  React.useEffect(() => {
    const messages = [
      "Analyzing your translation journey...",
      "Reviewing your word choices...",
      "Examining your creative decisions...",
      "Identifying patterns and insights...",
      "Crafting your personalized summary...",
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-6" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Generating Journey Summary
      </h3>
      <p className="text-sm text-gray-600 animate-pulse">{loadingMessage}</p>
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-4 h-4" />
        <span>This usually takes 10-20 seconds</span>
      </div>
    </div>
  );
}

/**
 * Error state - If generation fails
 */
function ErrorJourneyState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Generation Failed
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md">{error}</p>
      <Button onClick={onRetry} variant="outline">
        Try Again
      </Button>
    </div>
  );
}

/**
 * Journey content display
 */
function JourneyContent({ journey }: { journey: JourneyReflection }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-600" />
          Summary
        </h4>
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50">
          <p className="text-sm text-gray-800 leading-relaxed">
            {journey.summary}
          </p>
        </Card>
      </section>

      {/* Insights */}
      {journey.insights && journey.insights.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Key Insights
          </h4>
          <div className="space-y-2">
            {journey.insights.map((insight, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-700">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 flex-1">{insight}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Strengths */}
      {journey.strengths && journey.strengths.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Strengths
          </h4>
          <div className="space-y-2">
            {journey.strengths.map((strength, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200"
              >
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{strength}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Challenges */}
      {journey.challenges && journey.challenges.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Challenges Addressed
          </h4>
          <div className="space-y-2">
            {journey.challenges.map((challenge, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-600 flex-shrink-0 mt-2" />
                <p className="text-sm text-gray-700">{challenge}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {journey.recommendations && journey.recommendations.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Recommendations for Future Translations
          </h4>
          <div className="space-y-2">
            {journey.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200"
              >
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{rec}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Overall Assessment */}
      {journey.overallAssessment && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Overall Assessment
          </h4>
          <Card className="p-4 bg-gradient-to-r from-purple-50 via-blue-50 to-green-50 border-purple-200">
            <p className="text-sm text-gray-800 leading-relaxed italic">
              &ldquo;{journey.overallAssessment}&rdquo;
            </p>
          </Card>
        </section>
      )}
    </div>
  );
}

/**
 * Helper function to format journey data for export
 */
function formatJourneyForExport(
  journey: JourneyReflection,
  options: { includeMetadata: boolean; format: "plain" | "markdown" }
): string {
  const { includeMetadata, format } = options;
  const isMarkdown = format === "markdown";

  let text = "";

  // Metadata
  if (includeMetadata) {
    if (isMarkdown) {
      text += `# Translation Journey Summary\n\n`;
      text += `**Generated:** ${new Date().toLocaleString()}\n\n`;
      text += `---\n\n`;
    } else {
      text += `Translation Journey Summary\n`;
      text += `Generated: ${new Date().toLocaleString()}\n`;
      text += `${"=".repeat(60)}\n\n`;
    }
  }

  // Summary
  if (isMarkdown) {
    text += `## Summary\n\n${journey.summary}\n\n`;
  } else {
    text += `Summary:\n${journey.summary}\n\n`;
  }

  // Insights
  if (journey.insights && journey.insights.length > 0) {
    if (isMarkdown) {
      text += `## Key Insights\n\n`;
      journey.insights.forEach((insight, idx) => {
        text += `${idx + 1}. ${insight}\n`;
      });
      text += `\n`;
    } else {
      text += `Key Insights:\n`;
      journey.insights.forEach((insight, idx) => {
        text += `  ${idx + 1}. ${insight}\n`;
      });
      text += `\n`;
    }
  }

  // Strengths
  if (journey.strengths && journey.strengths.length > 0) {
    if (isMarkdown) {
      text += `## Strengths\n\n`;
      journey.strengths.forEach((strength) => {
        text += `- ✓ ${strength}\n`;
      });
      text += `\n`;
    } else {
      text += `Strengths:\n`;
      journey.strengths.forEach((strength) => {
        text += `  ✓ ${strength}\n`;
      });
      text += `\n`;
    }
  }

  // Challenges
  if (journey.challenges && journey.challenges.length > 0) {
    if (isMarkdown) {
      text += `## Challenges Addressed\n\n`;
      journey.challenges.forEach((challenge) => {
        text += `- ${challenge}\n`;
      });
      text += `\n`;
    } else {
      text += `Challenges Addressed:\n`;
      journey.challenges.forEach((challenge) => {
        text += `  • ${challenge}\n`;
      });
      text += `\n`;
    }
  }

  // Recommendations
  if (journey.recommendations && journey.recommendations.length > 0) {
    if (isMarkdown) {
      text += `## Recommendations\n\n`;
      journey.recommendations.forEach((rec) => {
        text += `- 💡 ${rec}\n`;
      });
      text += `\n`;
    } else {
      text += `Recommendations:\n`;
      journey.recommendations.forEach((rec) => {
        text += `  💡 ${rec}\n`;
      });
      text += `\n`;
    }
  }

  // Overall Assessment
  if (journey.overallAssessment) {
    if (isMarkdown) {
      text += `## Overall Assessment\n\n`;
      text += `> ${journey.overallAssessment}\n`;
    } else {
      text += `Overall Assessment:\n"${journey.overallAssessment}"\n`;
    }
  }

  return text;
}
