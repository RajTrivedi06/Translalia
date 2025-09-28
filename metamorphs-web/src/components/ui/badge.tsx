"use client";
import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors";
  const variants =
    variant === "secondary"
      ? "border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
      : variant === "outline"
      ? "text-neutral-950 dark:text-neutral-50"
      : "border-transparent bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900";

  return (
    <span className={`${base} ${variants} ${className}`} {...props} />
  );
}