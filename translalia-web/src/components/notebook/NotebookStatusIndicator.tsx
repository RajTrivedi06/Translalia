"use client";

import * as React from "react";
import { CheckCircle2, Circle, Pencil } from "lucide-react";

type Status = "completed" | "draft" | "pending";

interface NotebookStatusIndicatorProps {
  status: Status;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const tooltipText = {
  completed: "Saved",
  draft: "Unsaved draft",
  pending: "Not started",
};

/**
 * Status indicator for notebook translation lines.
 * Replaces the old dot-based indicators with meaningful icons.
 */
export function NotebookStatusIndicator({
  status,
  size = "md",
  showTooltip = true,
  className = "",
}: NotebookStatusIndicatorProps) {
  const sizeClass = sizeClasses[size];

  const icon = React.useMemo(() => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle2
            className={`${sizeClass} text-success`}
            strokeWidth={2.5}
          />
        );
      case "draft":
        return (
          <Pencil
            className={`${sizeClass} text-warning`}
            strokeWidth={2}
          />
        );
      case "pending":
      default:
        return (
          <Circle
            className={`${sizeClass} text-foreground-disabled`}
            strokeWidth={1.5}
          />
        );
    }
  }, [status, sizeClass]);

  return (
    <div
      className={`
        notebook-status-indicator status-${status}
        flex-shrink-0 flex items-center justify-center
        ${className}
      `}
      title={showTooltip ? tooltipText[status] : undefined}
      aria-label={tooltipText[status]}
      role="img"
    >
      {icon}
    </div>
  );
}

export default NotebookStatusIndicator;
