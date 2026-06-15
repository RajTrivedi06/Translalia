"use client";

import * as React from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineNode } from "./mockData";
import { NodeDetail } from "./NodeDetail";

interface PipelineTimelineProps {
  nodes: PipelineNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

/**
 * Horizontal pipeline timeline.
 *
 * Nodes are laid out in an even 5-column grid. The connecting line is drawn as
 * two half-segments per node (left + right of the dot); coloring the segments
 * up to the last completed node produces a continuous accent fill that stops
 * exactly at that node's center — no inline styles or arbitrary widths needed.
 */
export function PipelineTimeline({
  nodes,
  selectedNodeId,
  onSelectNode,
}: PipelineTimelineProps) {
  // Index of the last completed node — the accent fill stops here.
  const lastDoneIndex = nodes.reduce(
    (acc, node, idx) => (node.status === "done" ? idx : acc),
    -1,
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  // Progressive line reveal: filled connector segments start collapsed
  // (scale-x-0) and draw in left→right on mount, staggered by node index so
  // the accent line appears to travel down the pipeline rather than snap on.
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const drawDelay = [
    "delay-0",
    "delay-75",
    "delay-150",
    "delay-200",
    "delay-300",
  ];

  return (
    <section className="py-8">
      {/* Nodes stack vertically below md, spread evenly across the row above it. */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5 md:gap-0">
        {nodes.map((node, idx) => {
          const isSelected = node.id === selectedNodeId;
          const isFirst = idx === 0;
          const isLast = idx === nodes.length - 1;
          // Line arriving at this dot is filled once we've reached it.
          const leftFilled = idx <= lastDoneIndex;
          // Line leaving this dot is filled only if a later node was reached.
          const rightFilled = idx < lastDoneIndex;
          // The frontmost filled segment gets a directional gradient (accent →
          // accent/50) so the line reads as moving toward the running node.
          const isLeadingEdge = idx === lastDoneIndex;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              aria-pressed={isSelected}
              className="group flex flex-col items-center focus-visible:outline-none"
            >
              {/* Dot row (full column width so segments meet seamlessly).
                  Connectors are horizontal, so they only show on the md+ row. */}
              <div className="relative flex h-6 w-full items-center justify-center">
                {!isFirst && (
                  <span
                    className={cn(
                      "absolute left-0 right-1/2 top-1/2 hidden h-0.5 -translate-y-1/2 md:block",
                      isLeadingEdge
                        ? "bg-gradient-to-r from-accent to-accent/50"
                        : leftFilled
                          ? "bg-accent"
                          : "bg-border-subtle",
                      // Filled portions draw in left→right on mount.
                      (leftFilled || isLeadingEdge) &&
                        cn(
                          "origin-left transition-transform duration-500 ease-smooth motion-reduce:transition-none",
                          drawDelay[idx],
                          drawn ? "scale-x-100" : "scale-x-0",
                        ),
                      // Unfilled segment feeding a running node hosts the flow dot.
                      node.status === "running" &&
                        "[container-type:inline-size]",
                    )}
                  >
                    {node.status === "running" && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[tuning-flow_1.8s_linear_infinite] motion-reduce:hidden"
                      />
                    )}
                  </span>
                )}
                {!isLast && (
                  <span
                    className={cn(
                      "absolute left-1/2 right-0 top-1/2 hidden h-0.5 -translate-y-1/2 md:block",
                      rightFilled ? "bg-accent" : "bg-border-subtle",
                      rightFilled &&
                        cn(
                          "origin-left transition-transform duration-500 ease-smooth motion-reduce:transition-none",
                          drawDelay[idx],
                          drawn ? "scale-x-100" : "scale-x-0",
                        ),
                    )}
                  />
                )}

                <span
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition duration-fast",
                    node.status === "done" && "border-accent bg-accent",
                    node.status === "running" && "border-accent bg-surface",
                    node.status === "pending" &&
                      "border-border-subtle bg-surface",
                    // Hover affordance on every node.
                    "group-hover:ring-2 group-hover:ring-accent/30",
                    isSelected && "ring-2 ring-accent ring-offset-2",
                    "group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2",
                  )}
                >
                  {/* Breathing halo while running — opacity only (no scale). */}
                  {node.status === "running" && (
                    <span
                      aria-hidden
                      className="absolute -inset-1 rounded-full ring-2 ring-accent/50 motion-safe:animate-[tuning-breathe_2s_ease-in-out_infinite]"
                    />
                  )}
                  {node.status === "done" && (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className="text-white motion-safe:animate-[tuning-pop-in_250ms_ease-out_both]"
                    />
                  )}
                  {node.status === "running" && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>
              </div>

              {/* Labels */}
              <div className="mt-4 flex flex-col items-center px-2 text-center">
                <span className="flex items-center gap-1">
                  <span className="text-sm font-medium text-foreground transition-colors duration-fast group-hover:text-accent">
                    {node.name}
                  </span>
                  {node.editable && (
                    <Pencil
                      size={12}
                      className="text-foreground-muted transition-colors duration-fast group-hover:text-accent"
                    />
                  )}
                </span>
                <span className="mt-1 text-xs text-foreground-muted">
                  {node.metricLine}
                </span>
                {node.previewLine && (
                  <span className="mt-0.5 text-xs italic text-foreground-muted">
                    {node.previewLine}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline detail panel for the selected node. */}
      <NodeDetail
        node={selectedNode}
        onClose={() => {
          if (selectedNodeId) onSelectNode(selectedNodeId);
        }}
      />
    </section>
  );
}
