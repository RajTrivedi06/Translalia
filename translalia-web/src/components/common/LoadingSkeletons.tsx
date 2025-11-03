"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton components for better perceived performance
 *
 * Shows placeholder content while data is loading:
 * - Reduces perceived wait time
 * - Prevents layout shift
 * - Improves UX
 */

/**
 * Generic skeleton component
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}

/**
 * Word grid loading skeleton
 */
export function WordGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-6 justify-center items-start p-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col items-center min-w-[140px] space-y-3"
        >
          {/* Word header */}
          <div className="space-y-2 w-full">
            <Skeleton className="h-6 w-24 mx-auto" />
            <Skeleton className="h-4 w-16 mx-auto" />
          </div>

          {/* Divider */}
          <Skeleton className="h-px w-full" />

          {/* Options */}
          <div className="space-y-2 w-full">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Line selector loading skeleton
 */
export function LineSelectorSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-3 border rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Notebook cells loading skeleton
 */
export function NotebookSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Progress indicator skeleton
 */
export function ProgressSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center gap-2">
        {Array.from({ length: 10 }).map((_, idx) => (
          <Skeleton key={idx} className="h-6 w-6 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Journey summary skeleton
 */
export function JourneySummarySkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Summary */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>

      {/* Strengths */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Comparison view skeleton
 */
export function ComparisonSkeleton({ lineCount = 10 }: { lineCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Source column */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: lineCount }).map((_, idx) => (
          <div key={`left-${idx}`} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>

      {/* Translation column */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: lineCount }).map((_, idx) => (
          <div key={`right-${idx}`} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
