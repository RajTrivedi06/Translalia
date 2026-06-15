import { cn } from "@/lib/utils";
import { KeyboardEvent } from "react";

export function CollapsedPanelTab({
  label,
  className,
  onClick,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cn(
        "flex h-full w-full items-center justify-center",
        "bg-muted/60 text-foreground-muted transition-colors duration-fast",
        onClick && "cursor-pointer hover:bg-muted/80 hover:text-foreground-secondary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
        className
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "select-none text-sm font-semibold tracking-wider uppercase",
          "[writing-mode:vertical-rl] rotate-180"
        )}
      >
        {label}
      </div>
    </div>
  );
}
