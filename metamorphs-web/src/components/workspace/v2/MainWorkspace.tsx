"use client";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";
import { LineSelectionView } from "./views/LineSelectionView";
import { WorkshopView } from "./views/WorkshopView";
import { NotebookView } from "./views/NotebookView";

export function MainWorkspace() {
  const currentView = useWorkspace((s) => s.ui.currentView);
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT === "1") {
      // eslint-disable-next-line no-console
      console.debug("[V2] currentView:", currentView);
    }
  }, [currentView]);
  return (
    <div className="h-full">
      {currentView === "line-selection" ? (
        <LineSelectionView />
      ) : currentView === "workshop" ? (
        <WorkshopView />
      ) : (
        <NotebookView />
      )}
    </div>
  );
}

export default MainWorkspace;
