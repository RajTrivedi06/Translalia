"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LineNotesEditorProps {
  lineIndex: number;
  value: string | null;
  onChange: (lineIndex: number, value: string | null) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

export function LineNotesEditor({
  lineIndex,
  value,
  onChange,
  onBlur,
  className,
  placeholder,
  maxLength = 1000,
}: LineNotesEditorProps) {
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
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * 2; // Minimum 2 lines
    const maxHeight = lineHeight * 6; // Maximum 6 lines
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    setLocalValue(newValue);
    onChange(lineIndex, newValue.trim() === "" ? null : newValue);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * 2;
    const maxHeight = lineHeight * 6;
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const characterCount = localValue.length;
  const isNearLimit = maxLength && characterCount > maxLength * 0.9;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {t("notesLineLabel", {
            defaultValue: "Line {number}",
            number: lineIndex + 1,
          })}
        </Badge>
      </div>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onInput={handleInput}
          onBlur={onBlur}
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
        {maxLength && localValue.length > 0 && (
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
    </div>
  );
}
