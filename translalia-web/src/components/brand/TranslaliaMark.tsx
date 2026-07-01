import { cn } from "@/lib/utils";

interface TranslaliaMarkProps {
  className?: string;
  animated?: boolean;
}

/**
 * Selection-handle lockup mark. Sized in `em` relative to the parent lockup
 * font size so it stays proportional at every scale.
 */
export function TranslaliaMark({ className, animated = false }: TranslaliaMarkProps) {
  return (
    <svg
      viewBox="0 0 88 72"
      fill="none"
      aria-hidden="true"
      className={cn(
        "block h-[1.34em] w-auto shrink-0 overflow-visible",
        animated && "translalia-hero-mark",
        className,
      )}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M19 9H59"
          strokeWidth={6}
          strokeOpacity={0.9}
          className="stroke-[rgb(var(--color-border))]"
        />
        <path
          d="M19 63H59"
          strokeWidth={6}
          strokeOpacity={0.9}
          className="stroke-[rgb(var(--color-border))]"
        />
        {animated ? (
          <>
            <path
              d="M19 36H59"
              strokeWidth={6}
              strokeOpacity={0.9}
              className="stroke-[rgb(var(--color-border))]"
            />
            <path
              d="M19 9H59"
              strokeWidth={9.5}
              className="translalia-hero-line-highlight translalia-hero-line-highlight-top stroke-accent"
            />
            <path
              d="M20 36H68"
              strokeWidth={9.5}
              className="translalia-hero-line-highlight translalia-hero-line-highlight-middle stroke-accent"
            />
            <path
              d="M19 63H59"
              strokeWidth={9.5}
              className="translalia-hero-line-highlight translalia-hero-line-highlight-bottom stroke-accent"
            />
            <g className="translalia-hero-selector-glow">
              <path d="M8 24V48" strokeWidth={12} className="stroke-accent" />
              <path d="M80 24V48" strokeWidth={12} className="stroke-accent" />
            </g>
            <g className="translalia-hero-selector">
              <path d="M8 24V48" strokeWidth={6.5} className="stroke-accent" />
              <path d="M80 24V48" strokeWidth={6.5} className="stroke-accent" />
            </g>
          </>
        ) : (
          <g>
            <path d="M8 24V48" strokeWidth={6.5} className="stroke-accent" />
            <path d="M20 36H68" strokeWidth={9.5} className="stroke-accent" />
            <path d="M80 24V48" strokeWidth={6.5} className="stroke-accent" />
          </g>
        )}
      </g>
    </svg>
  );
}
