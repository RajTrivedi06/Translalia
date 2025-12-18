"use client";

import React, { useState } from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import {
  NotebookViewSelector,
  type NotebookView,
} from "./NotebookViewSelector";
import { cn } from "@/lib/utils";

// Import existing components
import NotebookPhase6 from "./NotebookPhase6";
import { TranslationStudioView } from "./TranslationStudioView";
import { PoemSuggestionsView } from "./PoemSuggestionsView";
import { JourneyReflectionView } from "./JourneyReflectionView";

interface NotebookViewContainerProps {
  projectId?: string;
}

export function NotebookViewContainer({
  projectId,
}: NotebookViewContainerProps) {
  const [currentView, setCurrentView] = useState<NotebookView>("notebook");

  // Get completed lines count for conditional rendering
  const completedLines = useWorkshopStore((state) => state.completedLines);
  const completedLinesCount = Object.keys(completedLines).length;

  // Handle view change
  const handleViewChange = (view: NotebookView) => {
    setCurrentView(view);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Dropdown selector at top */}
      <div className="flex-shrink-0">
        <NotebookViewSelector
          currentView={currentView}
          onViewChange={handleViewChange}
          completedLinesCount={completedLinesCount}
        />
      </div>

      {/* View content with smooth transitions */}
      <div className="flex-1 relative overflow-hidden">
        {/* Notebook View */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            currentView === "notebook"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          )}
        >
          <NotebookPhase6 projectId={projectId} showTitle={false} />
        </div>

        {/* Translation Studio View */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            currentView === "studio"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          )}
        >
          <TranslationStudioView />
        </div>

        {/* Poem Suggestions View */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            currentView === "suggestions"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          )}
        >
          <PoemSuggestionsView />
        </div>

        {/* Journey Reflection View */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            currentView === "reflection"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          )}
        >
          <JourneyReflectionView projectId={projectId || ""} />
        </div>
      </div>
    </div>
  );
}
