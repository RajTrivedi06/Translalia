"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NoteMarkerProps {
  lineIndex: number;
  hasNote: boolean;
  isCoarsePointer?: boolean;
  onOpen: (lineIndex: number) => void;
}

export const NoteMarker = React.forwardRef<HTMLButtonElement, NoteMarkerProps>(
  function NoteMarker(
    { lineIndex, hasNote, isCoarsePointer = false, onOpen },
    ref
  ) {
    const t = useTranslations("Notebook");
    const [isFocused, setIsFocused] = React.useState(false);

    const lineNumber = lineIndex + 1;
    const showOnCoarse = !hasNote && isCoarsePointer;

    return (
      <div
        className="absolute left-1/2 top-0 bottom-0 z-20 flex w-8 -translate-x-1/2 items-start justify-center pt-2.5 pointer-events-none"
        aria-hidden={!hasNote && !showOnCoarse && !isFocused}
      >
        <button
          ref={ref}
          type="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(lineIndex);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label={
            hasNote
              ? t("notesMarkerOpen", {
                  defaultValue: "Line {number} note: open",
                  number: lineNumber,
                })
              : t("notesMarkerAdd", {
                  defaultValue: "Add note to line {number}",
                  number: lineNumber,
                })
          }
          className={cn(
            "pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            "text-foreground-secondary touch-manipulation",
            "hover:bg-muted/80 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
            hasNote
              ? "bg-surface/95 opacity-75 shadow-sm ring-1 ring-border-subtle/60 hover:opacity-100 focus-visible:opacity-100"
              : cn(
                  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                  showOnCoarse && "opacity-40",
                  isFocused && "opacity-100",
                  "group-hover:bg-surface/95 group-hover:shadow-sm group-hover:ring-1 group-hover:ring-border-subtle/60",
                  "focus-visible:bg-surface/95 focus-visible:shadow-sm focus-visible:ring-1 focus-visible:ring-border-subtle/60"
                )
          )}
        >
          <StickyNote
            className={cn(
              "h-4 w-4",
              hasNote ? "fill-current stroke-current" : "fill-none"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }
);
