"use client";

import * as React from "react";
import { FileText, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { SegmentedProgress } from "@/components/ui/segmented-progress";

interface NotebookHeaderProps {
  /** Whether to show the "Notebook" title */
  showTitle?: boolean;
  /** Number of completed lines */
  completedCount: number;
  /** Number of draft (unsaved) lines */
  draftCount: number;
  /** Total number of source lines */
  totalLines: number;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Callback to save all unsaved lines */
  onSaveAll?: () => void;
  /** Callback to open full editor/comparison view */
  onOpenFullEditor?: () => void;
}

/**
 * Header component for the Notebook with progress bar, save controls, and actions.
 * Features a segmented progress bar showing completed/draft/pending status.
 */
export function NotebookHeader({
  showTitle = true,
  completedCount,
  draftCount,
  totalLines,
  isSaving = false,
  onSaveAll,
  onOpenFullEditor,
}: NotebookHeaderProps) {
  const hasUnsaved = draftCount > 0;

  return (
    <div className="notebook-header px-5 py-4">
      {/* Top row: Title and actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 min-w-0">
          {showTitle && (
            <h2 className="notebook-title">Notebook</h2>
          )}

          {/* Unsaved badge with pulse animation */}
          <AnimatePresence>
            {hasUnsaved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200"
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {draftCount} unsaved
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {hasUnsaved && onSaveAll && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-accent/50 hover:border-accent hover:bg-accent/5"
                  onClick={onSaveAll}
                  disabled={isSaving}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSaving ? "Saving..." : "Save All"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {onOpenFullEditor && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onOpenFullEditor}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Full comparison
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar row */}
      <div className="flex items-center gap-4">
        <SegmentedProgress
          completed={completedCount}
          draft={draftCount}
          total={totalLines}
          height="md"
          className="flex-1"
        />
        <span className="text-sm text-foreground-secondary whitespace-nowrap">
          {completedCount} of {totalLines}
        </span>
      </div>
    </div>
  );
}

export default NotebookHeader;
