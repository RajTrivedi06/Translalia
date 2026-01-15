"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ThreadNotesEditorProps {
  value: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

export function ThreadNotesEditor({
  value,
  onChange,
  onBlur,
  className,
  placeholder,
  maxLength = 5000,
}: ThreadNotesEditorProps) {
  const t = useTranslations("Notebook");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = React.useState(value || "");

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = lineHeight * 3; // Minimum 3 lines
    const maxHeight = lineHeight * 12; // Maximum 12 lines
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      return; // Don't allow exceeding max length
    }
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = lineHeight * 3;
    const maxHeight = lineHeight * 12;
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const characterCount = localValue.length;
  const isNearLimit = maxLength && characterCount > maxLength * 0.9;

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleChange}
        onInput={handleInput}
        onBlur={onBlur}
        placeholder={
          placeholder ||
          t("notesThreadPlaceholder", {
            defaultValue:
              "Write your reflections about the translation journey...",
          })
        }
        className={cn(
          "w-full resize-none border-slate-200 bg-white",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "text-sm leading-relaxed"
        )}
        rows={3}
        maxLength={maxLength}
      />
      {maxLength && (
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
}
