"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { Badge } from "@/components/ui/badge";

interface WorkshopHeaderProps {
  showTitle?: boolean;
  /** Hide bottom border when ProcessingProgress is shown below */
  hideBottomBorder?: boolean;
}

export function WorkshopHeader({
  showTitle = true,
  hideBottomBorder = false,
}: WorkshopHeaderProps) {
  const total = useWorkshopStore((s) => s.poemLines.length);
  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const currentVariant =
    currentLineIndex !== null ? selectedVariant[currentLineIndex] : null;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 bg-white ${
        hideBottomBorder ? "" : "border-b"
      }`}
    >
      <div className="flex items-center gap-2">
        {showTitle && <h2 className="text-sm font-semibold">Workshop</h2>}
        {currentLineIndex !== null ? (
          <span className="text-xs text-neutral-500">
            Line {currentLineIndex + 1} of {total}
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
