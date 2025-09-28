// src/components/workspace/v2/views/LineSelectionView.tsx
"use client";

import React, { useReducer, useCallback, useEffect, useMemo } from "react";
import { Check, Square, CheckSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { getSourceLines } from "../_utils/data";
import { useT } from "../_utils/i18n";
import {
  selectionReducer,
  getSelectionSummary,
} from "../_utils/selection";

type LineSelectionViewProps = {
  flowPeek?: unknown;
  nodes?: unknown[];
  onProceed?: () => void;
};

export function LineSelectionView({ flowPeek, nodes, onProceed }: LineSelectionViewProps) {
  const t = useT();
  const setCurrentView = useWorkspace((s) => s.setCurrentView);

  // Source data
  const sourceLines = useMemo(() => {
    try {
      return getSourceLines({ flowPeek, nodes }) || [];
    } catch (error) {
      console.error("[LineSelectionView] Failed to get source lines:", error);
      return [];
    }
  }, [flowPeek, nodes]);

  // Generate stable line IDs
  const lineIds = useMemo(
    () => sourceLines.map((_, idx) => `line-${idx}`),
    [sourceLines]
  );

  // Local selection state
  const [selectionState, dispatch] = useReducer(selectionReducer, {
    selectedLineIds: new Set<string>(),
    lastClickedLineId: undefined,
  });

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target !== document.body && !(e.target as HTMLElement)?.closest?.('[data-line-selection-view]')) {
        return;
      }

      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch({ type: "SELECT_ALL", allLineIds: lineIds });
      } else if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: "CLEAR_ALL" });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lineIds]);

  // Line click handler
  const handleLineClick = useCallback(
    (lineId: string, event: React.MouseEvent) => {
      if (event.shiftKey && selectionState.lastClickedLineId) {
        dispatch({
          type: "SELECT_RANGE",
          fromLineId: selectionState.lastClickedLineId,
          toLineId: lineId,
          allLineIds: lineIds,
        });
      } else if (event.metaKey || event.ctrlKey) {
        dispatch({ type: "TOGGLE_SINGLE", lineId });
      } else {
        dispatch({ type: "SELECT_SINGLE", lineId });
      }
    },
    [selectionState.lastClickedLineId, lineIds]
  );

  // Bulk actions
  const handleSelectAll = useCallback(() => {
    dispatch({ type: "SELECT_ALL", allLineIds: lineIds });
  }, [lineIds]);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  // Proceed to workshop
  const handleProceed = useCallback(() => {
    if (selectionState.selectedLineIds.size > 0) {
      // Store selected line indices in workspace for workshop phase
      const selectedIndices = Array.from(selectionState.selectedLineIds)
        .map(id => lineIds.indexOf(id))
        .filter(idx => idx !== -1)
        .sort((a, b) => a - b);

      // Clear any existing selections and set current line to first selected
      useWorkspace.getState().clearSelections();
      if (selectedIndices.length > 0) {
        useWorkspace.getState().setCurrentLine(selectedIndices[0]);
      }

      if (onProceed) {
        onProceed();
      } else {
        setCurrentView("workshop");
      }
    }
  }, [selectionState.selectedLineIds, lineIds, onProceed, setCurrentView]);

  const selectionSummary = getSelectionSummary(selectionState.selectedLineIds, sourceLines.length);
  const hasSelection = selectionState.selectedLineIds.size > 0;

  if (sourceLines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <div className="text-center">
          <Square className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t("noSourceLines")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col h-full"
      data-line-selection-view
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex-none border-b bg-neutral-50 dark:bg-neutral-900 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{t("selectLinesToWork")}</h2>
          <Badge variant="secondary">{selectionSummary}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSelectAll}
            disabled={selectionState.selectedLineIds.size === sourceLines.length}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            {t("selectAll")}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleClearSelection}
            disabled={!hasSelection}
          >
            <Square className="h-4 w-4 mr-1" />
            {t("clearSelection")}
          </Button>

          <div className="flex-1" />

          <Button
            onClick={handleProceed}
            disabled={!hasSelection}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t("proceedToWorkshop")}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Lines list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1">
          {sourceLines.map((line, idx) => {
            const lineId = lineIds[idx];
            const isSelected = selectionState.selectedLineIds.has(lineId);
            const isLastClicked = selectionState.lastClickedLineId === lineId;

            return (
              <div
                key={lineId}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  "hover:bg-neutral-50 dark:hover:bg-neutral-900",
                  isSelected && "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
                  isLastClicked && "ring-2 ring-blue-500 ring-opacity-50"
                )}
                onClick={(e) => handleLineClick(lineId, e)}
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Line ${idx + 1}: ${line}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    // Create a synthetic mouse event for keyboard interaction
                    const syntheticEvent = {
                      shiftKey: e.shiftKey,
                      metaKey: e.metaKey,
                      ctrlKey: e.ctrlKey,
                      preventDefault: () => {},
                      stopPropagation: () => {},
                    } as React.MouseEvent;
                    handleLineClick(lineId, syntheticEvent);
                  }
                }}
              >
                <div className="flex-none mt-0.5">
                  {isSelected ? (
                    <Check className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5 text-neutral-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-neutral-500">
                      Line {idx + 1}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed break-words">
                    {line}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help text */}
      <div className="flex-none border-t bg-neutral-50 dark:bg-neutral-900 px-4 py-2">
        <p className="text-xs text-neutral-500">
          {t("lineSelectionHelp")}
        </p>
      </div>
    </div>
  );
}

export default LineSelectionView;
