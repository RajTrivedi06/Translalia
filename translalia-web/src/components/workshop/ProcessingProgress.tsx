"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationJobProgressSummary } from "@/types/translationJob";

interface ProcessingProgressProps {
  summary?: TranslationJobProgressSummary | null;
  onRetry?: () => void;
}

function useProgressState(summary: TranslationJobProgressSummary) {
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
    ? "Translation complete"
    : hasFailed
    ? "Translation paused"
    : isProcessing
    ? "Processing translation"
    : "Translation pending";

  return {
    progress,
    completionPercent,
    isProcessing,
    isComplete,
    hasFailed,
    statusLabel,
  };
}

export function ProgressRingButton({
  summary,
  expanded,
  onToggle,
}: {
  summary: TranslationJobProgressSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const {
    completionPercent,
    isProcessing,
    isComplete,
    hasFailed,
    statusLabel,
  } = useProgressState(summary);

  const size = 36;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (completionPercent / 100) * circumference;

  const ringColor = isComplete
    ? "stroke-green-500"
    : hasFailed
    ? "stroke-red-500"
    : isProcessing
    ? "stroke-blue-500"
    : "stroke-slate-300";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "border border-border-subtle bg-white transition-colors",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        expanded && "bg-muted/40 ring-1 ring-accent/30"
      )}
      aria-expanded={expanded}
      aria-label={`${statusLabel}: ${completionPercent}%. ${
        expanded ? "Hide" : "Show"
      } progress details`}
      title={statusLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-slate-200"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(ringColor, isProcessing && !isComplete && "opacity-90")}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
        ) : hasFailed ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
        ) : isProcessing ? (
          <Clock
            className="h-3 w-3 text-blue-600 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <span className="text-[10px] font-semibold tabular-nums text-foreground-secondary">
            {completionPercent}
          </span>
        )}
      </span>
    </button>
  );
}

export function TranslationProgressDetails({
  summary,
  onRetry,
}: {
  summary: TranslationJobProgressSummary;
  onRetry?: () => void;
}) {
  const {
    progress,
    completionPercent,
    isProcessing,
    isComplete,
    hasFailed,
    statusLabel,
  } = useProgressState(summary);

  return (
    <div className="border-t border-border-subtle bg-surface/95 px-6 py-2.5 md:px-10">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-foreground">{statusLabel}</p>
        <p className="text-xs tabular-nums text-foreground-muted">
          {progress.completed} / {progress.total} segments · {completionPercent}%
        </p>
      </div>

      <div className="mb-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isComplete
                ? "bg-green-500"
                : hasFailed
                ? "bg-red-500"
                : "bg-blue-600"
            )}
            style={{ width: `${completionPercent}%` }}
            role="progressbar"
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Translation progress: ${completionPercent}% complete`}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[11px] sm:grid-cols-5">
        <StatusBadge label="Done" value={progress.completed} variant="success" />
        <StatusBadge
          label="Processing"
          value={progress.processing}
          variant="primary"
        />
        <StatusBadge label="Queued" value={progress.queued} variant="warning" />
        <StatusBadge label="Pending" value={progress.pending} variant="gray" />
        <StatusBadge label="Failed" value={progress.failed} variant="error" />
      </div>

      {hasFailed && onRetry && (
        <div className="mt-2 flex items-center justify-between rounded border border-red-200 bg-red-50 px-2 py-1.5">
          <p className="text-[11px] text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {progress.failed} segment{progress.failed !== 1 ? "s" : ""} failed
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="text-[11px] font-medium text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {isProcessing && !isComplete && (
        <p className="mt-2 text-[11px] text-blue-700">
          Segments are processing in the background.
        </p>
      )}

      {isComplete && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-green-700">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          All segments translated successfully.
        </p>
      )}
    </div>
  );
}

/** @deprecated Use ProgressRingButton + TranslationProgressDetails in WorkshopHeader */
export function ProcessingProgress({ summary, onRetry }: ProcessingProgressProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!summary) return null;

  return (
    <div className="mb-4">
      <div className="flex justify-end px-3">
        <ProgressRingButton
          summary={summary}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
        />
      </div>
      {expanded && (
        <TranslationProgressDetails summary={summary} onRetry={onRetry} />
      )}
    </div>
  );
}

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
    <div className={`rounded px-1.5 py-1 ${variantClasses[variant]}`}>
      <p className="font-semibold leading-none">{value}</p>
      <p className="mt-0.5 text-[9px] opacity-75">{label}</p>
    </div>
  );
}

export default ProcessingProgress;
