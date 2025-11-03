"use client";

import * as React from "react";
import { NotebookCell } from "@/types/notebook";
import { Textarea } from "@/components/ui/textarea";
import { useNotebookStore } from "@/store/notebookSlice";

export function CellBody({
  cell,
  index,
}: {
  cell: NotebookCell;
  index: number;
}) {
  const updateCell = useNotebookStore((s) => s.updateCell);
  const [text, setText] = React.useState(cell.translation.text);
  const isLocked = cell.translation.status === "locked";

  React.useEffect(
    () => setText(cell.translation.text),
    [cell.translation.text]
  );

  function onChange(value: string) {
    setText(value);
    // debounce simple without any casts
    const self = onChange as unknown as { _t?: number };
    if (self._t) window.clearTimeout(self._t);
    self._t = window.setTimeout(() => {
      updateCell(index, {
        translation: {
          ...cell.translation,
          text: value,
        } as NotebookCell["translation"],
      });
    }, 500);
  }

  return (
    <div className="space-y-3 p-4">
      <p className="font-serif text-gray-600">{cell.source.text}</p>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
        className="font-serif text-lg resize-none"
      />
    </div>
  );
}
