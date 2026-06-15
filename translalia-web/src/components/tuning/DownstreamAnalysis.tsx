"use client";

import * as React from "react";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  downstreamFeatures,
  type DownstreamFeature,
  type DownstreamStatus,
} from "./mockData";

const statusText: Record<DownstreamStatus, string> = {
  done: "Complete",
  running: "Analyzing…",
  pending: "Pending",
};

const stateTextClass: Record<DownstreamStatus, string> = {
  done: "text-success",
  running: "text-warning italic",
  pending: "text-foreground-muted",
};

function StatusIcon({ status }: { status: DownstreamStatus }) {
  if (status === "done") {
    return <Check size={16} className="text-success" />;
  }
  if (status === "running") {
    return (
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-warning" />
    );
  }
  return <Circle size={14} className="text-foreground-disabled" />;
}

function SummaryBit({
  count,
  label,
  dotClass,
  textClass,
}: {
  count: number;
  label: string;
  dotClass: string;
  textClass: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", textClass)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} />
      {count} {label}
    </span>
  );
}

export function DownstreamAnalysis() {
  const [open, setOpen] = React.useState(false);

  const counts = downstreamFeatures.reduce(
    (acc, f) => {
      acc[f.status] += 1;
      return acc;
    },
    { done: 0, running: 0, pending: 0 } as Record<DownstreamStatus, number>,
  );

  return (
    <section className="border-t border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-4 text-left transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <ChevronRight
          size={14}
          className={cn(
            "text-foreground-muted transition-transform duration-fast",
            open && "rotate-90",
          )}
        />
        <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
          Downstream Analysis
        </span>
        <span className="ml-2 flex flex-wrap items-center gap-4">
          <SummaryBit
            count={counts.done}
            label="done"
            dotClass="bg-success"
            textClass="text-success"
          />
          <SummaryBit
            count={counts.running}
            label="running"
            dotClass="bg-warning"
            textClass="text-warning"
          />
          <SummaryBit
            count={counts.pending}
            label="pending"
            dotClass="bg-foreground-muted"
            textClass="text-foreground-muted"
          />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-smooth motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="pb-2">
            {downstreamFeatures.map((feature, i) => (
              <DownstreamRow
                key={feature.id}
                feature={feature}
                open={open}
                index={i}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Per-row entrance delay — a 30ms cascade as the list expands. Literal strings
// (not computed) so Tailwind's JIT emits the utilities. On collapse the rows
// drop back to 0ms so they all fade out together (a reverse cascade feels slow).
const rowStagger = [
  "[transition-delay:0ms]",
  "[transition-delay:30ms]",
  "[transition-delay:60ms]",
  "[transition-delay:90ms]",
];

function DownstreamRow({
  feature,
  open,
  index,
}: {
  feature: DownstreamFeature;
  open: boolean;
  index: number;
}) {
  return (
    <li
      className={cn(
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        open
          ? cn("translate-y-0 opacity-100", rowStagger[index] ?? rowStagger[0])
          : "translate-y-1 opacity-0 [transition-delay:0ms]",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 border-b border-border-subtle py-3 text-left transition-colors duration-fast last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span className="flex flex-1 items-center gap-2">
          <span className="flex w-4 justify-center">
            <StatusIcon status={feature.status} />
          </span>
          <span className="text-sm text-foreground">{feature.name}</span>
        </span>

        <span className="font-mono text-sm text-foreground-muted">
          {feature.metric}
        </span>

        <span className="flex items-center gap-1.5 text-sm">
          <span
            className={cn(
              feature.status === "running" && "animate-pulse",
              stateTextClass[feature.status],
            )}
          >
            {statusText[feature.status]}
          </span>
          <ChevronRight size={14} className="text-foreground-muted" />
        </span>
      </button>
    </li>
  );
}
