import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "error";

const dotTone: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

const textTone: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

interface SectionHeaderProps {
  title: string;
  /** Optional status dot rendered before the title. */
  dot?: Tone;
  /** Short status label rendered next to the title. */
  status?: string;
  statusTone?: Tone;
  /** Content pushed to the far right of the header row. */
  right?: React.ReactNode;
}

/**
 * Shared section header: colored status dot + tracked uppercase title, with an
 * optional status word and a right-aligned slot. Keeps every detail section
 * using the same quiet, document-like heading style.
 */
export function SectionHeader({
  title,
  dot,
  status,
  statusTone = "success",
  right,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {dot && (
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", dotTone[dot])}
        />
      )}
      <h4 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
        {title}
      </h4>
      {status && (
        <span className={cn("text-xs", textTone[statusTone])}>{status}</span>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
