"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { LineNoteTextarea } from "./LineNoteTextarea";
import { useSaveLineNote } from "@/lib/hooks/useNotebookNotes";
import { useNotebookStore } from "@/store/notebookSlice";

export interface LineNotePopoverProps {
  open: boolean;
  lineIndex: number;
  sourceLineText: string;
  noteText: string | null;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
}

function truncateQuote(text: string, maxLength = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function normalizeNote(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function contentForSave(draft: string): string | null {
  return draft.trim() === "" ? null : draft;
}

export function LineNotePopover({
  open,
  lineIndex,
  sourceLineText,
  noteText,
  anchorRef,
  onOpenChange,
}: LineNotePopoverProps) {
  const t = useTranslations("Notebook");
  const titleId = React.useId();
  const lineNumber = lineIndex + 1;

  const setLineNote = useNotebookStore((s) => s.setLineNote);
  const saveLineNote = useSaveLineNote();

  const [draftValue, setDraftValue] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const initialStoredRef = React.useRef("");
  const [hadNoteOnOpen, setHadNoteOnOpen] = React.useState(false);
  const initializedForRef = React.useRef<number | null>(null);
  const savedFeedbackTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!open) {
      initializedForRef.current = null;
      return;
    }
    if (initializedForRef.current === lineIndex) return;
    initializedForRef.current = lineIndex;

    const stored = noteText ?? "";
    initialStoredRef.current = stored;
    setHadNoteOnOpen(normalizeNote(noteText) !== "");
    setDraftValue(stored);
    setSaveError(null);
    setShowSaved(false);
  }, [open, lineIndex, noteText]);

  React.useEffect(() => {
    return () => {
      if (savedFeedbackTimeoutRef.current) {
        clearTimeout(savedFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const isDirty = React.useCallback(() => {
    return normalizeNote(draftValue) !== normalizeNote(initialStoredRef.current);
  }, [draftValue]);

  const flashSaved = React.useCallback(() => {
    setShowSaved(true);
    if (savedFeedbackTimeoutRef.current) {
      clearTimeout(savedFeedbackTimeoutRef.current);
    }
    savedFeedbackTimeoutRef.current = setTimeout(() => {
      setShowSaved(false);
    }, 1500);
  }, []);

  const persistNote = React.useCallback(
    async (content: string | null): Promise<boolean> => {
      const previous = noteText ?? null;
      setSaveError(null);
      setIsSaving(true);
      setLineNote(lineIndex, content);

      try {
        await saveLineNote.mutateAsync({ lineIndex, content });
        initialStoredRef.current = content ?? "";
        flashSaved();
        return true;
      } catch (error) {
        console.error("[LineNotePopover] Save failed:", error);
        setLineNote(lineIndex, previous);
        setSaveError(
          t("notesSaveError", {
            defaultValue: "Couldn't save note. Try again.",
          })
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      flashSaved,
      lineIndex,
      noteText,
      saveLineNote,
      setLineNote,
      t,
    ]
  );

  const handleRequestClose = React.useCallback(
    async (options: { cancel?: boolean } = {}) => {
      if (isSaving) return;

      if (options.cancel) {
        onOpenChange(false);
        return;
      }

      if (isDirty()) {
        const ok = await persistNote(contentForSave(draftValue));
        if (!ok) return;
      }

      onOpenChange(false);
    },
    [draftValue, isDirty, isSaving, onOpenChange, persistNote]
  );

  const handleSave = React.useCallback(async () => {
    if (isSaving) return;
    await persistNote(contentForSave(draftValue));
  }, [draftValue, isSaving, persistNote]);

  const handleDelete = React.useCallback(async () => {
    if (isSaving) return;
    const previous = noteText ?? null;
    setSaveError(null);
    setIsSaving(true);
    setLineNote(lineIndex, null);

    try {
      await saveLineNote.mutateAsync({ lineIndex, content: null });
      onOpenChange(false);
    } catch (error) {
      console.error("[LineNotePopover] Delete failed:", error);
      setLineNote(lineIndex, previous);
      setSaveError(
        t("notesSaveError", {
          defaultValue: "Couldn't save note. Try again.",
        })
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    lineIndex,
    noteText,
    onOpenChange,
    saveLineNote,
    setLineNote,
    t,
  ]);

  const handlePopoverOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return;
      void handleRequestClose();
    },
    [handleRequestClose]
  );

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  };

  const quote =
    sourceLineText.trim().length > 0
      ? truncateQuote(sourceLineText)
      : t("notesPopoverNoSource", {
          defaultValue: "(extra line)",
        });

  return (
    <Popover open={open} onOpenChange={handlePopoverOpenChange} anchorRef={anchorRef}>
      <PopoverContent align="center" ariaLabelledby={titleId} className="min-w-[280px] max-w-[360px]">
        <div className="space-y-3">
          <div>
            <h3 id={titleId} className="text-sm font-semibold text-foreground">
              {t("notesPopoverTitle", {
                defaultValue: "Note on this line",
              })}
            </h3>
            <p className="mt-1 text-xs text-foreground-secondary">
              {t("notesLineLabel", {
                defaultValue: "Line {number}",
                number: lineNumber,
              })}
            </p>
          </div>

          <blockquote className="border-l-2 border-border-subtle pl-2 text-xs italic text-foreground-secondary truncate">
            {quote}
          </blockquote>

          <LineNoteTextarea
            value={draftValue}
            onChange={setDraftValue}
            onKeyDown={handleTextareaKeyDown}
            autoFocus
            maxLength={1000}
          />

          {saveError && (
            <p className="text-xs text-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 min-h-[32px]">
              {showSaved && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {t("notesSaved", { defaultValue: "Saved" })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hadNoteOnOpen && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void handleDelete()}
                  disabled={isSaving}
                >
                  {t("notesPopoverDelete", { defaultValue: "Delete" })}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void handleRequestClose({ cancel: true })}
                disabled={isSaving}
              >
                {t("notesPopoverCancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t("notesSaving", { defaultValue: "Saving..." })}
                  </>
                ) : (
                  t("notesSave", { defaultValue: "Save" })
                )}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
