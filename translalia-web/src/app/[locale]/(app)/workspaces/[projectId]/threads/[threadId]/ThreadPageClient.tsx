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
import NotebookPhase6 from "@/components/notebook/NotebookPhase6";
import { setActiveThreadId } from "@/lib/threadStorage";
import { type DragData } from "@/types/drag";
import { Badge } from "@/components/ui/badge";
import { useNotebookStore } from "@/store/notebookSlice";
import { createCellFromDragData } from "@/lib/notebook/cellHelpers";

interface ThreadPageClientProps {
  projectId: string;
  threadId: string;
}

export default function ThreadPageClient({
  projectId,
  threadId,
}: ThreadPageClientProps) {
  const t = useTranslations("Thread");
  useEffect(() => {
    setActiveThreadId(threadId ?? null);
  }, [threadId]);

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
  const [isGettingStartedCollapsed, setIsGettingStartedCollapsed] =
    useState(false);

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
            className="relative grid h-full min-h-0 gap-3 md:gap-4 lg:gap-6"
            style={{
              // Expanded: 3 columns. Collapsed: skinny rail + 50 / 50 center/right.
              gridTemplateColumns: isGettingStartedCollapsed
                ? "72px minmax(0,1fr) minmax(0,1fr)"
                : "minmax(220px,0.8fr) minmax(0,1.4fr) minmax(220px,0.8fr)",
            }}
          >
            {/* LEFT: Let’s get started / collapsed rail */}
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
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
                      aria-label="Collapse guide panel"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
                    <GuideRail
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
                    aria-label="Expand guide panel"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="h-full w-px rounded-full bg-slate-100" />
                </div>
              )}
            </div>

            {/* CENTER: Workshop – full-height, scrolls inside */}
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
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
            </div>

            {/* RIGHT: Notebook – full-height, scrolls inside */}
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="px-4 py-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  {t("notebook")}
                </h2>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-3">
                <NotebookPhase6 projectId={projectId} showTitle={false} />
              </div>
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
