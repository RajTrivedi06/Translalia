// src/components/workspace/v2/views/WorkshopView.tsx
"use client";

import * as React from "react";
import { useWorkspace } from "@/store/workspace";
import { useExplodeTokens } from "../_utils/useExplodeTokens";
import { TokenCard } from "../components/TokenCard";
import { getSourceLines } from "../_utils/data";
import { useT } from "../_utils/i18n";
import { groupWithNext, ungroup } from "../_utils/grouping";
import type { ExplodedLine } from "@/types/workshop";
import { saveLocal, loadLocal } from "../_utils/persist";

export function WorkshopView() {
  const t = useT();
  const ui = useWorkspace((s) => s.ui);
  const threadId = useWorkspace((s) => s.threadId);
  const tokenSelections = useWorkspace((s) => s.tokensSelections);
  const notebookText = useWorkspace((s) => s.workshopDraft.notebookText);
  const clearSelections = useWorkspace((s) => s.clearSelections);
  const setCurrentLine = useWorkspace((s) => s.setCurrentLine);
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  const appendNotebook = useWorkspace((s) => s.appendNotebook);

  // Get source lines from workspace data
  const sourceLines = React.useMemo(() => {
    try {
      // For Phase 2, use mock data since we don't have flowPeek/nodes connection yet
      // In Phase 3, this will connect to actual data from LineSelectionView
      return [
        "The heart speaks in whispers",
        "Love flows like morning dew",
        "Beautiful words dance together",
      ];
    } catch (error) {
      console.error("[WorkshopView] Failed to get source lines:", error);
      return [];
    }
  }, []);

  // Use the explode tokens hook
  const { explodedLines, helpers } = useExplodeTokens(sourceLines);

  // Get current line (for now, use the first line or currentLine from UI)
  const currentLineIdx = ui.currentLine ?? 0;
  const baseLine = explodedLines[currentLineIdx];

  // Local line override for ephemeral grouping (Phase 2 approach)
  const [lineOverrides, setLineOverrides] = React.useState<Record<string, ExplodedLine>>({});
  const currentLine = baseLine ? (lineOverrides[baseLine.lineId] || baseLine) : undefined;

  // Hydrate from localStorage on thread change
  React.useEffect(() => {
    const saved = loadLocal<{ tokenSelections: any; notebookText: string }>(threadId);
    if (saved) {
      // Hydrate with setState calls
      useWorkspace.setState((s) => ({
        tokensSelections: saved.tokenSelections ?? s.tokensSelections,
        workshopDraft: { notebookText: saved.notebookText ?? s.workshopDraft.notebookText },
      }));
    } else {
      // Ensure clean slate per thread change
      clearSelections();
      useWorkspace.setState({ workshopDraft: { notebookText: "" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Throttled save to localStorage
  React.useEffect(() => {
    const id = window.setTimeout(
      () => saveLocal(threadId, { tokenSelections, notebookText }),
      2000
    );
    return () => window.clearTimeout(id);
  }, [threadId, tokenSelections, notebookText]);

  // Grouping handlers
  const handleGroupWithNext = React.useCallback((tokenIndex: number) => {
    if (!currentLine) return;

    const newLine = groupWithNext(currentLine, tokenIndex);
    setLineOverrides(prev => ({
      ...prev,
      [currentLine.lineId]: newLine,
    }));
  }, [currentLine]);

  const handleUngroup = React.useCallback((tokenIndex: number) => {
    if (!currentLine) return;

    const newLine = ungroup(currentLine, tokenIndex);
    setLineOverrides(prev => ({
      ...prev,
      [currentLine.lineId]: newLine,
    }));
  }, [currentLine]);

  const handleCompileLine = React.useCallback(() => {
    if (!currentLine) return;

    const state = useWorkspace.getState();
    const compiled = currentLine.tokens
      .map(token => {
        const selection = state.tokensSelections[currentLine.lineId]?.[token.tokenId];
        if (!selection) return token.surface;
        if (selection.startsWith("user:")) return selection.slice("user:".length);
        const option = token.options.find(opt => opt.id === selection);
        return option?.label ?? token.surface;
      })
      .join("");

    appendNotebook(compiled + "\n");

    // Advance to next line or go to notebook if this was the last line
    if (currentLineIdx < explodedLines.length - 1) {
      setCurrentLine(currentLineIdx + 1);
    } else {
      setCurrentView("notebook");
    }
  }, [currentLine, currentLineIdx, explodedLines.length, appendNotebook, setCurrentLine, setCurrentView]);

  const handlePrevLine = () => {
    if (currentLineIdx > 0) {
      setCurrentLine(currentLineIdx - 1);
    }
  };

  const handleNextLine = () => {
    if (currentLineIdx < explodedLines.length - 1) {
      setCurrentLine(currentLineIdx + 1);
    }
  };

  if (explodedLines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <div className="text-center">
          <p>No source lines available</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => setCurrentView("line-selection")}
          >
            Select Lines
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex-none border-b bg-neutral-50 dark:bg-neutral-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Workshop</h1>
          <div className="text-sm text-neutral-500">
            Line {currentLineIdx + 1} of {explodedLines.length}
          </div>
        </div>

        {currentLine && (
          <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium">Original:</span> {currentLine.tokens.map(t => t.surface).join("")}
          </div>
        )}
      </div>

      {/* Token Cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentLine ? (
          <>
            <p className="sr-only">
              Editing line {currentLineIdx + 1} of {explodedLines.length}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentLine.tokens
              .filter(token => token.options.length > 0) // Only show tokens with options
              .map((token, tokenIndex) => (
                <TokenCard
                  key={token.tokenId}
                  lineId={currentLine.lineId}
                  token={token}
                  tokenIndex={tokenIndex}
                  totalTokens={currentLine.tokens.length}
                  onGroupWithNext={handleGroupWithNext}
                  onUngroup={handleUngroup}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-neutral-500">
            <p>No tokens available for this line.</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-none border-t bg-neutral-50 dark:bg-neutral-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-600 dark:hover:bg-neutral-800"
            onClick={handlePrevLine}
            disabled={currentLineIdx === 0}
          >
            ← Prev line
          </button>

          <button
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-600 dark:hover:bg-neutral-800"
            onClick={handleNextLine}
            disabled={currentLineIdx >= explodedLines.length - 1}
          >
            Next line →
          </button>

          <div className="flex-1" />

          <button
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={handleCompileLine}
          >
            Compile Line in Notebook
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkshopView;
