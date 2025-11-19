"use client";

import * as React from "react";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import type { TranslationJobProgressSummary } from "@/types/translationJob";
import { Badge } from "@/components/ui/badge";
import { getStatusMeta } from "./stanzaStatusMeta";
import { Loader2 } from "lucide-react";
import { useWorkshopStore } from "@/store/workshopSlice";

interface StanzaProgressPanelProps {
  summary: TranslationJobProgressSummary | null | undefined;
  stanzaResult?: StanzaDetectionResult | null;
  threadId?: string | null;
  onRetry?: () => void;
}

export function StanzaProgressPanel({
  summary,
  stanzaResult,
  threadId,
  onRetry,
}: StanzaProgressPanelProps) {
  const [retryingIndex, setRetryingIndex] = React.useState<number | null>(null);

  const handleRetry = React.useCallback(
    async (stanzaIndex: number, lineNumbers: number[]) => {
      if (!threadId) return;
      try {
        setRetryingIndex(stanzaIndex);
        const res = await fetch("/api/workshop/requeue-stanza", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            stanzaIndex,
            clearLines: true,
            runImmediately: true,
          }),
        });
        if (!res.ok) {
          const message = await res
            .json()
            .then((data) => data?.error || res.statusText)
            .catch(() => res.statusText);
          throw new Error(message);
        }
        lineNumbers.forEach((lineNumber) =>
          useWorkshopStore.getState().clearLineTranslation(lineNumber)
        );
        onRetry?.();
      } catch (error) {
        console.error("[StanzaProgressPanel] Failed to requeue stanza", error);
      } finally {
        setRetryingIndex(null);
      }
    },
    [threadId, onRetry]
  );

  if (!summary || !stanzaResult?.stanzas?.length) {
    return null;
  }

  const { progress, chunks, stanzas } = summary;
  // Use chunks (new) or stanzas (legacy) for compatibility
  const chunkStates = chunks || stanzas || {};
  const completionPercent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Background progress
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {progress.completed} / {progress.total} stanzas completed
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Job status:{" "}
          <span className="font-medium text-gray-800 capitalize">
            {summary.status}
          </span>
        </div>
      </div>

      <div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {completionPercent}% complete
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-xs text-gray-600">
        <ProgressChip label="Processing" value={progress.processing} />
        <ProgressChip label="Queued" value={progress.queued} />
        <ProgressChip label="Pending" value={progress.pending} />
        <ProgressChip label="Failed" value={progress.failed} />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
        <div className="divide-y divide-gray-100 text-sm">
          {(() => {
            let runningLineIndex = 0;
            return stanzaResult.stanzas.map((stanza, idx) => {
              const stanzaState = chunkStates[idx];
              const meta = getStatusMeta(stanzaState?.status);
              const processed = stanzaState?.linesProcessed ?? 0;
              const totalLines = stanzaState?.totalLines ?? stanza.lines.length;
              const fallbackLineNumbers = stanza.lines.map(
                (_line, offset) => runningLineIndex + offset
              );
              const lineNumbers =
                stanzaState?.lines?.map((line) => line.line_number) ??
                fallbackLineNumbers;
              runningLineIndex += stanza.lines.length;

              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col items-center pt-1 min-w-[16px]">
                    <span
                      className={`h-2 w-2 rounded-full ${meta.dotClass}`}
                      aria-hidden
                    />
                    <span className="text-[10px] uppercase text-gray-400 mt-1">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {stanza.lines[0] || "(blank stanza)"}
                      </p>
                      <Badge className={`text-[10px] ${meta.badgeClass}`}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {processed}/{totalLines} lines processed
                    </p>
                    {meta.label === "Failed" && threadId && (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                        disabled={retryingIndex === idx}
                        onClick={() => handleRetry(idx, lineNumbers)}
                      >
                        {retryingIndex === idx ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        Retry stanza
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

function ProgressChip({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="font-semibold text-gray-900">{value}</span>{" "}
      <span>{label}</span>
    </span>
  );
}
