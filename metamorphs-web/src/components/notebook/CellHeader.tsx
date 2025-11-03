"use client";

import * as React from "react";
import { NotebookCell } from "@/types/notebook";
import { Badge } from "@/components/ui/badge";

export function CellHeader({
  cell,
  index,
}: {
  cell: NotebookCell;
  index: number;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-white rounded-t-lg">
      <div className="flex items-center gap-3">
        <Badge variant="secondary">Line {cell.lineIndex + 1}</Badge>
        {cell.source.dialect ? (
          <Badge variant="outline">{cell.source.dialect}</Badge>
        ) : null}
      </div>
      <Badge
        variant={
          cell.translation.status === "locked"
            ? "default"
            : cell.translation.status === "reviewed"
            ? "default"
            : cell.translation.status === "draft"
            ? "secondary"
            : "outline"
        }
      >
        {cell.translation.status}
      </Badge>
    </div>
  );
}
