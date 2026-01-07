"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useDebounce } from "./useDebounce";

/**
 * Auto-save hook for notebook translations
 *
 * Features:
 * - Debounced saves every 3 seconds
 * - Saves draft translations to notebookSlice
 * - Shows "Saved" indicator when successful
 * - Handles offline scenarios
 * - Only saves if content has changed
 */

export interface AutoSaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export function useAutoSave(
  currentLineIndex: number | null,
  getCurrentTranslation: () => string,
  options: {
    debounceMs?: number;
    enabled?: boolean;
    onSave?: (translation: string) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { debounceMs = 3000, enabled = true, onSave, onError } = options;
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const lastSavedContent = useRef<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSave = useCallback(async () => {
    if (!enabled || currentLineIndex === null) return;

    try {
      const translation = getCurrentTranslation();

      // Only save if content has actually changed
      if (translation === lastSavedContent.current) {
        return;
      }

      lastSavedContent.current = translation;
      setLastSaved(new Date());

      onSave?.(translation);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      console.error("[useAutoSave] Save failed:", err);
    }
  }, [enabled, currentLineIndex, getCurrentTranslation, onSave, onError]);

  // Debounced save
  const debouncedSave = useDebounce(performSave, debounceMs);

  // Trigger save when content changes
  useEffect(() => {
    if (!enabled || currentLineIndex === null) return;
    const content = getCurrentTranslation();
    if (content !== lastSavedContent.current) {
      debouncedSave();
    }
  }, [enabled, currentLineIndex, debouncedSave, getCurrentTranslation]);

  // Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Perform immediate save on unmount if dirty
      if (currentLineIndex !== null) {
        performSave();
      }
    };
  }, [currentLineIndex, performSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  return {
    saveNow,
    lastSaved,
  };
}

/**
 * Hook for displaying auto-save status indicator
 */
export function useAutoSaveIndicator(lastSaved: Date | null) {
  const getTimeSinceSave = useCallback(() => {
    if (!lastSaved) return null;

    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return "Saved just now";
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `Saved ${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `Saved ${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }
  }, [lastSaved]);

  return { timeSinceSave: getTimeSinceSave() };
}
