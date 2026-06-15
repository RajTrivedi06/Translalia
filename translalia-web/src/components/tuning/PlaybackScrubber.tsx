"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineNode } from "./mockData";
import { focusRing } from "./uiClasses";

interface PlaybackScrubberProps {
  nodes: PipelineNode[];
  /** Mock progress along the pipeline, 0–100. */
  progressPercent?: number;
  totalSeconds: number;
}

// Even positions for the 5 pipeline ticks, using only standard inset fractions
// (each dot is centered on its point via -translate-x-1/2).
const tickLeft = ["left-0", "left-1/4", "left-1/2", "left-3/4", "left-full"];

/**
 * Bottom playback bar. Intentionally the quietest control on the page: a thin
 * line, a small outlined play/pause, and muted monospace timing.
 */
export function PlaybackScrubber({
  nodes,
  progressPercent = 80,
  totalSeconds,
}: PlaybackScrubberProps) {
  const [playing, setPlaying] = React.useState(true);

  const elapsed = ((progressPercent / 100) * totalSeconds).toFixed(1);
  const total = totalSeconds.toFixed(1);

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-4 border-t border-border-subtle bg-surface/80 px-6 py-3 backdrop-blur">
      {/* Play / pause — understated outlined circle, not a loud button */}
      <button
        type="button"
        onClick={() => setPlaying((v) => !v)}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle text-foreground-muted transition-colors duration-fast hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {playing ? <Pause size={12} /> : <Play size={12} />}
      </button>

      {/* Scrubber line */}
      <div className="relative h-0.5 min-w-0 flex-1 rounded-full bg-border-subtle">
        {/* Filled portion (driven by progress) with the handle at its end. The
            width transition lets the handle glide as progress advances during
            replay instead of jumping between tick positions. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-smooth ease-smooth motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        >
          <span
            className={cn(
              "absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-surface bg-accent shadow-card",
              // Gentle opacity breathing while paused so the handle reads as held.
              !playing &&
                "motion-safe:animate-[tuning-breathe_2s_ease-in-out_infinite]",
            )}
          />
        </div>

        {/* Node ticks */}
        {nodes.map((node, i) => (
          <button
            key={node.id}
            type="button"
            aria-label={node.name}
            className={cn(
              "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none",
              tickLeft[i] ?? "left-1/2",
            )}
          >
            <span
              className={cn(
                "block h-1.5 w-1.5 rounded-full transition-transform duration-fast group-hover:scale-150 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-1",
                node.status === "done" && "bg-accent",
                node.status === "running" &&
                  "animate-pulse bg-accent ring-2 ring-accent/30",
                node.status === "pending" && "bg-border-subtle",
              )}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-surface opacity-0 shadow-card transition-[opacity,transform] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
              {node.name}
            </span>
          </button>
        ))}
      </div>

      {/* Time + replay */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="font-mono text-xs text-foreground-muted">
          <span className="text-foreground">{elapsed}s</span> / {total}s
        </span>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm text-xs text-foreground-muted transition-colors duration-fast hover:text-accent",
            focusRing,
          )}
        >
          <RotateCcw size={12} />
          Replay
        </button>
      </div>
    </div>
  );
}
