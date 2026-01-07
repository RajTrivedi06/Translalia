"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Layers,
  FileText,
  Sparkles,
  BookOpen,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NotebookView = "notebook" | "studio" | "suggestions" | "reflection";

interface ViewOption {
  value: NotebookView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const viewOptions: ViewOption[] = [
  {
    value: "notebook",
    label: "Notebook",
    icon: Layers,
    description: "Build translations word by word",
  },
  {
    value: "studio",
    label: "Notebook",
    icon: FileText,
    description: "Review and refine your full translation",
  },
  {
    value: "suggestions",
    label: "Poem Suggestions",
    icon: Sparkles,
    description: "Get AI ideas for tone and flow",
  },
  {
    value: "reflection",
    label: "Journey Reflection",
    icon: BookOpen,
    description: "Capture what you learned",
  },
];

interface NotebookViewSelectorProps {
  currentView: NotebookView;
  onViewChange: (view: NotebookView) => void;
  completedLinesCount: number;
}

export function NotebookViewSelector({
  currentView,
  onViewChange,
  completedLinesCount,
}: NotebookViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const currentOption = viewOptions.find((v) => v.value === currentView);
  const CurrentIcon = currentOption?.icon || Layers;

  // Determine which views are disabled
  const isStudioDisabled = completedLinesCount === 0;
  const isSuggestionsDisabled = completedLinesCount === 0;

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleSelect = (view: NotebookView) => {
    const isDisabled =
      (view === "studio" && isStudioDisabled) ||
      (view === "suggestions" && isSuggestionsDisabled);

    if (!isDisabled) {
      onViewChange(view);
      setIsOpen(false);
    }
  };

  const dropdownContent = isOpen && dropdownPosition && mounted && (
    <div
      ref={dropdownRef}
      className={cn(
        "rounded-xl shadow-2xl overflow-hidden",
        "bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-800",
        "backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        position: "fixed",
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 99999,
        transformOrigin: "top",
      }}
    >
      <div className="py-2 px-1 max-h-[380px] overflow-y-auto">
        {viewOptions.map((option, index) => {
          const OptionIcon = option.icon;
          const isDisabled =
            (option.value === "studio" && isStudioDisabled) ||
            (option.value === "suggestions" && isSuggestionsDisabled);
          const isSelected = option.value === currentView;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={isDisabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                "text-left transition-all duration-150",
                "group relative",
                isSelected &&
                  "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
                !isDisabled &&
                  !isSelected &&
                  "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
                isDisabled &&
                  "opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-600",
                index > 0 && "mt-1"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  "transition-all duration-150",
                  isSelected &&
                    "bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-400",
                  !isDisabled &&
                    !isSelected &&
                    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                )}
              >
                <OptionIcon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5 truncate">
                  {option.description}
                </div>
              </div>

              {isSelected && (
                <Check className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              )}

              {isDisabled && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500">
                  Locked
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="px-4 py-3 border-b bg-background">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-2.5",
          "rounded-lg border border-gray-200 dark:border-gray-700",
          "bg-white dark:bg-gray-900 text-sm",
          "hover:bg-gray-50 dark:hover:bg-gray-800",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          "transition-all duration-150",
          "shadow-sm hover:shadow",
          isOpen && "ring-2 ring-blue-500 ring-offset-2"
        )}
        aria-label="Select view"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <CurrentIcon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
          </div>
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {currentOption?.label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {currentView === "notebook" && completedLinesCount === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
          Complete at least one line to unlock other views
        </p>
      )}

      {mounted &&
        dropdownContent &&
        createPortal(dropdownContent, document.body)}
    </div>
  );
}
