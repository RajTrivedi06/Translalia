"use client";

import * as React from "react";
import { useThreadId } from "@/hooks/useThreadId";
import { useNotebookStore } from "@/store/notebookSlice";
import { useNotebookNotes } from "@/lib/hooks/useNotebookNotes";

/**
 * One-time API → Zustand hydration per thread.
 * Mount once from NotebookPhase6. Later refetches must not clobber local edits.
 */
export function useNotebookNotesHydration() {
  const threadId = useThreadId();
  const setNotes = useNotebookStore((s) => s.setNotes);
  const { data: notesData, isLoading } = useNotebookNotes();
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  React.useEffect(() => {
    setIsInitialLoad(true);
  }, [threadId]);

  React.useEffect(() => {
    if (notesData && isInitialLoad) {
      setNotes(notesData.threadNote, notesData.lineNotes);
      setIsInitialLoad(false);
    }
  }, [notesData, setNotes, isInitialLoad]);

  return { isLoading, isHydrated: !isInitialLoad };
}
