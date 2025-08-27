"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { useWorkspace } from "@/store/workspace";
import { Pin } from "lucide-react";

type VersionNodeData = {
  id: string;
  highlight?: boolean;
  title?: string | null;
  status?: string | null;
  overviewLines?: string[];
};

export const VersionCardNode = React.memo(function VersionCardNode({
  data,
}: NodeProps<VersionNodeData>) {
  const stored = useWorkspace((s) => s.versions.find((x) => x.id === data.id));
  const pinJourney = useWorkspace((s) => s.pinJourney);

  const title = data.title ?? stored?.title ?? "Version";
  const lines: string[] = data.overviewLines ?? stored?.lines ?? [];
  const status = (data.status ?? "generated") as string;
  const isRenderable = ["generated", "ready", "created"].includes(status);

  return (
    <div
      className={`w-[260px] rounded-xl border bg-white shadow-sm ${
        data.highlight ? "ring-2 ring-amber-400 animate-pulse" : ""
      }`}
    >
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <button
          className="text-neutral-600 hover:text-neutral-900"
          aria-label="Pin to Journey"
          onClick={() =>
            pinJourney({
              id: `J-${Date.now()}`,
              summary: `Pinned ${title}`,
              toId: data.id,
            })
          }
        >
          <Pin className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 text-sm text-neutral-700">
        {isRenderable && lines.length > 0 ? (
          <div className="line-clamp-4 whitespace-pre-wrap">
            {lines.join("\n")}
          </div>
        ) : (
          <div className="text-neutral-400">No overview yet</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
