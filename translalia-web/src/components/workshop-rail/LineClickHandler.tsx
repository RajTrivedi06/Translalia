"use client";

import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import type { TranslationStanzaStatus } from "@/types/translationJob";
import { Button } from "@/components/ui/button";

interface LineClickHandlerProps {
  /**
   * Current processing status of the line
   */
  status?: TranslationStanzaStatus | null;

  /**
   * Called when user clicks to edit/view this line
   */
  onSelect: () => void;

  /**
   * Called when user clicks retry for a failed line
   */
  onRetry?: () => void;

  /**
   * The actual line content to display
   */
  lineText: string;

  /**
   * Line number (for display)
   */
  lineNumber: number;

  /**
   * Stanza number (for display)
   */
  stanzaNumber: number;

  /**
   * Whether this line is currently selected
   */
  isSelected?: boolean;

  /**
   * Status metadata with badge styling
   */
  statusMeta?: {
    label: string;
    badgeClass: string;
    dotClass: string;
  } | null;
}

/**
 * LineClickHandler Component
 *
 * Intelligently handles line clicks based on translation status:
 * - Completed: Allows editing translations
 * - Processing: Shows loading state and prevents editing
 * - Queued: Shows waiting state
 * - Failed: Shows error state with retry button
 * - Pending: Shows pending state
 */
export function LineClickHandler({
  status,
  onSelect,
  onRetry,
  lineText,
  lineNumber,
  stanzaNumber,
  isSelected,
  statusMeta,
}: LineClickHandlerProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  // Determine if line can be interacted with
  const isComplete = status === "completed";
  const isProcessing = status === "processing";
  const isFailed = status === "failed";
  const isQueued = status === "queued";
  const isPending = !status;

  // Determine styling based on status
  const bgColor = isComplete
    ? "bg-green-50 hover:bg-green-100"
    : isFailed
    ? "bg-red-50 hover:bg-red-100"
    : "hover:bg-gray-50";

  const borderColor = statusMeta
    ? `border-${statusMeta.dotClass?.match(/bg-(\w+)-\d+/)?.[1] || "gray"}-300`
    : "border-gray-200";

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      onClick={() => {
        // Allow selection for completed lines, or let user see status for others
        onSelect();
      }}
      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${borderColor} ${bgColor}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
      aria-label={`Line ${lineNumber} of Stanza ${stanzaNumber}: ${lineText}. Status: ${
        statusMeta?.label || "Pending"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-600 mb-1">
            Line {lineNumber} of Segment {stanzaNumber}
          </div>
          <div className="font-medium truncate">{lineText}</div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Status Badge with Icon */}
          {statusMeta && (
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap flex items-center gap-1 ${statusMeta.badgeClass}`}
            >
              {isComplete && "✅"}
              {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
              {isQueued && "⏱️"}
              {isFailed && "❌"}
              <span>{statusMeta.label}</span>
            </span>
          )}
          {isPending && (
            <span className="text-xs text-gray-500 font-medium">
              ⏱️ Pending
            </span>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <span className="text-[10px] text-blue-600 font-medium">
              Processing...
            </span>
          )}

          {/* Failed state with retry button */}
          {isFailed && onRetry && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-6 px-2 text-[10px] font-medium text-red-600 hover:text-red-700 hover:bg-red-100"
              aria-label={`Retry line ${lineNumber}`}
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </>
              )}
            </Button>
          )}

          {/* Can't edit notice for incomplete lines */}
          {!isComplete && !isFailed && (
            <span className="text-[10px] text-gray-400 font-medium">
              {isProcessing && "Editing locked"}
              {isQueued && "Queued"}
              {isPending && "Not ready"}
            </span>
          )}
        </div>
      </div>

      {/* Subtle processing indicator - removed blue background overlay */}
    </div>
  );
}
