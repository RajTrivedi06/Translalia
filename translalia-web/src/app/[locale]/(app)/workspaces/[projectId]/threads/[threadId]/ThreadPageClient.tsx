"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ArrowLeft } from "lucide-react";
import { GuideRail } from "@/components/guide";
import { WorkshopRail } from "@/components/workshop-rail/WorkshopRail";
import { NotebookViewContainer } from "@/components/notebook/NotebookViewContainer";
import { ReflectionRail } from "@/components/reflection-rail/ReflectionRail";
import { CollapsedPanelTab } from "../../../../../../../components/common/CollapsedPanelTab";
import {
  setActiveThreadId,
  clearActiveThreadId,
  getActiveThreadId,
  initializeThreadId,
  threadStorage,
} from "@/lib/threadStorage";
import { type DragData } from "@/types/drag";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNotebookStore } from "@/store/notebookSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { routes } from "@/lib/routers";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

interface ThreadPageClientProps {
  projectId: string;
  threadId: string;
}

export default function ThreadPageClient({
  projectId,
  threadId,
}: ThreadPageClientProps) {
  const t = useTranslations("Thread");

  // ============================================================
  // CRITICAL: Set thread ID SYNCHRONOUSLY before ANY store access
  // This prevents store hydration from using stale thread IDs
  // ============================================================
  if (typeof window !== "undefined") {
    const currentCachedId = getActiveThreadId();

    // Force update if different from what we expect
    if (currentCachedId !== threadId) {
      console.log(
        `[ThreadPageClient] Synchronously setting thread ID: ${currentCachedId} → ${threadId}`
      );
      setActiveThreadId(threadId ?? null);
    }
  }

  // NOW safe to access stores (they will hydrate with correct thread ID)
  const guideState = useGuideStore();
  const workshopState = useWorkshopStore();
  const notebookState = useNotebookStore();

  // Get workshop store functions for drag-and-drop
  const appendToDraft = useWorkshopStore((s) => s.appendToDraft);
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const setCurrentLineIndex = useWorkshopStore((s) => s.setCurrentLineIndex);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  // Get workshop state to determine initial collapse state
  const guideStoreHydrated = useGuideStore((s) => s.hydrated);
  const guideStoreMeta = useGuideStore((s) => s.meta);
  const isWorkshopUnlocked = useGuideStore((s) => s.isWorkshopUnlocked);
  const workshopStoreHydrated = useWorkshopStore((s) => s.hydrated);
  const workshopStoreMeta = useWorkshopStore((s) => s.meta);
  const completedLines = useWorkshopStore((s) => s.completedLines);

  // Initialize collapse state to false for new threads
  // Will be updated in useEffect based on actual thread state
  const [isGettingStartedCollapsed, setIsGettingStartedCollapsed] =
    useState(false);

  // Track if user manually expanded the Guide Rail (should show in full width)
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);

  // Track collapsed state for Workshop, Notebook, and Reflection
  // When workshop starts: Workshop and Notebook are open (not collapsed)
  // Only 1-2 sections can be open at once (besides "Let's get started")
  const [isWorkshopCollapsed, setIsWorkshopCollapsed] = useState(true);
  const [isNotebookCollapsed, setIsNotebookCollapsed] = useState(true);
  const [isReflectionCollapsed, setIsReflectionCollapsed] = useState(true);

  // Startup focus mode: show Guide Rail at 80% width when:
  // 1. Workshop is not unlocked AND Guide Rail is not collapsed, OR
  // 2. User manually expanded the Guide Rail (regardless of workshop state)
  const isStartupFocusMode =
    (!isWorkshopUnlocked && !isGettingStartedCollapsed) ||
    (isManuallyExpanded && !isGettingStartedCollapsed);

  // Reset and update collapse state when threadId changes or store state updates
  // Only collapse if:
  // 1. Stores are hydrated
  // 2. The store's meta.threadId matches the current threadId (ensures we're looking at the right thread's data)
  // 3. AND (workshop is unlocked OR has existing work)
  useEffect(() => {
    // Wait for stores to be hydrated before making decisions
    if (!guideStoreHydrated || !workshopStoreHydrated) {
      // Keep expanded while stores are hydrating
      setIsGettingStartedCollapsed(false);
      return;
    }

    // Verify we're looking at the correct thread's store data
    const isGuideStoreForThisThread = guideStoreMeta.threadId === threadId;
    const isWorkshopStoreForThisThread =
      workshopStoreMeta.threadId === threadId;

    // Only use store values if they belong to this thread
    if (isGuideStoreForThisThread && isWorkshopStoreForThisThread) {
      const hasWorkshopData = Object.keys(completedLines || {}).length > 0;
      if (isWorkshopUnlocked || hasWorkshopData) {
        setIsGettingStartedCollapsed(true);
        setIsManuallyExpanded(false); // Reset manual expansion on auto-collapse
      } else {
        // If no work exists for this thread, ensure it's expanded
        setIsGettingStartedCollapsed(false);
        setIsManuallyExpanded(false); // Reset manual expansion
      }
    } else {
      // If stores are for a different thread, start expanded
      setIsGettingStartedCollapsed(false);
      setIsManuallyExpanded(false); // Reset manual expansion
    }
  }, [
    threadId,
    guideStoreHydrated,
    guideStoreMeta.threadId,
    workshopStoreHydrated,
    workshopStoreMeta.threadId,
    isWorkshopUnlocked,
    completedLines,
  ]);

  // Persist collapse state to threadStorage
  useEffect(() => {
    threadStorage.setItem("guide-collapsed", String(isGettingStartedCollapsed));
  }, [isGettingStartedCollapsed]);

  // ============================================================
  // Effect: Initialize thread ID properly after mount
  // ============================================================
  useEffect(() => {
    // Double-check: Update stores with thread ID
    if (threadId) {
      // Ensure all stores have correct thread ID
      if (guideState.meta.threadId !== threadId) {
        useGuideStore.getState().setThreadId(threadId);
      }
      if (workshopState.meta.threadId !== threadId) {
        useWorkshopStore.getState().setThreadId(threadId);
      }
      if (notebookState.meta.threadId !== threadId) {
        useNotebookStore.getState().setThreadId(threadId);
      }

      // Initialize thread storage
      initializeThreadId(threadId);
    }

    // Double-check: If stores have wrong thread ID, reset them
    const guideThreadId = guideState.meta.threadId;
    const workshopThreadId = workshopState.meta.threadId;
    const notebookThreadId = notebookState.meta.threadId;

    if (guideThreadId && guideThreadId !== threadId) {
      console.log(
        `[ThreadPageClient] Detected stale guide state. Resetting from ${guideThreadId} to ${threadId}`
      );
      useGuideStore.getState().resetToDefaults();
    }

    if (workshopThreadId && workshopThreadId !== threadId) {
      console.log(
        `[ThreadPageClient] Detected stale workshop state. Resetting from ${workshopThreadId} to ${threadId}`
      );
      useWorkshopStore.getState().resetToDefaults();
    }

    if (notebookThreadId && notebookThreadId !== threadId) {
      console.log(
        `[ThreadPageClient] Detected stale notebook state. Resetting from ${notebookThreadId} to ${threadId}`
      );
      useNotebookStore.getState().resetToDefaults();
    }

    // Cleanup on unmount
    return () => {
      clearActiveThreadId();
    };
  }, [
    threadId,
    guideState.meta.threadId,
    workshopState.meta.threadId,
    notebookState.meta.threadId,
  ]);

  // ============================================================
  // Effect: Cross-store coordination (guide <-> workshop)
  // ============================================================
  useEffect(() => {
    // If workshop has data, ensure guide is unlocked and collapsed
    const hasWorkshopData =
      Object.keys(workshopState.completedLines || {}).length > 0;

    if (hasWorkshopData && !guideState.isWorkshopUnlocked) {
      console.log("[ThreadPageClient] Workshop has data. Unlocking guide.");
      useGuideStore.getState().unlockWorkshop();
    }

    if (hasWorkshopData || guideState.isWorkshopUnlocked) {
      setIsGettingStartedCollapsed(true);
      setIsManuallyExpanded(false); // Reset manual expansion on auto-collapse

      // When workshop starts: Workshop and Notebook should be open
      setIsWorkshopCollapsed(false);
      setIsNotebookCollapsed(false);
      setIsReflectionCollapsed(true); // Reflection starts collapsed
    }
  }, [workshopState.completedLines, guideState.isWorkshopUnlocked]);

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData;
    setActiveDragData(dragData);
  };

  // Handlers for toggling Workshop, Notebook, and Reflection sections
  // Rules:
  // - "Let's get started" must always be open if all other sections are collapsed
  // - Other sections can't open until workshop is unlocked/started
  // - Only 2 of the 3 sections (Workshop, Notebook, Reflection) can be open at a time
  // - Either Notebook + Workshop OR Notebook + Reflection
  // - Workshop and Reflection cannot both be open simultaneously
  // - All sections maintain their position (order: Workshop, Notebook, Reflection)
  const handleToggleWorkshop = () => {
    // Prevent opening if workshop hasn't started
    if (isWorkshopCollapsed && !isWorkshopUnlocked) {
      return;
    }

    if (isWorkshopCollapsed) {
      // Opening Workshop: close Reflection if it's open, ensure Notebook is open
      setIsWorkshopCollapsed(false);
      setIsReflectionCollapsed(true);
      setIsNotebookCollapsed(false);
    } else {
      // Closing Workshop: only allow if Reflection is open (so we still have Notebook + Reflection)
      if (!isReflectionCollapsed) {
        setIsWorkshopCollapsed(true);
      }
    }
  };

  const handleToggleNotebook = () => {
    // Prevent opening if workshop hasn't started
    if (isNotebookCollapsed && !isWorkshopUnlocked) {
      return;
    }
    setIsNotebookCollapsed(!isNotebookCollapsed);
  };

  const handleToggleReflection = () => {
    // Prevent opening if workshop hasn't started
    if (isReflectionCollapsed && !isWorkshopUnlocked) {
      return;
    }

    if (isReflectionCollapsed) {
      // Opening Reflection: close Workshop if it's open, ensure Notebook is open
      setIsReflectionCollapsed(false);
      setIsWorkshopCollapsed(true);
      setIsNotebookCollapsed(false);
    } else {
      // Closing Reflection: only allow if Workshop is open (so we still have Notebook + Workshop)
      if (!isWorkshopCollapsed) {
        setIsReflectionCollapsed(true);
      }
    }
  };

  // Ensure "Let's get started" is always open if all other sections are collapsed
  useEffect(() => {
    const allOtherSectionsCollapsed =
      isWorkshopCollapsed && isNotebookCollapsed && isReflectionCollapsed;

    if (allOtherSectionsCollapsed && isGettingStartedCollapsed) {
      // If all sections including "Let's get started" are collapsed, open "Let's get started"
      setIsGettingStartedCollapsed(false);
    }
  }, [
    isWorkshopCollapsed,
    isNotebookCollapsed,
    isReflectionCollapsed,
    isGettingStartedCollapsed,
  ]);

  // Prevent "Let's get started" from being collapsed if all other sections are collapsed
  const handleToggleGettingStarted = () => {
    const allOtherSectionsCollapsed =
      isWorkshopCollapsed && isNotebookCollapsed && isReflectionCollapsed;

    // If trying to collapse "Let's get started" and all other sections are already collapsed, prevent it
    if (allOtherSectionsCollapsed && !isGettingStartedCollapsed) {
      // Can't collapse if all other sections are already collapsed
      return;
    }

    setIsGettingStartedCollapsed((prev) => {
      const newState = !prev;
      if (newState) {
        // Collapsing: clear manual expansion flag
        setIsManuallyExpanded(false);
      } else {
        // Expanding: set manual expansion flag to show in full width
        setIsManuallyExpanded(true);
      }
      return newState;
    });
  };

  // Animation variants for panel transitions
  const panelVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);

    const { active, over } = event;

    if (!over) return;

    // Handle drop on notebook dropzone - append text to draft
    // Support both old "notebook-dropzone" and new line-specific "notebook-dropzone-line-X" IDs
    const isNotebookDropzone =
      over.id === "notebook-dropzone" ||
      String(over.id).startsWith("notebook-dropzone-line-");

    if (isNotebookDropzone) {
      const dragData = active.data.current as DragData;

      // Extract line index from dropzone ID if it's line-specific
      let targetLine: number;
      if (String(over.id).startsWith("notebook-dropzone-line-")) {
        const lineIndexMatch = String(over.id).match(
          /notebook-dropzone-line-(\d+)/
        );
        targetLine = lineIndexMatch
          ? parseInt(lineIndexMatch[1], 10)
          : dragData.sourceLineNumber ?? currentLineIndex ?? 0;
      } else {
        // Use source line number if available, otherwise current line
        targetLine = dragData.sourceLineNumber ?? currentLineIndex ?? 0;
      }

      // If dropping a word from a different line, navigate to that line first
      if (targetLine !== currentLineIndex) {
        setCurrentLineIndex(targetLine);
      }

      // Append the word text to the draft
      appendToDraft(targetLine, dragData.text);
    }

    // Cell reordering removed - no longer using cells
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Soft neutral background that fills entire viewport */}
      <div className="flex h-[calc(100vh-var(--header-h))] w-full flex-col bg-[#f5f5f7]">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/80 px-6 py-3 backdrop-blur-sm sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-4">
                <Link href={routes.workspaceChats(projectId)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back to Threads</span>
                    <span className="sm:hidden">Back</span>
                  </Button>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <h1 className="text-xl font-semibold tracking-tight text-slate-500 sm:text-2xl">
                  {t("title")}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Main area – fills remaining viewport height */}
        <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2 pt-2 md:px-4 sm:px-6 lg:px-8">
          <div
            className={cn(
              "relative grid h-full min-h-0 gap-0",
              "transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            )}
            style={{
              // Startup focus: flexible guide (approx 80% equivalent), thin fixed-width tabs (60px each = 180px total).
              // Working mode: maintain order - each section can be open (1fr) or collapsed (60px)
              gridTemplateColumns: isStartupFocusMode
                ? "1fr 60px 60px 60px"
                : (() => {
                    const guideCol = isGettingStartedCollapsed
                      ? "60px"
                      : "minmax(280px,18%)";
                    const workshopCol = isWorkshopCollapsed ? "60px" : "1fr";
                    const notebookCol = isNotebookCollapsed ? "60px" : "1fr";
                    const reflectionCol = isReflectionCollapsed
                      ? "60px"
                      : "1fr";
                    return `${guideCol} ${workshopCol} ${notebookCol} ${reflectionCol}`;
                  })(),
            }}
          >
            {/* LEFT: Let's get started / collapsed rail */}
            <motion.div
              layout
              className={cn(
                "relative flex h-full min-h-0 flex-col overflow-hidden rounded-l-2xl rounded-r-none",
                isGettingStartedCollapsed
                  ? "bg-white shadow-sm transition-colors duration-500 bg-white/70 hover:bg-white/90"
                  : "bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
              )}
            >
              <AnimatePresence mode="wait">
                {!isGettingStartedCollapsed ? (
                  <motion.div
                    key="full-guide"
                    variants={panelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex h-full flex-col"
                  >
                    <div className="relative px-4 py-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                          {t("gettingStarted")}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleGettingStarted}
                        className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                        aria-label={t("collapseGuidePanel")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
                      <GuideRail
                        projectId={projectId}
                        threadId={threadId}
                        showHeading={false}
                        onCollapseToggle={handleToggleGettingStarted}
                        onAutoCollapse={() => {
                          setIsGettingStartedCollapsed(true);
                          // When workshop starts, open Workshop and Notebook
                          setIsWorkshopCollapsed(false);
                          setIsNotebookCollapsed(false);
                          setIsReflectionCollapsed(true);
                        }}
                        isCollapsed={isGettingStartedCollapsed}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="collapsed-guide"
                    variants={panelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="h-full"
                  >
                    <CollapsedPanelTab
                      label={t("gettingStarted")}
                      onClick={() => {
                        setIsGettingStartedCollapsed(false);
                        setIsManuallyExpanded(true); // Mark as manually expanded to show in full width
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* CENTER + RIGHT: Workshop, Notebook, and Reflection with resizable splitter */}
            {isStartupFocusMode ? (
              // When in startup focus mode, show collapsed tabs side by side
              <>
                <div
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "rounded-none transition-all duration-500 ease-in-out bg-white/70"
                  )}
                >
                  <CollapsedPanelTab
                    label={t("workshop")}
                    onClick={
                      isWorkshopUnlocked ? handleToggleWorkshop : undefined
                    }
                  />
                </div>
                <div
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "rounded-none transition-all duration-500 ease-in-out bg-white/70"
                  )}
                >
                  <CollapsedPanelTab
                    label={t("notebook")}
                    onClick={
                      isWorkshopUnlocked ? handleToggleNotebook : undefined
                    }
                  />
                </div>
                <div
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "rounded-r-2xl rounded-l-none transition-all duration-500 ease-in-out bg-white/70"
                  )}
                >
                  <CollapsedPanelTab
                    label={t("reflection")}
                    onClick={
                      isWorkshopUnlocked ? handleToggleReflection : undefined
                    }
                  />
                </div>
              </>
            ) : (
              // When not in startup focus mode, render sections in order maintaining their positions
              <>
                {/* Workshop section */}
                <motion.div
                  layout
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "transition-colors duration-500 bg-white/70 hover:bg-white/90",
                    isNotebookCollapsed &&
                      isReflectionCollapsed &&
                      "rounded-r-2xl",
                    !isWorkshopCollapsed && "rounded-none"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {isWorkshopCollapsed ? (
                      <motion.div
                        key="collapsed-workshop"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="h-full"
                      >
                        <CollapsedPanelTab
                          label={t("workshop")}
                          onClick={
                            isWorkshopUnlocked
                              ? handleToggleWorkshop
                              : undefined
                          }
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="full-workshop"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex h-full flex-col"
                      >
                        <div className="px-4 py-3 border-b border-slate-200 relative">
                          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                            {t("workshop")}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {t("workshopDescription")}
                          </p>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-3">
                          <WorkshopRail showHeaderTitle={false} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Notebook section */}
                <motion.div
                  layout
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "transition-colors duration-500 bg-white/70 hover:bg-white/90",
                    isReflectionCollapsed && "rounded-r-2xl",
                    !isNotebookCollapsed && "rounded-none"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {isNotebookCollapsed ? (
                      <motion.div
                        key="collapsed-notebook"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="h-full"
                      >
                        <CollapsedPanelTab
                          label={t("notebook")}
                          onClick={
                            isWorkshopUnlocked
                              ? handleToggleNotebook
                              : undefined
                          }
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="full-notebook"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex h-full flex-col"
                      >
                        <div className="px-4 py-3 border-b border-slate-200 relative">
                          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                            {t("notebook")}
                          </h2>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <NotebookViewContainer projectId={projectId} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Reflection section */}
                <motion.div
                  layout
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                    "transition-colors duration-500 bg-white/70 hover:bg-white/90 rounded-r-2xl"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {isReflectionCollapsed ? (
                      <motion.div
                        key="collapsed-reflection"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="h-full"
                      >
                        <CollapsedPanelTab
                          label={t("reflection")}
                          onClick={
                            isWorkshopUnlocked
                              ? handleToggleReflection
                              : undefined
                          }
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="full-reflection"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex h-full flex-col"
                      >
                        <div className="px-4 py-3 border-b border-slate-200 relative">
                          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                            {t("reflection")}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {t("reflectionDescription")}
                          </p>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-3">
                          <ReflectionRail showHeaderTitle={false} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragData ? (
          <div className="min-w-[200px] rounded-lg border-2 border-blue-500 bg-white px-4 py-3 opacity-90 shadow-2xl">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {activeDragData.dragType === "sourceWord"
                ? t("originalWord")
                : t("translationToken")}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {(activeDragData.partOfSpeech || "word").toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">{activeDragData.text}</span>
            </div>
            {activeDragData.originalWord && (
              <div className="mt-1 text-xs text-gray-500">
                {t("from")} &ldquo;{activeDragData.originalWord}&rdquo;
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
