"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useTranslationJob } from "@/lib/hooks/useTranslationJob";
import { useWorkshopState } from "@/lib/hooks/useWorkshopFlow";
import { WorkshopHeader } from "@/components/workshop-rail/WorkshopHeader";
import { WordGrid } from "@/components/workshop-rail/WordGrid";
import { StanzaProgressPanel } from "@/components/workshop-rail/StanzaProgressPanel";
import { ProcessingProgress } from "@/components/workshop/ProcessingProgress";
import { LineClickHandler } from "@/components/workshop-rail/LineClickHandler";
import { getStatusMeta } from "@/components/workshop-rail/stanzaStatusMeta";
import type {
  TranslationStanzaStatus,
  TranslationJobProgressSummary,
} from "@/types/translationJob";
import type { LineTranslationVariant } from "@/types/lineTranslation";

interface WorkshopRailProps {
  showHeaderTitle?: boolean;
}

export function WorkshopRail({ showHeaderTitle = true }: WorkshopRailProps) {
  const t = useTranslations("Workshop");
  const threadId = useThreadId();
  const poem = useGuideStore((s) => s.poem);
  const guideStep = useGuideStore((s) => s.currentStep);
  const isWorkshopUnlocked = useGuideStore((s) => s.isWorkshopUnlocked);
  const workshopHydrated = useWorkshopStore((s) => s.hydrated);
  const {
    currentLineIndex,
    poemLines,
    setPoemLines,
    reset,
    selectLine,
    deselectLine,
  } = useWorkshopStore();
  // Re-enabled: Background translation hydration
  const setLineTranslation = useWorkshopStore((s) => s.setLineTranslation);
  const setCompletedLines = useWorkshopStore((s) => s.setCompletedLines);

  // ✅ Authoritative saved lines from Supabase (chat_threads.state.workshop_lines)
  // Important: this should be the ONLY source of completedLines hydration.
  const { data: savedWorkshopLines } = useWorkshopState(threadId || undefined);

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

  // ✅ Hydrate completed lines from Supabase saved state
  React.useEffect(() => {
    if (!threadId || !savedWorkshopLines) return;

    // ✅ ALWAYS hydrate from DB - it's the source of truth
    // localStorage is just a cache, DB has the authoritative state
    const mapped: Record<number, string> = {};

    // Handle both array format (new) and object format (legacy)
    if (Array.isArray(savedWorkshopLines)) {
      // Array format: index = line number
      savedWorkshopLines.forEach((v, idx) => {
        if (!v || typeof v !== "object") return;
        const translated = (v as { translated?: string }).translated;
        if (typeof translated === "string" && translated.trim().length > 0) {
          mapped[idx] = translated;
        }
      });
    } else {
      // Object format: key = line number
      Object.entries(savedWorkshopLines).forEach(([k, v]) => {
        const idx = Number(k);
        if (Number.isNaN(idx)) return;
        if (!v || typeof v !== "object") return;
        const translated = (v as { translated?: string }).translated;
        if (typeof translated === "string" && translated.trim().length > 0) {
          mapped[idx] = translated;
        }
      });
    }

    if (Object.keys(mapped).length > 0) {
      console.log(
        `[WorkshopRail] Hydrating ${
          Object.keys(mapped).length
        } saved completed lines from Supabase`
      );
      setCompletedLines(mapped);
    } else {
      // Clear if DB has no lines (user may have reset)
      console.log("[WorkshopRail] No saved lines in DB, clearing local state");
      setCompletedLines({});
    }
  }, [threadId, savedWorkshopLines, setCompletedLines]);

  // Reset stanza selection when poem changes
  React.useEffect(() => {
    if (!poem.text && selectedStanzaIndex !== null) {
      setSelectedStanzaIndex(null);
    }
  }, [poem.text, selectedStanzaIndex]);

  // Auto-update selectedStanzaIndex when currentLineIndex changes (e.g., from Notebook click)
  React.useEffect(() => {
    if (currentLineIndex === null || !poemStanzas) {
      return;
    }

    // Calculate which stanza contains the current line
    let lineCount = 0;
    for (let i = 0; i < poemStanzas.stanzas.length; i++) {
      const stanza = poemStanzas.stanzas[i];
      const stanzaStartLine = lineCount;
      const stanzaEndLine = lineCount + stanza.lines.length - 1;

      // Check if currentLineIndex falls within this stanza
      if (
        currentLineIndex >= stanzaStartLine &&
        currentLineIndex <= stanzaEndLine
      ) {
        // Update selectedStanzaIndex if it's different or null
        if (selectedStanzaIndex !== i) {
          setSelectedStanzaIndex(i);
        }
        return;
      }

      lineCount += stanza.lines.length;
    }
  }, [
    currentLineIndex,
    poemStanzas,
    selectedStanzaIndex,
    setSelectedStanzaIndex,
  ]);

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
    if (currentLineIndex === null || selectedStanzaIndex === null) return null;

    const currentStanza = poemStanzas?.stanzas[selectedStanzaIndex];
    if (!currentStanza) return null;

    // Calculate local line index within the stanza
    const localLineIndex = currentLineIndex - globalLineOffsetForContext;

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
    currentLineIndex,
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

    // Use segments (new) or stanzas (legacy) for compatibility
    const chunkStates =
      translationProgress.chunks || translationProgress.stanzas || {};

    // Iterate through each stanza
    poemStanzas.stanzas.forEach((stanza, stanzaIdx) => {
      const stanzaState = chunkStates[stanzaIdx];
      if (!stanzaState) {
        // Segment not yet processed - all lines are pending
        stanza.lines.forEach(() => {
          statuses[globalLineIndex] = "pending";
          globalLineIndex++;
        });
        return;
      }

      const stanzaStatus = stanzaState.status;
      const translatedLines = stanzaState.lines || [];

      // ✅ CRITICAL FIX: Use line-level translationStatus instead of just checking existence
      stanza.lines.forEach(() => {
        // Find the actual line data from the job state
        const translatedLine = translatedLines.find(
          (tl) => tl.line_number === globalLineIndex
        );

        // ✅ NEW: Check line's translationStatus for accurate status
        const lineTranslationStatus = translatedLine?.translationStatus;

        if (stanzaStatus === "completed") {
          // Chunk is completed - check individual line status
          if (translatedLine) {
            // Line data exists - use its status
            if (lineTranslationStatus === "translated") {
              statuses[globalLineIndex] = "completed";
            } else if (lineTranslationStatus === "failed") {
              statuses[globalLineIndex] = "failed";
            } else {
              // Line exists but status is pending or missing - this is a bug
              console.warn(
                `[WorkshopRail] Line ${globalLineIndex} in completed chunk has status: ${lineTranslationStatus}`
              );
              statuses[globalLineIndex] = "pending";
            }
          } else {
            // Line data missing from completed chunk - mark as failed
            console.error(
              `[WorkshopRail] Line ${globalLineIndex} missing from completed chunk ${stanzaIdx}`
            );
            statuses[globalLineIndex] = "failed";
          }
        } else if (stanzaStatus === "processing") {
          // Stanza is processing - check if this specific line is done
          if (
            translatedLine &&
            lineTranslationStatus === "translated"
          ) {
            statuses[globalLineIndex] = "completed";
          } else if (
            translatedLine &&
            lineTranslationStatus === "failed"
          ) {
            statuses[globalLineIndex] = "failed";
          } else {
            statuses[globalLineIndex] = "processing";
          }
        } else if (stanzaStatus === "queued") {
          // Stanza is queued - line is queued
          statuses[globalLineIndex] = "queued";
        } else if (stanzaStatus === "failed") {
          // Stanza failed - check if individual lines succeeded before failure
          if (
            translatedLine &&
            lineTranslationStatus === "translated"
          ) {
            // This line was translated before chunk failed
            statuses[globalLineIndex] = "completed";
          } else {
            // Line failed or never processed
            statuses[globalLineIndex] = "failed";
          }
        } else {
          // Stanza is pending - line is pending
          statuses[globalLineIndex] = "pending";
        }

        globalLineIndex++;
      });
    });

    return statuses;
  }, [translationProgress, poemStanzas]);

  // ✅ Hydrate background translations into workshop store (lineTranslations only)
  React.useEffect(() => {
    if (!translationJobQuery.data?.job || !threadId) {
      return;
    }

    const job = translationJobQuery.data.job;
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};

    // Track hydration stats for debugging
    let hydratedCount = 0;
    let emptyCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    // Iterate through all segments/stanzas to collect translated lines
    Object.values(chunkOrStanzaStates).forEach((chunk) => {
      if (chunk.lines && Array.isArray(chunk.lines)) {
        chunk.lines.forEach((line) => {
          if (line.line_number === undefined) return;

          // ✅ CRITICAL FIX: Handle all line states, not just "translated"
          const lineStatus = line.translationStatus;

          if (lineStatus === "translated") {
            // For non-empty lines with 3 variants
            if (line.translations && line.translations.length === 3) {
              setLineTranslation(line.line_number, {
                lineOriginal:
                  line.original_text || poemLines[line.line_number] || "",
                translations: line.translations as [
                  LineTranslationVariant,
                  LineTranslationVariant,
                  LineTranslationVariant
                ],
                modelUsed: line.model_used || "unknown",
              });
              hydratedCount++;
            }
            // ✅ For empty lines (translations: [], but translationStatus: "translated")
            else if (
              line.translations &&
              line.translations.length === 0 &&
              (!line.original_text || line.original_text.trim() === "")
            ) {
              // Empty lines don't need translation variants - they're just markers
              // The UI will skip them automatically when rendering
              emptyCount++;
              console.log(
                `[WorkshopRail] Empty line ${line.line_number} marked as translated`
              );
            } else {
              // Line marked as translated but has wrong number of translations
              console.warn(
                `[WorkshopRail] Line ${line.line_number} marked as translated but has ${line.translations?.length ?? 0} translations (expected 3 or 0 for empty)`
              );
            }
          } else if (lineStatus === "failed") {
            // ✅ NEW: Track failed lines for visibility
            failedCount++;
            console.warn(
              `[WorkshopRail] Line ${line.line_number} failed translation`
            );
            // Note: Failed lines don't get hydrated into lineTranslations
            // They will show as "failed" in the UI via lineStatuses
          } else if (lineStatus === "pending" || !lineStatus) {
            // ✅ NEW: Track pending lines for debugging
            pendingCount++;
            // Note: Don't log every pending line to avoid spam
          }
        });
      }
    });

    // Log hydration summary for debugging
    const totalProcessed = hydratedCount + emptyCount + failedCount + pendingCount;
    if (totalProcessed > 0) {
      console.log(
        `[WorkshopRail] Hydration summary: ${hydratedCount} translated, ${emptyCount} empty, ${failedCount} failed, ${pendingCount} pending (total: ${totalProcessed})`
      );
    }
  }, [translationJobQuery.data, threadId, setLineTranslation, poemLines]);

  // Avoid UI/state races with persisted hydration (can otherwise auto-select a line
  // after the user clicks a segment).
  if (!workshopHydrated) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-sm text-foreground-secondary">Loading workshop…</div>
        </div>
      </div>
    );
  }

  // ✅ Show locked state if workshop not unlocked
  if (!isWorkshopUnlocked) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg
                className="w-8 h-8 text-foreground-muted"
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
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Workshop Locked
            </h3>
            <p className="text-sm text-foreground-secondary mb-4">
              Complete the Guide Rail setup on the left to unlock the workshop.
              Fill in all required fields and confirm to begin.
            </p>
            <div className="text-xs text-foreground-muted space-y-1">
              <p>✓ Add your poem</p>
              <p>✓ Define translation zone</p>
              <p>✓ Set translation intent</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show welcome message if no poem or segments
  if (!poem.text || !poemStanzas || poemStanzas.totalStanzas === 0) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader showTitle={showHeaderTitle} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <h3 className="text-lg font-medium text-foreground-secondary mb-2">
              No Poem Loaded
            </h3>
            <p className="text-sm text-foreground-muted">
              Complete the Guide Rail on the left to analyze a poem and start
              translating.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1: If no segment selected, show segment selector
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
            title={t("segmentSelection")}
            subtitle={t("step1ChooseSegment")}
            activeTab="chunks"
            onChunksClick={() => {}}
            onLinesClick={() => {}}
            disableChunks
            disableLines
            lineLabel={t("linesSelectSegmentFirst")}
          />
          <h2 className="text-xl font-bold mb-4">{t("selectSegment")}</h2>
          <div className="space-y-2">
            {poemStanzas.stanzas.map((stanza, idx) => {
              // ✅ Get real segment status from translation progress (use chunks or stanzas)
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
                    // Reset line selection when switching segments
                    deselectLine();
                  }}
                  className="p-4 border border-border-subtle rounded-md cursor-pointer hover:bg-accent-light/20 hover:border-accent/50 transition-all duration-fast shadow-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-lg text-foreground">
                      {t("segment", { number: stanza.number })}
                    </div>
                    {statusMeta && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground-secondary mb-2">
                    {stanza.lines.length} line
                    {stanza.lines.length !== 1 ? "s" : ""}
                  </div>
                  {/* Preview first line */}
                  <div className="text-sm text-foreground-muted italic font-serif">
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

  // STEP 2: Segment is selected, show lines within that segment
  const currentStanza = poemStanzas.stanzas[selectedStanzaIndex];
  const stanzaLines = currentStanza.lines;

  // Use the already-calculated global line offset
  const globalLineOffset = globalLineOffsetForContext;
  const currentLineNumber =
    currentLineIndex !== null ? currentLineIndex - globalLineOffset + 1 : null;

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
          title={t("segment", { number: currentStanza.number })}
          subtitle={
            currentLineIndex === null
              ? t("step2ChooseLine")
              : t("lineInFocus", { number: currentLineNumber! })
          }
          activeTab="lines"
          onChunksClick={goToChunkSelection}
          onLinesClick={showLineSelection}
        />
        {/* Current segment title */}
        <h2 className="text-xl font-bold mb-4">
          {t("segment", { number: currentStanza.number })}
        </h2>

        {/* Line selector */}
        {currentLineIndex === null ? (
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
                  isSelected={currentLineIndex === globalLineIndex}
                  onSelect={() => selectLine(globalLineIndex)}
                  onRetry={
                    lineStatus === "failed" &&
                    threadId &&
                    selectedStanzaIndex !== null
                      ? async () => {
                          // ✅ NEW: Retry individual failed line (not entire stanza)
                          console.log(
                            `[WorkshopRail] Retrying line ${globalLineIndex} in stanza ${selectedStanzaIndex}`
                          );
                          try {
                            const response = await fetch(
                              "/api/workshop/retry-line",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  threadId,
                                  stanzaIndex: selectedStanzaIndex,
                                  lineNumber: globalLineIndex,
                                }),
                              }
                            );

                            if (!response.ok) {
                              const errorData = await response.json();
                              console.error(
                                `[WorkshopRail] Line retry failed:`,
                                errorData
                              );
                              alert(
                                `Failed to retry line: ${errorData.error || "Unknown error"}`
                              );
                              return;
                            }

                            const result = await response.json();
                            console.log(
                              `[WorkshopRail] Line retry successful:`,
                              result
                            );

                            // Refetch translation job to get updated status
                            await translationJobQuery.refetch();

                            // Show success message
                            console.log(
                              `✅ Line ${globalLineIndex} successfully retried and translated`
                            );
                          } catch (error) {
                            console.error("Failed to retry line:", error);
                            alert(
                              `Failed to retry line: ${error instanceof Error ? error.message : "Unknown error"}`
                            );
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
  chunkLabel = "Segments",
  lineLabel = "Lines",
  disableChunks = false,
  disableLines = false,
}: WorkshopNavigationToggleProps) {
  const baseBtn =
    "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
  const activeClasses = "bg-accent text-white shadow-card";
  const inactiveClasses = "text-foreground-secondary hover:bg-muted";
  const disabledClasses = "opacity-40 cursor-not-allowed hover:bg-transparent";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-muted px-4 py-3">
      <div>
        {subtitle ? (
          <p className="text-xs uppercase tracking-wide text-foreground-muted">
            {subtitle}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="inline-flex rounded-full border border-border-subtle bg-surface p-1">
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
