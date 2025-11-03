"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * OptimizedWordColumn - Memoized word column to prevent unnecessary re-renders
 *
 * Performance optimizations:
 * - React.memo wrapping
 * - Shallow prop comparison
 * - Prevents re-render when parent updates but props unchanged
 */

interface WordColumnProps {
  word: { original: string; position: number; options: string[] };
  pos: string;
  isSelected: boolean;
  selectedValue?: string;
  onSelectOption: (option: string) => void;
}

export const OptimizedWordColumn = React.memo(
  function WordColumn({
    word,
    pos,
    isSelected,
    selectedValue,
    onSelectOption,
  }: WordColumnProps) {
    const [showCustomInput, setShowCustomInput] = React.useState(false);
    const [customValue, setCustomValue] = React.useState("");
    const customInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (showCustomInput && customInputRef.current) {
        customInputRef.current.focus();
      }
    }, [showCustomInput]);

    const handleCustomSubmit = React.useCallback(() => {
      if (customValue.trim()) {
        onSelectOption(customValue.trim());
        setCustomValue("");
        setShowCustomInput(false);
      }
    }, [customValue, onSelectOption]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          handleCustomSubmit();
        } else if (e.key === "Escape") {
          setShowCustomInput(false);
          setCustomValue("");
        }
      },
      [handleCustomSubmit]
    );

    const handleBlur = React.useCallback(() => {
      if (!customValue.trim()) {
        setShowCustomInput(false);
      }
    }, [customValue]);

    return (
      <div className="flex flex-col items-center min-w-[140px] max-w-[180px]">
        {/* Word header and options rendering - optimized with callbacks */}
        <div className="mb-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h3 className="text-lg font-semibold text-gray-800">
              {word.original}
            </h3>
            {isSelected && (
              <span
                className="w-4 h-4 text-green-600 flex-shrink-0"
                aria-label="Selected"
              >
                ✓
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 border rounded",
              pos
            )}
          >
            {pos}
          </span>
        </div>

        {/* Options */}
        <div className="w-full space-y-2">
          {word.options.map((opt, i) => {
            const isThisSelected = selectedValue === opt;

            return (
              <button
                key={`${word.position}-${i}`}
                type="button"
                onClick={() => onSelectOption(opt)}
                className={cn(
                  "w-full text-center rounded-lg border-2 px-3 py-2 transition-all duration-200 text-sm font-medium",
                  isThisSelected
                    ? "border-green-500 bg-green-50 text-green-800 shadow-md scale-105"
                    : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm"
                )}
              >
                {opt}
              </button>
            );
          })}

          {/* Custom input - memoized handlers */}
          {showCustomInput ? (
            <div className="pt-1">
              <input
                ref={customInputRef}
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="Type here..."
                className="w-full text-sm text-center px-2 py-2 border-2 border-dashed border-blue-400 rounded-lg focus:outline-none focus:border-blue-600 bg-blue-50"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={handleCustomSubmit}
                  className="flex-1 h-7 text-xs px-2 rounded hover:bg-gray-100"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomValue("");
                  }}
                  className="flex-1 h-7 text-xs px-2 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full text-center text-xs text-gray-500 hover:text-blue-600 py-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
            >
              ✏️ Custom
            </button>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    return (
      prevProps.word.position === nextProps.word.position &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.selectedValue === nextProps.selectedValue &&
      prevProps.word.options.length === nextProps.word.options.length
    );
  }
);

OptimizedWordColumn.displayName = "OptimizedWordColumn";
