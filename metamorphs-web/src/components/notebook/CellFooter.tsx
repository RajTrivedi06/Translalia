"use client";

import * as React from "react";
import { NotebookCell } from "@/types/notebook";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CellFooter({
  cell,
  index,
}: {
  cell: NotebookCell;
  index: number;
}) {
  const notesCount = (cell.notes || []).length;
  const locksCount = (cell.translation.lockedWords || []).length;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t bg-white rounded-b-lg">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary">📝 {notesCount} notes</Badge>
        <Badge variant="secondary">🔒 {locksCount} locks</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline">
          Lock
        </Button>
        <Button size="sm" variant="outline">
          Prismatic
        </Button>
        <Button size="sm" variant="outline">
          Bias Check
        </Button>
        <Button size="sm" variant="outline">
          Add Note
        </Button>
      </div>
    </div>
  );
}
