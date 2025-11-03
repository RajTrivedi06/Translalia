"use client";

import * as React from "react";

export function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <h3 className="text-lg font-medium text-gray-700 mb-2">
          No Notebook Cells Yet
        </h3>
        <p className="text-sm text-gray-500">
          Complete the Guide and Workshop to see translations here.
        </p>
      </div>
    </div>
  );
}
