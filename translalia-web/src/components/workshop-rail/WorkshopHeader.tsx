"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { Badge } from "@/components/ui/badge";

interface WorkshopHeaderProps {
  showTitle?: boolean;
}

export function WorkshopHeader({ showTitle = true }: WorkshopHeaderProps) {
  const total = useWorkshopStore((s) => s.poemLines.length);
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const currentVariant =
    selectedLineIndex !== null ? selectedVariant[selectedLineIndex] : null;

  return (
    <div className="flex items-center justify-between border-b px-3 py-2 bg-white">
      <div className="flex items-center gap-2">
        {showTitle && <h2 className="text-sm font-semibold">Workshop</h2>}
        {selectedLineIndex !== null ? (
          <span className="text-xs text-neutral-500">
            Line {selectedLineIndex + 1} of {total}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {currentVariant
            ? `Variant ${currentVariant} selected`
            : "Select a variant"}
        </Badge>
      </div>
    </div>
  );
}
