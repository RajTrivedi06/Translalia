"use client";

import * as React from "react";

export function NotebookSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="h-4 w-48 bg-neutral-200 rounded mb-3" />
          <div className="h-4 w-full bg-neutral-200 rounded mb-2" />
          <div className="h-4 w-5/6 bg-neutral-200 rounded mb-3" />
          <div className="h-4 w-40 bg-neutral-200 rounded" />
        </div>
      ))}
    </div>
  );
}
