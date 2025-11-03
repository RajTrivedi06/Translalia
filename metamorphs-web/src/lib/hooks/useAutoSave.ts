"use client";

import { useEffect, useRef, useCallback } from "react";
import { useNotebookStore } from "@/store/notebookSlice";
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

  const saveDraftTranslation = useNotebookStore((s) => s.saveDraftTranslation);
  const setAutoSaveTimestamp = useNotebookStore((s) => s.setAutoSaveTimestamp);
  const isDirty = useNotebookStore((s) => s.isDirty);

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

      // Check if online
      if (!navigator.onLine) {
        throw new Error(
          "You're offline. Changes will be saved when you reconnect."
        );
      }

      // Save to store
      saveDraftTranslation(currentLineIndex, translation);
      setAutoSaveTimestamp();

      lastSavedContent.current = translation;

      onSave?.(translation);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      console.error("[useAutoSave] Save failed:", err);
    }
  }, [
    enabled,
    currentLineIndex,
    getCurrentTranslation,
    saveDraftTranslation,
    setAutoSaveTimestamp,
    onSave,
    onError,
  ]);

  // Debounced save
  const debouncedSave = useDebounce(performSave, debounceMs);

  // Trigger save when content changes
  useEffect(() => {
    if (enabled && isDirty && currentLineIndex !== null) {
      debouncedSave();
    }
  }, [enabled, isDirty, currentLineIndex, debouncedSave]);

  // Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Perform immediate save on unmount if dirty
      if (isDirty && currentLineIndex !== null) {
        performSave();
      }
    };
  }, [isDirty, currentLineIndex, performSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  return {
    saveNow,
    lastSaved: useNotebookStore((s) => s.autoSaveTimestamp),
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
