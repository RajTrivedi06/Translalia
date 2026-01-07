"use client";

import React from "react";
import { ComparisonView } from "./ComparisonView";

export function TranslationStudioView() {
  // Legacy: previously a dedicated view that embedded ComparisonView.
  // The primary Notebook surface now owns the workflow; keep this only for backwards compatibility.
  return (
    <div className="h-full">
      <ComparisonView
        open={true}
        onOpenChange={() => {}} // No-op, always open in this view
        embedded={true} // New prop to indicate embedded mode
      />
    </div>
  );
}
