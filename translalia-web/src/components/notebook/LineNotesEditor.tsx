"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LineNoteTextarea } from "./LineNoteTextarea";

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
  const [localValue, setLocalValue] = React.useState(value || "");

  React.useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

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
      <LineNoteTextarea
        value={localValue}
        onChange={(newValue) => {
          setLocalValue(newValue);
          onChange(lineIndex, newValue.trim() === "" ? null : newValue);
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}
