"use client";

import { useEffect, useState } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GuideRail } from "@/components/guide";
import { WorkshopRail } from "@/components/workshop-rail/WorkshopRail";
import { NotebookViewContainer } from "@/components/notebook/NotebookViewContainer";
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
import { createCellFromDragData } from "@/lib/notebook/cellHelpers";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";

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

  const addCell = useNotebookStore((s) => s.addCell);
  const reorderCells = useNotebookStore((s) => s.reorderCells);
  const droppedCells = useNotebookStore((s) => s.droppedCells);

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

  const isStartupFocusMode = !isWorkshopUnlocked && !isGettingStartedCollapsed;

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
      } else {
        // If no work exists for this thread, ensure it's expanded
        setIsGettingStartedCollapsed(false);
      }
    } else {
      // If stores are for a different thread, start expanded
      setIsGettingStartedCollapsed(false);
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
    }
  }, [workshopState.completedLines, guideState.isWorkshopUnlocked]);

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData;
    setActiveDragData(dragData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);

    const { active, over } = event;

    if (over && over.id === "notebook-dropzone") {
      const dragData = active.data.current as DragData;
      const newCell = createCellFromDragData(dragData);
      addCell(newCell);
    } else if (over && active.id !== over.id) {
      const oldIndex = droppedCells.findIndex((c) => c.id === active.id);
      const newIndex = droppedCells.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderCells(oldIndex, newIndex);
      }
    }
  };

  const threadLabel = threadId?.slice(0, 6).toUpperCase() ?? "CURRENT THREAD";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Soft neutral background that fills entire viewport */}
      <div className="flex h-[calc(100vh-var(--header-h))] w-full flex-col bg-[#f5f5f7]">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/80 px-6 py-6 backdrop-blur-sm sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mt-3 flex flex-col items-start justify-between sm:flex-row sm:items-center sm:gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-500 sm:text-3xl">
                  {t("title")}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {t("description")}
                </p>
              </div>
              <div className="mt-4 rounded-full bg-slate-100/80 px-4 py-1.5 text-xs font-semibold text-slate-600 sm:mt-0">
                {t("threadLabel")} {threadLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Main area – fills remaining viewport height */}
        <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2 pt-2 md:px-4 sm:px-6 lg:px-8">
          <div
            className={cn(
              "relative grid h-full min-h-0 gap-0",
              "transition-[grid-template-columns] duration-500 ease-in-out"
            )}
            style={{
              // Startup focus: 80% guide, 10/10 tabs. Working: 3 columns. Collapsed: skinny guide + 50/50.
              gridTemplateColumns: isStartupFocusMode
                ? "80% 10% 10%"
                : isGettingStartedCollapsed
                ? "72px minmax(0,1fr) minmax(0,1fr)"
                : "minmax(280px,22%) minmax(0,1fr) minmax(0,1fr)",
            }}
          >
            {/* LEFT: Let’s get started / collapsed rail */}
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-l-2xl rounded-r-none bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              {!isGettingStartedCollapsed ? (
                <>
                  <div className="relative px-4 py-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                        {t("gettingStarted")}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setIsGettingStartedCollapsed(!isGettingStartedCollapsed)
                      }
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
                      onCollapseToggle={() =>
                        setIsGettingStartedCollapsed((prevState) => !prevState)
                      }
                      onAutoCollapse={() => setIsGettingStartedCollapsed(true)}
                      isCollapsed={isGettingStartedCollapsed}
                    />
                  </div>
                </>
              ) : (
                // COLLAPSED skinny rail – provide re-open button
                <div className="flex h-full flex-col items-center justify-center gap-3 pb-6 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setIsGettingStartedCollapsed(!isGettingStartedCollapsed)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    aria-label={t("expandGuidePanel")}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="h-full w-px rounded-full bg-slate-100" />
                </div>
              )}
            </div>

            {/* CENTER: Workshop – full-height, scrolls inside */}
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                "rounded-none transition-all duration-500 ease-in-out",
                isStartupFocusMode && "bg-white/70"
              )}
            >
              {isStartupFocusMode ? (
                <CollapsedPanelTab label={t("workshop")} />
              ) : (
                <>
                  <div className="px-4 py-3">
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
                </>
              )}
            </div>

            {/* RIGHT: Notebook – full-height, scrolls inside */}
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/50 bg-white shadow-sm",
                "rounded-r-2xl rounded-l-none transition-all duration-500 ease-in-out",
                isStartupFocusMode && "bg-white/70"
              )}
            >
              {isStartupFocusMode ? (
                <CollapsedPanelTab label={t("notebook")} />
              ) : (
                <>
                  <div className="px-4 py-3">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                      {t("notebook")}
                    </h2>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <NotebookViewContainer projectId={projectId} />
                  </div>
                </>
              )}
            </div>
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
