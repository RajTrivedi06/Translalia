"use client";

import { useEffect, useRef, useState } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GuideRail } from "@/components/guide";
import { WorkshopRail } from "@/components/workshop-rail/WorkshopRail";
import NotebookPhase6 from "@/components/notebook/NotebookPhase6";
import { setActiveThreadId } from "@/lib/threadStorage";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  useEffect(() => {
    setActiveThreadId(threadId ?? null);
  }, [threadId]);

  const addCell = useNotebookStore((s) => s.addCell);
  const reorderCells = useNotebookStore((s) => s.reorderCells);
  const droppedCells = useNotebookStore((s) => s.droppedCells);

  const guideRailRef = useRef<ImperativePanelHandle>(null);
  const [isGuideRailCollapsed, setIsGuideRailCollapsed] = useState(false);

  const toggleGuideRail = () => {
    const panel = guideRailRef.current;
    if (panel) {
      if (isGuideRailCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
      setIsGuideRailCollapsed(!isGuideRailCollapsed);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-[calc(100vh-var(--header-h))] flex flex-col">
        <div className="h-14 border-b bg-background flex items-center px-4">
          <h1 className="font-semibold">Poetry Translation Workshop</h1>
        </div>

        <PanelGroup direction="horizontal" className="flex-1">
          <Panel
            ref={guideRailRef}
            defaultSize={20}
            minSize={15}
            maxSize={35}
            collapsible={true}
            collapsedSize={0}
            className="border-r relative"
            onCollapse={() => setIsGuideRailCollapsed(true)}
            onExpand={() => setIsGuideRailCollapsed(false)}
          >
            <GuideRail />
          </Panel>

          <div className="relative">
            <button
              onClick={toggleGuideRail}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-12 w-6 items-center justify-center rounded-r-lg border border-l-0 border-neutral-200 bg-white shadow-md transition-all hover:bg-neutral-50 hover:w-7 dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={
                isGuideRailCollapsed
                  ? "Expand Guide Rail"
                  : "Collapse Guide Rail"
              }
              title={
                isGuideRailCollapsed
                  ? "Expand Guide Rail"
                  : "Collapse Guide Rail"
              }
            >
              {isGuideRailCollapsed ? (
                <ChevronRight className="h-4 w-4 text-neutral-600" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>

          <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-blue-400 dark:bg-neutral-700" />

          <Panel defaultSize={50} minSize={30}>
            <WorkshopRail />
          </Panel>

          <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-blue-400 dark:bg-neutral-700" />

          <Panel
            defaultSize={30}
            minSize={20}
            maxSize={40}
            collapsible={true}
            className="border-l"
          >
            <NotebookPhase6 projectId={projectId} />
          </Panel>
        </PanelGroup>
      </div>

      <DragOverlay>
        {activeDragData ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg px-4 py-3 shadow-2xl opacity-90">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {(activeDragData.partOfSpeech || "word").toUpperCase()}
              </Badge>
              <span className="font-medium text-sm">{activeDragData.text}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              from: "{activeDragData.originalWord}"
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
