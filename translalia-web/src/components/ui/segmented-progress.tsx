"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface SegmentedProgressProps {
  /** Number of completed items */
  completed: number;
  /** Number of draft/in-progress items */
  draft: number;
  /** Total number of items */
  total: number;
  /** Show text labels below the progress bar */
  showLabels?: boolean;
  /** Show the count text (e.g., "3 of 12") */
  showCount?: boolean;
  /** Height of the progress bar */
  height?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

const heightClasses = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2",
};

/**
 * A segmented progress bar showing completed, draft, and pending items.
 * Features smooth animations when segment widths change.
 */
export function SegmentedProgress({
  completed,
  draft,
  total,
  showLabels = false,
  showCount = false,
  height = "md",
  className = "",
}: SegmentedProgressProps) {
  const pending = Math.max(0, total - completed - draft);

  // Calculate percentages for animated segments
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const draftPercent = total > 0 ? (draft / total) * 100 : 0;

  const heightClass = heightClasses[height];

  return (
    <div className={`w-full ${className}`}>
      {/* Progress bar container */}
      <div
        className={`w-full ${heightClass} bg-muted rounded-full overflow-hidden flex`}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} completed`}
      >
        {/* Completed segment */}
        <motion.div
          className="h-full bg-success rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${completedPercent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{ minWidth: completedPercent > 0 ? "2px" : 0 }}
        />

        {/* Draft segment - with subtle striped pattern */}
        <motion.div
          className="h-full bg-warning relative overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${draftPercent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{ minWidth: draftPercent > 0 ? "2px" : 0 }}
        >
          {/* Striped overlay for draft state */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 2px,
                rgba(255, 255, 255, 0.4) 2px,
                rgba(255, 255, 255, 0.4) 4px
              )`,
            }}
          />
        </motion.div>

        {/* Pending segment - uses remaining space (implicit) */}
        <motion.div
          className="h-full bg-foreground-disabled/30 rounded-r-full flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Labels below the bar */}
      {showLabels && (
        <div className="flex justify-between mt-1.5 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            {completed} completed
          </span>
          {draft > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              {draft} draft
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-foreground-disabled/30" />
            {pending} pending
          </span>
        </div>
      )}

      {/* Count text */}
      {showCount && (
        <p className="text-sm text-foreground-secondary mt-1">
          {completed} of {total} lines translated
          {draft > 0 && <span className="text-warning ml-1">({draft} unsaved)</span>}
        </p>
      )}
    </div>
  );
}

export default SegmentedProgress;
