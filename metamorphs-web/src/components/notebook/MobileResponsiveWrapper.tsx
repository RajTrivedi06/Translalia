"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile responsive wrapper for comparison and assembly views
 *
 * Features:
 * - Stacks columns vertically on mobile
 * - Maintains side-by-side on desktop
 * - Responsive breakpoints
 * - Touch-friendly spacing
 */

export interface ResponsiveColumnsProps {
  /** Left column content */
  leftColumn: React.ReactNode;
  /** Right column content */
  rightColumn: React.ReactNode;
  /** Optional: Breakpoint (default: 'md' = 768px) */
  breakpoint?: "sm" | "md" | "lg";
  /** Optional: Gap between columns */
  gap?: "sm" | "md" | "lg";
  /** Optional: Additional className */
  className?: string;
}

/**
 * ResponsiveColumns - Mobile-friendly two-column layout
 *
 * Desktop: Side-by-side columns
 * Mobile: Stacked columns
 */
export function ResponsiveColumns({
  leftColumn,
  rightColumn,
  breakpoint = "md",
  gap = "md",
  className,
}: ResponsiveColumnsProps) {
  const breakpointClass = {
    sm: "sm:grid-cols-2",
    md: "md:grid-cols-2",
    lg: "lg:grid-cols-2",
  }[breakpoint];

  const gapClass = {
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  }[gap];

  return (
    <div
      className={cn("grid grid-cols-1", breakpointClass, gapClass, className)}
    >
      <div className="flex-1">{leftColumn}</div>
      <div className="flex-1">{rightColumn}</div>
    </div>
  );
}

/**
 * Mobile detection hook
 */
export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Touch-friendly button wrapper for mobile
 */
export function TouchFriendlyButton({
  children,
  onClick,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isMobile = useIsMobile();

  return (
    <button
      onClick={onClick}
      className={cn(
        "transition-all",
        isMobile && "min-h-[44px] min-w-[44px]", // WCAG touch target size
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
