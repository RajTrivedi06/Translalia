"use client";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";
import { ChatView } from "./chat/ChatView";
import { isChatUIOnlyEnabled } from "@/lib/featureFlags";
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

  // Hard gate to show chat UI-only without touching backend:
  if (isChatUIOnlyEnabled()) {
    return <ChatView />;
  }

  // Normal view switch (chat option added)
  switch (currentView) {
    case "chat":
      return <ChatView />;
    case "line-selection":
      return <LineSelectionView />;
    case "workshop":
      return <WorkshopView />;
    case "notebook":
      return <NotebookView />;
    default:
      return <ChatView />; // safe default during UI-only phase
  }
}

export default MainWorkspace;
