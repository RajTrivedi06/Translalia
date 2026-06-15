"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { Badge } from "@/components/ui/badge";
import {
  ProgressRingButton,
  TranslationProgressDetails,
} from "@/components/workshop/ProcessingProgress";
import type { TranslationJobProgressSummary } from "@/types/translationJob";

interface WorkshopHeaderProps {
  showTitle?: boolean;
  translationProgress?: TranslationJobProgressSummary | null;
  onRetryProgress?: () => void;
}

export function WorkshopHeader({
  showTitle = true,
  translationProgress = null,
  onRetryProgress,
}: WorkshopHeaderProps) {
  const total = useWorkshopStore((s) => s.poemLines.length);
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const currentVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;

  const [progressExpanded, setProgressExpanded] = React.useState(false);
  const showProgress = !!translationProgress;

  React.useEffect(() => {
    if (!showProgress) {
      setProgressExpanded(false);
    }
  }, [showProgress]);

  return (
    <div className="border-b bg-white">
      <div className="flex items-center justify-between gap-2 px-6 py-3 md:px-10">
        <div className="flex min-w-0 items-center gap-2">
          {showTitle && <h2 className="text-sm font-semibold">Workshop</h2>}
          {currentLineIndex !== null ? (
            <span className="truncate text-xs text-neutral-500">
              Line {currentLineIndex + 1} of {total}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
            {currentVariant
              ? `Variant ${currentVariant} selected`
              : "Select a variant"}
          </Badge>
          {showProgress && (
            <ProgressRingButton
              summary={translationProgress}
              expanded={progressExpanded}
              onToggle={() => setProgressExpanded((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {showProgress && progressExpanded && (
        <TranslationProgressDetails
          summary={translationProgress}
          onRetry={onRetryProgress}
        />
      )}
    </div>
  );
}
