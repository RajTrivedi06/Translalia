"use client";

import React from "react";
import NotebookPhase6 from "./NotebookPhase6";

interface NotebookViewContainerProps {
  projectId?: string;
}

export function NotebookViewContainer({
  projectId,
}: NotebookViewContainerProps) {
  return (
    <div className="h-full bg-background">
      <NotebookPhase6 projectId={projectId} showTitle={false} />
    </div>
  );
}
