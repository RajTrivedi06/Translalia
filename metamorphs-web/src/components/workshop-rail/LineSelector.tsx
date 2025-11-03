"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkshopStore } from "@/store/workshopSlice";

export function LineSelector({ poemLines }: { poemLines: string[] }) {
  const selectLine = useWorkshopStore((s) => s.selectLine);
  const completedLines = useWorkshopStore((s) => s.completedLines);

  return (
    <div className="p-3 space-y-2">
      {poemLines.map((line, idx) => {
        const completed = completedLines[idx] !== undefined;
        const isBlankLine = line.trim() === "";

        return (
          <button
            key={idx}
            type="button"
            onClick={() => selectLine(idx)}
            className="w-full text-left"
          >
            <Card
              className={`p-3 transition-colors ${
                isBlankLine
                  ? "bg-gray-50 hover:bg-gray-100 opacity-60"
                  : "hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-neutral-500">Line {idx + 1}</div>
                  {isBlankLine ? (
                    <div className="text-xs text-gray-400 italic opacity-50 pl-2">
                      [blank line]
                    </div>
                  ) : (
                    <div className="truncate text-sm">{line}</div>
                  )}
                </div>
                <Badge variant={completed ? "default" : "secondary"}>
                  {completed ? "Complete" : "Untranslated"}
                </Badge>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
