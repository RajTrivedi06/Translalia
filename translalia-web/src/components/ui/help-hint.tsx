"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface HelpHintProps {
  /** Accessible label describing what the icon explains (e.g. "How words work"). */
  label: string;
  /** Optional short heading shown at the top of the popover. */
  title?: string;
  /** Instruction lines, rendered as a simple bulleted list. */
  items?: React.ReactNode[];
  /** Arbitrary popover content, rendered after `items`. */
  children?: React.ReactNode;
  /** Optional short visible text beside the icon for extra discoverability. */
  triggerText?: string;
  /** Horizontal alignment of the popover relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger button. */
  className?: string;
  /** Extra classes for the icon. */
  iconClassName?: string;
  /** Extra classes for the popover content. */
  contentClassName?: string;
}

/**
 * A small, on-demand help affordance: an info icon that opens a short popover
 * of contextual instructions. Use this instead of permanently-visible
 * instruction text so the interface stays uncluttered once a feature is learned.
 *
 * Fully keyboard- and touch-accessible (real button + the shared Popover handles
 * focus trap, Escape, and click-outside).
 */
export function HelpHint({
  label,
  title,
  items,
  children,
  triggerText,
  align = "start",
  className,
  iconClassName,
  contentClassName,
}: HelpHintProps) {
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md text-foreground-muted",
            "transition-colors hover:text-foreground-secondary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            triggerText ? "px-1.5 py-0.5 text-xs font-medium" : "p-0.5",
            className
          )}
        >
          <Info
            className={cn("h-3.5 w-3.5", iconClassName)}
            aria-hidden="true"
          />
          {triggerText ? <span>{triggerText}</span> : null}
        </button>
      </PopoverAnchor>
      <PopoverContent
        align={align}
        ariaLabelledby={title ? titleId : undefined}
        className={cn("text-sm", contentClassName)}
      >
        {title ? (
          <p
            id={titleId}
            className="mb-2 text-sm font-semibold text-foreground"
          >
            {title}
          </p>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="space-y-1.5 text-foreground-secondary">
            {items.map((item, i) => (
              <li key={i} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default HelpHint;
