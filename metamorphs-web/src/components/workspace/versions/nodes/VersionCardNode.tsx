"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { useWorkspace } from "@/store/workspace";
import { Pin } from "lucide-react";

export const VersionCardNode = React.memo(function VersionCardNode({
  data,
}: NodeProps<{ id: string; highlight?: boolean }>) {
  const v = useWorkspace((s) => s.versions.find((x) => x.id === data.id));
  const pinJourney = useWorkspace((s) => s.pinJourney);
  if (!v) return null;

  return (
    <div
      className={`w-[260px] rounded-xl border bg-white shadow-sm ${
        data.highlight ? "ring-2 ring-amber-400 animate-pulse" : ""
      }`}
    >
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <div className="font-semibold">{v.title}</div>
        <button
          className="text-neutral-600 hover:text-neutral-900"
          aria-label="Pin to Journey"
          onClick={() =>
            pinJourney({
              id: `J-${Date.now()}`,
              summary: `Pinned ${v.id}`,
              toId: v.id,
            })
          }
        >
          <Pin className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 text-sm text-neutral-700">
        <div className="line-clamp-4 whitespace-pre-wrap">
          {v.lines.join("\n")}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
