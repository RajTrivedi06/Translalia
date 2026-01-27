import { cn } from "@/lib/utils";

export function CollapsedPanelTab({
  label,
  className,
  onClick,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center",
        "bg-muted/60 text-foreground-muted transition-colors duration-fast",
        onClick && "cursor-pointer hover:bg-muted/80 hover:text-foreground-secondary",
        className
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "select-none text-sm font-semibold tracking-wider uppercase",
          // Tailwind arbitrary property for writing-mode without global CSS.
          "[writing-mode:vertical-rl] rotate-180"
        )}
      >
        {label}
      </div>
    </div>
  );
}
