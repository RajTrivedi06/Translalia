"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { useWorkspace } from "@/store/workspace";

export const CompareCardNode = React.memo(function CompareCardNode({
  data,
}: NodeProps<{ leftId: string; rightId: string }>) {
  const left = useWorkspace((s) =>
    s.versions.find((x) => x.id === data.leftId)
  );
  const right = useWorkspace((s) =>
    s.versions.find((x) => x.id === data.rightId)
  );
  const setActiveCompare = useWorkspace((s) => s.setActiveCompare);
  const setCompareOpen = useWorkspace((s) => s.setCompareOpen);

  if (!left || !right) return null;

  return (
    <>
      <div className="w-[320px] rounded-xl border bg-white shadow-sm">
        <div className="border-b px-3 py-2 font-semibold">
          Comparing {left.id} & {right.id}
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="h-20 rounded-lg bg-neutral-100 p-2 text-xs text-neutral-600 line-clamp-5 whitespace-pre-wrap">
            {left.lines.slice(0, 3).join("\n")}
          </div>
          <div className="h-20 rounded-lg bg-neutral-100 p-2 text-xs text-neutral-600 line-clamp-5 whitespace-pre-wrap">
            {right.lines.slice(0, 3).join("\n")}
          </div>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              setActiveCompare({ leftId: left.id, rightId: right.id });
              setCompareOpen(true);
            }}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white"
          >
            Open Compare
          </button>
        </div>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );
});
