"use client";

import React from "react";
import { ComparisonView } from "./ComparisonView";

export function TranslationStudioView() {
  // Translation Studio is essentially ComparisonView but always open in embedded mode
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
