"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { ChatPanel } from "./chat/ChatPanel";
import { GuideRail } from "@/components/guide";
import { WorkshopRail } from "@/components/workshop-rail/WorkshopRail";
import NotebookPhase6 from "@/components/notebook/NotebookPhase6";
import { useWorkspace } from "@/store/workspace";
import { useThreadId } from "@/hooks/useThreadId";
import { useQueryClient } from "@tanstack/react-query";
import { routes } from "@/lib/routers";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import type { DragData } from "@/types/drag";
import { useNotebookStore } from "@/store/notebookSlice";
import { createCellFromDragData } from "@/lib/notebook/cellHelpers";
import { cn } from "@/lib/utils";
import { setActiveThreadId } from "@/lib/threadStorage";

export function WorkspaceShell({
  projectId,
  threadId,
}: {
  projectId?: string;
  threadId?: string;
}) {
  const urlThreadId = useThreadId();
  const effectiveThreadId = urlThreadId || threadId;
  const qc = useQueryClient();
  const setProjectId = useWorkspace((s) => s.setProjectId);
  const setThread = useWorkspace((s) => s.setThreadId);

  React.useEffect(() => setProjectId(projectId), [projectId, setProjectId]);
  React.useEffect(() => {
    if (effectiveThreadId) {
      setThread(effectiveThreadId);
    }
  }, [effectiveThreadId, setThread]);

  React.useEffect(() => {
    setActiveThreadId(effectiveThreadId ?? null);
  }, [effectiveThreadId]);

  React.useEffect(() => {
    if (projectId) {
      qc.invalidateQueries({ queryKey: ["nodes", projectId] });
      qc.invalidateQueries({ queryKey: ["citations", projectId] });
    }
  }, [effectiveThreadId, qc, projectId]);

  const addCell = useNotebookStore((s) => s.addCell);
  const reorderCells = useNotebookStore((s) => s.reorderCells);
  const droppedCells = useNotebookStore((s) => s.droppedCells);

  const [activeDrag, setActiveDrag] = React.useState<DragData | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData | undefined;
    if (dragData) {
      setActiveDrag(dragData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dragData = active.data.current as DragData | undefined;

    if (!over) {
      setActiveDrag(null);
      return;
    }

    if (dragData && over.id === "notebook-dropzone") {
      const normalizedData =
        dragData.dragType === "sourceWord"
          ? { ...dragData, text: dragData.originalWord }
          : dragData;
      const newCell = createCellFromDragData(normalizedData);
      addCell(newCell);
      setActiveDrag(null);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = droppedCells.findIndex((c) => c.id === active.id);
      const newIndex = droppedCells.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderCells(oldIndex, newIndex);
      }
    }

    setActiveDrag(null);
  };

  const handleDragCancel = () => setActiveDrag(null);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen flex-col min-h-0">
        <header className="flex items-center justify-between border-b bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <Link
            href={routes.workspaceChats(projectId ?? "")}
            className="text-xs font-semibold hover:underline"
          >
            ← Back to Chats
          </Link>
          <h1 className="text-xs font-semibold">Workspace</h1>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <div className="w-16" />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <PanelGroup direction="horizontal" className="flex-1">
            <Panel
              defaultSize={18}
              minSize={12}
              maxSize={30}
              collapsible={true}
              className="border-r"
            >
              <GuideRail />
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-blue-400 dark:bg-neutral-700" />

            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <ChatPanel projectId={projectId} threadId={effectiveThreadId} />
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-blue-400 dark:bg-neutral-700" />

            <Panel defaultSize={32} minSize={20} maxSize={45}>
              <WorkshopRail />
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-blue-400 dark:bg-neutral-700" />

            <Panel
              defaultSize={32}
              minSize={20}
              maxSize={45}
              className="border-l bg-background"
            >
              <NotebookPhase6 />
            </Panel>
          </PanelGroup>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? (
          <div
            className={cn(
              "rounded-lg border-2 px-4 py-2 shadow-2xl text-sm font-semibold",
              activeDrag.dragType === "sourceWord"
                ? "bg-blue-50 border-blue-400 text-blue-900"
                : "bg-white border-gray-300 text-gray-900"
            )}
          >
            {activeDrag.text}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
