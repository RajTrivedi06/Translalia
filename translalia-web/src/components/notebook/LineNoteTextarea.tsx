"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface LineNoteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

export const LineNoteTextarea = React.forwardRef<
  HTMLTextAreaElement,
  LineNoteTextareaProps
>(function LineNoteTextarea(
  {
    value,
    onChange,
    onBlur,
    onKeyDown,
    className,
    placeholder,
    maxLength = 1000,
    autoFocus = false,
  },
  ref
) {
  const t = useTranslations("Notebook");
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = React.useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * 2;
    const maxHeight = lineHeight * 6;
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  React.useEffect(() => {
    const textarea = internalRef.current;
    if (!textarea) return;
    resizeTextarea(textarea);
  }, [value, resizeTextarea]);

  React.useEffect(() => {
    if (!autoFocus) return;
    const textarea = internalRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    onChange(newValue);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    resizeTextarea(e.currentTarget);
  };

  const characterCount = value.length;
  const isNearLimit = maxLength && characterCount > maxLength * 0.9;

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={mergeRefs(ref, internalRef)}
        value={value}
        onChange={handleChange}
        onInput={handleInput}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-popover-autofocus
        placeholder={
          placeholder ||
          t("notesLinePlaceholder", {
            defaultValue: "Add a note for this line...",
          })
        }
        className={cn(
          "w-full resize-none border-slate-200 bg-white",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "text-sm leading-relaxed"
        )}
        rows={2}
        maxLength={maxLength}
      />
      {maxLength && value.length > 0 && (
        <div
          className={cn(
            "absolute bottom-2 right-2 text-xs",
            isNearLimit ? "text-amber-600" : "text-slate-400"
          )}
        >
          {characterCount} / {maxLength}
        </div>
      )}
    </div>
  );
});
