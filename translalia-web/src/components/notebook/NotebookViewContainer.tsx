"use client";

import React from "react";
import NotebookPhase6 from "./NotebookPhase6";

interface NotebookViewContainerProps {
  projectId?: string;
  onOpenEditing?: () => void;
}

export function NotebookViewContainer({
  projectId,
  onOpenEditing,
}: NotebookViewContainerProps) {
  return (
    <div className="h-full bg-background">
      <NotebookPhase6
        projectId={projectId}
        showTitle={false}
        onOpenEditing={onOpenEditing}
      />
    </div>
  );
}
