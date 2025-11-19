"use client";

import * as React from "react";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useTranslationJob } from "@/lib/hooks/useTranslationJob";
import { WorkshopHeader } from "@/components/workshop-rail/WorkshopHeader";
import { WordGrid } from "@/components/workshop-rail/WordGrid";
import { CompilationFooter } from "@/components/workshop-rail/CompilationFooter";
import { StanzaProgressPanel } from "@/components/workshop-rail/StanzaProgressPanel";
import { ProcessingProgress } from "@/components/workshop/ProcessingProgress";
import { LineClickHandler } from "@/components/workshop-rail/LineClickHandler";
import { getStatusMeta } from "@/components/workshop-rail/stanzaStatusMeta";
import type {
  TranslationStanzaStatus,
  TranslationJobProgressSummary,
} from "@/types/translationJob";

interface WorkshopRailProps {
  showHeaderTitle?: boolean;
}

export function WorkshopRail({ showHeaderTitle = true }: WorkshopRailProps) {
  const threadId = useThreadId();
  const poem = useGuideStore((s) => s.poem);
  const guideStep = useGuideStore((s) => s.currentStep);
  const isWorkshopUnlocked = useGuideStore((s) => s.isWorkshopUnlocked);
  const {
    selectedLineIndex,
    poemLines,
    setPoemLines,
    reset,
    selectLine,
    deselectLine,
  } = useWorkshopStore();
  // ⚠️ TEMPORARILY DISABLED - No background translation hydration
  // const setLineTranslation = useWorkshopStore((s) => s.setLineTranslation);

  // Get stanzas directly from guide store (client-side, no API)
  const poemStanzas = poem.stanzas;

  // Track which stanza is selected (null = show stanza selector)
  const [selectedStanzaIndex, setSelectedStanzaIndex] = React.useState<
    number | null
  >(null);

  // ✅ Re-enabled: Poll for translation job status updates
  const shouldPollTranslations =
    !!threadId && !!poemStanzas && poemStanzas.totalStanzas > 0;
  const translationJobQuery = useTranslationJob(threadId || undefined, {
    enabled: shouldPollTranslations,
    pollIntervalMs: 4000, // Poll every 4 seconds
    advanceOnPoll: true, // Advance translation job on each poll
  });
  const translationProgress: TranslationJobProgressSummary | null =
    translationJobQuery.data?.progress ?? null;

  // Reset workshop when Guide Rail returns to setup state
  React.useEffect(() => {
    if (guideStep === "setup" && poemLines.length > 0) {
      console.log("[WorkshopRail] Guide returned to setup, clearing workshop");
      reset();
    }
  }, [guideStep, poemLines.length, reset]);

  // Reset stanza selection when poem changes
  React.useEffect(() => {
    if (!poem.text && selectedStanzaIndex !== null) {
      setSelectedStanzaIndex(null);
    }
  }, [poem.text, selectedStanzaIndex]);

  // Keep poemLines updated for WordGrid compatibility (flattened from stanzas)
  React.useEffect(() => {
    if (poemStanzas && poemStanzas.stanzas.length > 0) {
      const flattenedLines = poemStanzas.stanzas.flatMap(
        (stanza) => stanza.lines
      );
      setPoemLines(flattenedLines);
    } else if (poem.text) {
      // Fallback to old behavior if no stanzas
      const lines = poem.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      setPoemLines(lines);
    }
  }, [poemStanzas, poem.text, setPoemLines]);

  // Calculate global line offset for selected stanza (used in lineContext)
  // Must be before early returns to satisfy React hooks rules
  const globalLineOffsetForContext = React.useMemo(() => {
    if (selectedStanzaIndex === null || !poemStanzas) return 0;
    let offset = 0;
    for (let i = 0; i < selectedStanzaIndex; i++) {
      offset += poemStanzas.stanzas[i].lines.length;
    }
    return offset;
  }, [selectedStanzaIndex, poemStanzas]);

  // Compute context for line translation (prev/next lines, stanza index)
  // Must be before early returns to satisfy React hooks rules
  const lineContext = React.useMemo(() => {
    if (selectedLineIndex === null || selectedStanzaIndex === null) return null;

    const currentStanza = poemStanzas?.stanzas[selectedStanzaIndex];
    if (!currentStanza) return null;

    // Calculate local line index within the stanza
    const localLineIndex = selectedLineIndex - globalLineOffsetForContext;

    const prevLine =
      localLineIndex > 0 ? currentStanza.lines[localLineIndex - 1] : undefined;
    const nextLine =
      localLineIndex < currentStanza.lines.length - 1
        ? currentStanza.lines[localLineIndex + 1]
        : undefined;

    // Ensure full poem is always available
    const fullPoem = poem.text || undefined;

    return {
      prevLine,
      nextLine,
      stanzaIndex: selectedStanzaIndex,
      fullPoem,
    };
  }, [
    selectedLineIndex,
    selectedStanzaIndex,
    poemStanzas,
    poem.text,
    globalLineOffsetForContext,
  ]);

  const goToChunkSelection = React.useCallback(() => {
    setSelectedStanzaIndex(null);
    deselectLine();
  }, [setSelectedStanzaIndex, deselectLine]);

  const showLineSelection = React.useCallback(() => {
    deselectLine();
  }, [deselectLine]);

  // ✅ Compute line statuses from translation progress
  // Maps global line index to its translation status
  const lineStatuses = React.useMemo<
    Record<number, TranslationStanzaStatus> | undefined
  >(() => {
    if (!translationProgress || !poemStanzas) {
      return undefined;
    }

    const statuses: Record<number, TranslationStanzaStatus> = {};
    let globalLineIndex = 0;

    // Use chunks (new) or stanzas (legacy) for compatibility
    const chunkStates =
      translationProgress.chunks || translationProgress.stanzas || {};

    // Iterate through each stanza
    poemStanzas.stanzas.forEach((stanza, stanzaIdx) => {
      const stanzaState = chunkStates[stanzaIdx];
      if (!stanzaState) {
        // Chunk not yet processed - all lines are pending
        stanza.lines.forEach(() => {
          statuses[globalLineIndex] = "pending";
          globalLineIndex++;
        });
        return;
      }

      const stanzaStatus = stanzaState.status;
      const translatedLines = stanzaState.lines || [];

      // Map each line in the stanza to its status
      stanza.lines.forEach(() => {
        // Check if this line has been translated
        const translatedLine = translatedLines.find(
          (tl) => tl.line_number === globalLineIndex
        );

        if (stanzaStatus === "completed") {
          // Stanza completed - line is completed if it was translated
          statuses[globalLineIndex] = translatedLine ? "completed" : "pending";
        } else if (stanzaStatus === "processing") {
          // Stanza is processing - line is completed if translated, otherwise processing
          statuses[globalLineIndex] = translatedLine
            ? "completed"
            : "processing";
        } else if (stanzaStatus === "queued") {
          // Stanza is queued - line is queued
          statuses[globalLineIndex] = "queued";
        } else if (stanzaStatus === "failed") {
          // Stanza failed - line is failed
          statuses[globalLineIndex] = "failed";
        } else {
          // Stanza is pending - line is pending
          statuses[globalLineIndex] = "pending";
        }

        globalLineIndex++;
      });
    });

    return statuses;
  }, [translationProgress, poemStanzas]);

  // ✅ Show locked state if workshop not unlocked
  if (!isWorkshopUnlocked) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Workshop Locked
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Complete the Guide Rail setup on the left to unlock the workshop.
              Fill in all required fields and confirm to begin.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>✓ Add your poem</p>
              <p>✓ Define translation zone</p>
              <p>✓ Set translation intent</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show welcome message if no poem or chunks
  if (!poem.text || !poemStanzas || poemStanzas.totalStanzas === 0) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No Poem Loaded
            </h3>
            <p className="text-sm text-gray-500">
              Complete the Guide Rail on the left to analyze a poem and start
              translating.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1: If no chunk selected, show chunk selector
  if (selectedStanzaIndex === null) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />

        {/* ✅ Re-enabled: Show translation progress */}
        {shouldPollTranslations && translationProgress && (
          <>
            <ProcessingProgress
              summary={translationProgress}
              showDetails={false}
              onRetry={() => translationJobQuery.refetch()}
            />
            <StanzaProgressPanel
              summary={translationProgress}
              stanzaResult={undefined}
              threadId={threadId || undefined}
              onRetry={() => translationJobQuery.refetch()}
            />
          </>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <WorkshopNavigationToggle
            title="Chunk selection"
            subtitle="Step 1 • Choose a chunk"
            activeTab="chunks"
            onChunksClick={() => {}}
            onLinesClick={() => {}}
            disableChunks
            disableLines
            lineLabel="Lines (select a chunk first)"
          />
          <h2 className="text-xl font-bold mb-4">Select a Chunk</h2>
          <div className="space-y-2">
            {poemStanzas.stanzas.map((stanza, idx) => {
              // ✅ Get real chunk status from translation progress (use chunks or stanzas)
              const progressChunks =
                translationProgress?.chunks || translationProgress?.stanzas;
              const stanzaStatus: TranslationStanzaStatus =
                progressChunks?.[idx]?.status ?? "pending";
              const statusMeta = getStatusMeta(stanzaStatus);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedStanzaIndex(idx);
                    // Reset line selection when switching chunks
                    if (selectedLineIndex !== null) {
                      deselectLine();
                    }
                  }}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-lg">
                      Chunk {stanza.number}
                    </div>
                    {statusMeta && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {stanza.lines.length} line
                    {stanza.lines.length !== 1 ? "s" : ""}
                  </div>
                  {/* Preview first line */}
                  <div className="text-sm text-gray-500 italic">
                    {stanza.lines[0]}...
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Chunk is selected, show lines within that chunk
  const currentStanza = poemStanzas.stanzas[selectedStanzaIndex];
  const stanzaLines = currentStanza.lines;

  // Use the already-calculated global line offset
  const globalLineOffset = globalLineOffsetForContext;
  const currentLineNumber =
    selectedLineIndex !== null
      ? selectedLineIndex - globalLineOffset + 1
      : null;

  return (
    <div className="h-full flex flex-col">
      <WorkshopHeader />

      {/* ✅ Re-enabled: Show translation progress */}
      {shouldPollTranslations && translationProgress && (
        <>
          <ProcessingProgress
            summary={translationProgress}
            showDetails={false}
            onRetry={() => translationJobQuery.refetch()}
          />
          <StanzaProgressPanel
            summary={translationProgress}
            stanzaResult={undefined}
            threadId={threadId || undefined}
            onRetry={() => translationJobQuery.refetch()}
          />
        </>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <WorkshopNavigationToggle
          title={`Chunk ${currentStanza.number}`}
          subtitle={
            selectedLineIndex === null
              ? "Step 2 • Choose a line"
              : `Line ${currentLineNumber} in focus`
          }
          activeTab="lines"
          onChunksClick={goToChunkSelection}
          onLinesClick={showLineSelection}
        />
        {/* Current chunk title */}
        <h2 className="text-xl font-bold mb-4">Chunk {currentStanza.number}</h2>

        {/* Line selector */}
        {selectedLineIndex === null ? (
          <div className="space-y-2">
            {stanzaLines.map((line, idx) => {
              const globalLineIndex = globalLineOffset + idx;
              const lineStatus = lineStatuses?.[globalLineIndex];
              const statusMeta = lineStatus ? getStatusMeta(lineStatus) : null;

              return (
                <LineClickHandler
                  key={idx}
                  lineText={line}
                  lineNumber={idx + 1}
                  stanzaNumber={currentStanza.number}
                  status={lineStatus}
                  statusMeta={statusMeta}
                  isSelected={selectedLineIndex === globalLineIndex}
                  onSelect={() => selectLine(globalLineIndex)}
                  onRetry={
                    lineStatus === "failed" &&
                    threadId &&
                    selectedStanzaIndex !== null
                      ? async () => {
                          // Retry failed stanza by calling retry API
                          try {
                            const response = await fetch(
                              "/api/workshop/retry-stanza",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  threadId,
                                  stanzaIndex: selectedStanzaIndex,
                                }),
                              }
                            );
                            if (response.ok) {
                              // Refetch translation job to get updated status
                              await translationJobQuery.refetch();
                            }
                          } catch (error) {
                            console.error("Failed to retry stanza:", error);
                          }
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ) : (
          <WordGrid
            threadId={threadId || undefined}
            lineContext={lineContext}
          />
        )}
      </div>

      {selectedLineIndex !== null ? <CompilationFooter /> : null}
    </div>
  );
}

type WorkshopNavTab = "chunks" | "lines";

interface WorkshopNavigationToggleProps {
  title: string;
  subtitle?: string;
  activeTab: WorkshopNavTab;
  onChunksClick: () => void;
  onLinesClick: () => void;
  chunkLabel?: string;
  lineLabel?: string;
  disableChunks?: boolean;
  disableLines?: boolean;
}

function WorkshopNavigationToggle({
  title,
  subtitle,
  activeTab,
  onChunksClick,
  onLinesClick,
  chunkLabel = "Chunks",
  lineLabel = "Lines",
  disableChunks = false,
  disableLines = false,
}: WorkshopNavigationToggleProps) {
  const baseBtn =
    "rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2";
  const activeClasses = "bg-slate-900 text-white shadow";
  const inactiveClasses = "text-slate-600 hover:bg-slate-100";
  const disabledClasses = "opacity-40 cursor-not-allowed hover:bg-transparent";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        {subtitle ? (
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {subtitle}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => {
            if (!disableChunks) onChunksClick();
          }}
          className={`${baseBtn} ${
            activeTab === "chunks" ? activeClasses : inactiveClasses
          } ${disableChunks ? disabledClasses : ""}`}
          disabled={disableChunks}
        >
          {chunkLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!disableLines) onLinesClick();
          }}
          className={`${baseBtn} ${
            activeTab === "lines" ? activeClasses : inactiveClasses
          } ${disableLines ? disabledClasses : ""}`}
          disabled={disableLines}
        >
          {lineLabel}
        </button>
      </div>
    </div>
  );
}
