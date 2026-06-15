"use client";

import * as React from "react";
import { useNotebookStore } from "@/store/notebookSlice";
import { useSaveNotebookNotes } from "@/lib/hooks/useNotebookNotes";

export type NotesSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced bulk save for the thread note (General Reflection) in NotesSheet.
 */
export function useDebouncedNotesSave() {
  const threadNote = useNotebookStore((s) => s.threadNote);
  const saveNotes = useSaveNotebookNotes();

  const [saveStatus, setSaveStatus] = React.useState<NotesSaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!hasUnsavedChanges) return;

      setSaveStatus("saving");
      try {
        await saveNotes.mutateAsync({ threadNote });
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("[useDebouncedNotesSave] Save error:", error);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 2500);
  }, [hasUnsavedChanges, threadNote, saveNotes]);

  React.useEffect(() => {
    if (hasUnsavedChanges) {
      debouncedSave();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [threadNote, debouncedSave, hasUnsavedChanges]);

  const markUnsaved = React.useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  return {
    saveStatus,
    markUnsaved,
  };
}
