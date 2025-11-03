"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NotebookCell as NBCell } from "@/types/notebook";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CellHeader } from "./CellHeader";
import { CellBody } from "./CellBody";
import { PrismaticStrip } from "./PrismaticStrip";
import { CellFooter } from "./CellFooter";
import { useNotebookStore } from "@/store/notebookSlice";

export function NotebookCellView({
  cell,
  isFocused,
  index,
}: {
  cell: NBCell;
  isFocused: boolean;
  index: number;
  threadId?: string;
}) {
  const showPrismatic = useNotebookStore((s) => s.view.showPrismatic);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cell.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-6 transition-all",
        isFocused && "ring-2 ring-blue-500",
        isDragging && "opacity-50 z-50"
      )}
      {...attributes}
      {...listeners}
    >
      <CellHeader cell={cell} index={index} />
      <CellBody cell={cell} index={index} />
      {showPrismatic && cell.prismaticVariants ? (
        <PrismaticStrip variants={cell.prismaticVariants} index={index} />
      ) : null}
      <CellFooter cell={cell} index={index} />
    </Card>
  );
}
