"use client";
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function V2Sheet({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const titleId = React.useId();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ariaLabelledby={titleId}>
        <SheetHeader>
          <SheetTitle id={titleId}>{title}</SheetTitle>
          <button
            type="button"
            className="text-sm text-neutral-600"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            Close
          </button>
        </SheetHeader>
        <div className="h-[calc(100%-48px)] overflow-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export default V2Sheet;
