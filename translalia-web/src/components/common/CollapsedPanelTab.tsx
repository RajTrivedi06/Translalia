import { cn } from "@/lib/utils";

export function CollapsedPanelTab({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center",
        "bg-slate-50/60 text-slate-500",
        className
      )}
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
