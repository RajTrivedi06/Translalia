"use client";

import * as React from "react";
import { Version } from "@/types/workspace";
import { useWorkspace } from "@/store/workspace";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function CompareSheet({
  open,
  onOpenChange,
  left,
  right,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  left: Version;
  right: Version;
}) {
  const addVersion = useWorkspace((s) => s.addVersion);
  const pinJourney = useWorkspace((s) => s.pinJourney);
  const projectId = useWorkspace((s) => s.projectId);

  const onCreateHybrid = async () => {
    if (!projectId) return;
    const mergedLines: string[] = [
      ...left.lines.slice(0, Math.ceil(left.lines.length / 2)),
      ...right.lines.slice(Math.floor(right.lines.length / 2)),
    ];
    const title = `Hybrid of ${left.id}/${right.id}`;
    const res = await fetch("/api/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        lines: mergedLines,
        tags: ["hybrid"],
        meta: { parents: [left.id, right.id], strategy: "half-half" },
        summary: `Created hybrid from ${left.id} and ${right.id}`,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "Failed to create hybrid");
      return;
    }
    addVersion({
      id: json.version.id,
      title: json.version.title,
      lines: json.version.lines,
      tags: json.version.tags ?? ["hybrid"],
    });
    pinJourney({
      id: `J-${Date.now()}`,
      summary: `Created hybrid ${json.version.id} from ${left.id}/${right.id}`,
      fromId: left.id,
      toId: json.version.id,
    });
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ariaLabelledby="compare-title">
        <SheetHeader>
          <SheetTitle id="compare-title">
            Compare {left.id} ↔ {right.id}
          </SheetTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 rounded-md"
            aria-label="Close compare"
          >
            Close
          </button>
        </SheetHeader>
        <div className="flex h-[calc(100%-48px)]">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-2 text-xs font-medium text-neutral-500">
              {left.title}
            </div>
            <pre className="whitespace-pre-wrap text-sm">
              {left.lines.join("\n")}
            </pre>
          </div>
          <div className="w-px bg-neutral-200" />
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-2 text-xs font-medium text-neutral-500">
              {right.title}
            </div>
            <pre className="whitespace-pre-wrap text-sm">
              {right.lines.join("\n")}
            </pre>
          </div>
        </div>
        <div className="border-t p-3 text-right">
          <button
            onClick={onCreateHybrid}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
          >
            Create Hybrid
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
