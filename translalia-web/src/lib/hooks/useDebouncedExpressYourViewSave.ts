"use client";

import * as React from "react";
import {
  useExpressYourView,
  useSaveExpressYourView,
} from "@/lib/hooks/useExpressYourView";

export type ExpressYourViewSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error";

const DEBOUNCE_MS = 2000;
const SAVED_INDICATOR_MS = 1500;

/**
 * Self-contained autosave for the "Express Your View" reflection.
 *
 * Owns local component state (the textarea value) and debounces persistence to
 * chat_threads.state.express_your_view so the reflection saves on its own,
 * independent of the Finish button. Intentionally does NOT touch notebookSlice
 * or notebook_notes, and does NOT reuse useDebouncedNotesSave.
 */
export function useDebouncedExpressYourViewSave(threadId: string | null) {
  const { data, isLoading } = useExpressYourView();
  const saveReflection = useSaveExpressYourView();

  const [value, setValue] = React.useState("");
  const [saveStatus, setSaveStatus] =
    React.useState<ExpressYourViewSaveStatus>("idle");
  const [hasHydrated, setHasHydrated] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reset local state whenever the thread changes to prevent data leakage.
  React.useEffect(() => {
    setHasHydrated(false);
    setValue("");
    setSaveStatus("idle");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [threadId]);

  // Hydrate local state from the server value exactly once per thread.
  React.useEffect(() => {
    if (!hasHydrated && data) {
      setValue(data.expressYourView ?? "");
      setHasHydrated(true);
    }
  }, [data, hasHydrated]);

  // Clear any pending timer on unmount.
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const onChange = React.useCallback(
    (next: string) => {
      setValue(next);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveReflection.mutateAsync(next.length > 0 ? next : null);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), SAVED_INDICATOR_MS);
        } catch (error) {
          console.error("[useDebouncedExpressYourViewSave] Save error:", error);
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      }, DEBOUNCE_MS);
    },
    [saveReflection]
  );

  return {
    value,
    onChange,
    saveStatus,
    isLoading: isLoading && !hasHydrated,
  };
}
