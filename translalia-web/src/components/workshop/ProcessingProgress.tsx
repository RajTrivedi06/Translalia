"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
  ChevronDown,
} from "lucide-react";
import type { TranslationJobProgressSummary } from "@/types/translationJob";

interface ProcessingProgressProps {
  /**
   * Translation job progress summary
   */
  summary?: TranslationJobProgressSummary | null;

  /**
   * Whether to show detailed breakdown (otherwise just shows bar)
   */
  showDetails?: boolean;

  /**
   * Callback when user wants to retry failed stanzas
   */
  onRetry?: () => void;
}

/**
 * ProcessingProgress Component
 *
 * Displays overall translation job progress with visual indicators
 * for completed, processing, queued, pending, and failed stanzas.
 *
 * This component provides a high-level view of the translation progress,
 * complementary to the detailed StanzaProgressPanel.
 */
export function ProcessingProgress({
  summary,
  showDetails = true,
  onRetry,
}: ProcessingProgressProps) {
  const [isExpanded, setIsExpanded] = React.useState(showDetails);

  React.useEffect(() => {
    setIsExpanded(showDetails);
  }, [showDetails]);

  if (!summary) {
    return null;
  }

  const { progress, status } = summary;
  const completionPercent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const isProcessing = status === "processing" || progress.processing > 0;
  const isComplete =
    progress.completed === progress.total && progress.failed === 0;
  const hasFailed = progress.failed > 0;

  const statusLabel = isComplete
    ? "Translation Complete"
    : hasFailed
    ? "Translation Paused"
    : isProcessing
    ? "Processing..."
    : "Pending";

  const statusSubtext = isProcessing
    ? "Translating..."
    : isComplete
    ? "Done"
    : hasFailed
    ? "Has errors"
    : "Queued";

  const statusIcon = isComplete ? (
    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
  ) : hasFailed ? (
    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
  ) : isProcessing ? (
    <Clock className="h-4 w-4 text-blue-600 flex-shrink-0 animate-spin" />
  ) : (
    <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
  );

  return (
    <div className="mb-4">
      {/* Compact summary row */}
      <div className="flex items-center justify-between rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          {statusIcon}
          <div>
            <p className="text-[13px] font-semibold text-gray-900">
              {statusLabel}
            </p>
            <p className="text-[11px] text-gray-500">
              {progress.completed} / {progress.total} segments · {statusSubtext}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-blue-600">
            {completionPercent}%
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            aria-label={
              isExpanded ? "Hide progress details" : "Show progress details"
            }
            aria-expanded={isExpanded}
            title={
              isExpanded ? "Hide progress details" : "Show progress details"
            }
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <Info className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isComplete
                    ? "bg-green-500"
                    : hasFailed
                    ? "bg-red-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${completionPercent}%` }}
                role="progressbar"
                aria-valuenow={completionPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Translation progress: ${completionPercent}% complete`}
              />
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <StatusBadge
              label="Completed"
              value={progress.completed}
              variant="success"
            />
            <StatusBadge
              label="Processing"
              value={progress.processing}
              variant="primary"
            />
            <StatusBadge
              label="Queued"
              value={progress.queued}
              variant="warning"
            />
            <StatusBadge
              label="Pending"
              value={progress.pending}
              variant="gray"
            />
            <StatusBadge
              label="Failed"
              value={progress.failed}
              variant="error"
            />
          </div>

          {/* Error message with retry button */}
          {hasFailed && onRetry && (
            <div className="mt-3 flex items-center justify-between p-2 bg-red-100 border border-red-300 rounded">
              <p className="text-xs text-red-700">
                ⚠️ {progress.failed} segment{progress.failed !== 1 ? "s" : ""}{" "}
                failed to process
              </p>
              <button
                onClick={onRetry}
                className="text-xs font-medium text-red-700 hover:text-red-900 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && !isComplete && (
            <div className="mt-3 text-xs text-blue-700 p-2 bg-blue-100 border border-blue-300 rounded">
              ⏳ Translation in progress. Segments are being processed in the
              background.
            </div>
          )}

          {/* Success indicator */}
          {isComplete && (
            <div className="mt-3 text-xs text-green-700 p-2 bg-green-100 border border-green-300 rounded">
              ✅ All segments have been translated successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Status badge component for progress breakdown
 */
function StatusBadge({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "primary" | "warning" | "gray" | "error";
}) {
  const variantClasses = {
    success: "bg-green-100 text-green-800",
    primary: "bg-blue-100 text-blue-800",
    warning: "bg-yellow-100 text-yellow-800",
    gray: "bg-gray-100 text-gray-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <div className={`${variantClasses[variant]} rounded px-2 py-1`}>
      <p className="font-semibold">{value}</p>
      <p className="text-[10px] opacity-75">{label}</p>
    </div>
  );
}
