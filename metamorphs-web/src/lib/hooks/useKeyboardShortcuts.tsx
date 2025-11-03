"use client";

import * as React from "react";
import { useEffect, useCallback, useRef } from "react";

/**
 * Keyboard shortcuts for Phase 6 notebook functionality
 *
 * Shortcuts:
 * - Cmd/Ctrl + Enter: Finalize current line
 * - Cmd/Ctrl + ←/→: Navigate between lines
 * - Cmd/Ctrl + S: Manual save
 * - Escape: Cancel current edit
 */

export interface KeyboardShortcutHandlers {
  onFinalizeCurrentLine?: () => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  onManualSave?: () => void;
  onCancel?: () => void;
  isEnabled?: boolean;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const {
    onFinalizeCurrentLine,
    onNavigatePrevious,
    onNavigateNext,
    onManualSave,
    onCancel,
    isEnabled = true,
  } = handlers;

  // Track if we're in an input field to avoid conflicting with typing
  const isInInputRef = useRef(false);

  // Update input tracking
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      isInInputRef.current =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
    };

    const handleBlur = () => {
      isInInputRef.current = false;
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isEnabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Enter: Finalize current line
      if (cmdOrCtrl && e.key === "Enter") {
        e.preventDefault();
        onFinalizeCurrentLine?.();
        return;
      }

      // Cmd/Ctrl + S: Manual save
      if (cmdOrCtrl && e.key === "s") {
        e.preventDefault();
        onManualSave?.();
        return;
      }

      // Cmd/Ctrl + Arrow Keys: Navigate (only when not in input)
      if (cmdOrCtrl && !isInInputRef.current) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onNavigatePrevious?.();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onNavigateNext?.();
          return;
        }
      }

      // Escape: Cancel (only when not in input that needs it)
      if (e.key === "Escape") {
        // Allow inputs to handle Escape first (e.g., to close dropdowns)
        if (!isInInputRef.current) {
          e.preventDefault();
          onCancel?.();
        }
      }
    },
    [
      isEnabled,
      onFinalizeCurrentLine,
      onManualSave,
      onNavigatePrevious,
      onNavigateNext,
      onCancel,
    ]
  );

  useEffect(() => {
    if (!isEnabled) return;

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEnabled, handleKeyDown]);

  return {
    // Utility function to check if shortcuts are available
    isShortcutsEnabled: isEnabled,
  };
}

/**
 * Hook to display keyboard shortcuts help
 */
export function useKeyboardShortcutsHelp() {
  const isMac =
    typeof navigator !== "undefined"
      ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
      : false;
  const modKey = isMac ? "⌘" : "Ctrl";

  return {
    shortcuts: [
      {
        key: `${modKey} + Enter`,
        description: "Finalize current line",
        category: "Navigation",
      },
      {
        key: `${modKey} + ← / →`,
        description: "Navigate between lines",
        category: "Navigation",
      },
      {
        key: `${modKey} + S`,
        description: "Manual save",
        category: "Editing",
      },
      {
        key: "Esc",
        description: "Cancel current edit",
        category: "Editing",
      },
    ],
    modKey,
    isMac,
  };
}

/**
 * Component to display keyboard shortcuts hint
 */
export function KeyboardShortcutsHint({
  className = "",
}: {
  className?: string;
}) {
  const { shortcuts } = useKeyboardShortcutsHelp();
  return (
    <div className={`text-xs text-gray-600 space-y-1 ${className}`}>
      <div className="font-semibold text-gray-700 mb-2">Keyboard Shortcuts</div>
      {shortcuts.map((shortcut, idx) => (
        <div key={idx} className="flex justify-between gap-4">
          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
            {shortcut.key}
          </span>
          <span>{shortcut.description}</span>
        </div>
      ))}
    </div>
  );
}
