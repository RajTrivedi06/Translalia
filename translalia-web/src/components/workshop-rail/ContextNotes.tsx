"use client";

import { useState } from "react";
import { useContextNotes } from "@/lib/hooks/useContextNotes";
import {
  Info,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { FEATURE_VERIFICATION_CONTEXT } from "@/lib/featureFlags";
import { useTranslations } from "next-intl";

interface ContextNotesProps {
  threadId: string;
  lineIndex: number;
  tokenIndex: number;
  // All word options for the current line (from store), used to enable unsaved context
  wordOptionsForLine?: Array<{
    original: string;
    position: number;
    options: string[];
    partOfSpeech?: string;
  }>;
}

/**
 * Displays educational context notes for translation options
 * Helps users understand what each option prioritizes without judging quality
 */
export function ContextNotes({
  threadId,
  lineIndex,
  tokenIndex,
  wordOptionsForLine,
}: ContextNotesProps) {
  const t = useTranslations("ContextNotes");
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "unhelpful" | null>(
    null
  );

  // Map UI word options into API format when available
  const wordOptionsForApi = wordOptionsForLine
    ? wordOptionsForLine.map((w) => ({
        source: w.original,
        order: w.position,
        options: w.options,
        pos: w.partOfSpeech,
      }))
    : undefined;

  const { data, isLoading, error } = useContextNotes({
    threadId,
    lineIndex,
    tokenIndex,
    enabled: isExpanded, // Only fetch when user expands
    wordOptionsForApi,
  });

  // Feedback submission function
  const submitFeedback = async (type: "helpful" | "unhelpful") => {
    setFeedback(type);

    try {
      await fetch("/api/verification/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          lineIndex,
          tokenIndex,
          feedbackType: type,
          notes: data?.notes || [],
        }),
      });
    } catch (error) {
      console.warn("Failed to submit feedback:", error);
    }
  };

  // Don't render anything if feature is disabled
  if (!FEATURE_VERIFICATION_CONTEXT) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full"
        aria-expanded={isExpanded}
        aria-label={t("understandingOptions")}
      >
        <Lightbulb className="w-4 h-4" />
        <span>{t("understandingOptions")}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
              <span>{t("generatingInsights")}</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>{t("unableToLoad")}</span>
            </div>
          )}

          {/* Success state - show notes */}
          {data?.success && data.notes && (
            <div className="space-y-2">
              {data.notes.map((note: string, idx: number) => (
                <div
                  key={idx}
                  className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-gray-700"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="leading-relaxed">{note}</p>
                  </div>
                </div>
              ))}

              {/* Subtle note about educational purpose */}
              <p className="text-xs text-gray-500 italic mt-2">
                {t("educationalNote")}
              </p>

              {/* Feedback buttons */}
              {!feedback ? (
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-blue-200">
                  <span className="text-xs text-gray-500 mr-2">
                    {t("wasHelpful")}
                  </span>
                  <button
                    onClick={() => submitFeedback("helpful")}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title={t("markHelpful")}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{t("yes")}</span>
                  </button>
                  <button
                    onClick={() => submitFeedback("unhelpful")}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title={t("markUnhelpful")}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>{t("no")}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-blue-200">
                  <span className="text-xs text-green-600">
                    {t("thanksFeedback")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
