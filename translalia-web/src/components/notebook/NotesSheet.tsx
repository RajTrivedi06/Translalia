"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThreadNotesEditor } from "./ThreadNotesEditor";
import { useNotebookStore } from "@/store/notebookSlice";
import { useDebouncedNotesSave } from "@/lib/hooks/useDebouncedNotesSave";
import { useNotebookNotes } from "@/lib/hooks/useNotebookNotes";
import { useSaveLineNote } from "@/lib/hooks/useNotebookNotes";

export interface NotesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poemLines: string[];
  sourceLineCount: number;
  onJumpToLine: (lineIndex: number) => void;
  onEditLineNote: (lineIndex: number) => void;
}

function truncateText(text: string, maxLength = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function NotesSheet({
  open,
  onOpenChange,
  poemLines,
  sourceLineCount,
  onJumpToLine,
  onEditLineNote,
}: NotesSheetProps) {
  const t = useTranslations("Notebook");
  const titleId = React.useId();

  const threadNote = useNotebookStore((s) => s.threadNote);
  const lineNotes = useNotebookStore((s) => s.lineNotes);
  const setThreadNote = useNotebookStore((s) => s.setThreadNote);
  const setLineNote = useNotebookStore((s) => s.setLineNote);

  const { isLoading } = useNotebookNotes();
  const { saveStatus, markUnsaved } = useDebouncedNotesSave();
  const saveLineNote = useSaveLineNote();

  const [lineDeleteError, setLineDeleteError] = React.useState<string | null>(
    null
  );

  const sortedLineNotes = React.useMemo(() => {
    return Object.entries(lineNotes)
      .map(([idx, note]) => ({
        lineIndex: Number(idx),
        note,
      }))
      .filter(({ note }) => note.trim().length > 0)
      .sort((a, b) => a.lineIndex - b.lineIndex);
  }, [lineNotes]);

  const handleThreadNoteChange = (value: string) => {
    setThreadNote(value);
    markUnsaved();
  };

  const handleClearThreadNote = () => {
    setThreadNote(null);
    markUnsaved();
  };

  const handleDeleteLineNote = async (lineIndex: number) => {
    const previous = lineNotes[lineIndex] ?? null;
    setLineDeleteError(null);
    setLineNote(lineIndex, null);

    try {
      await saveLineNote.mutateAsync({ lineIndex, content: null });
    } catch (error) {
      console.error("[NotesSheet] Delete line note failed:", error);
      setLineNote(lineIndex, previous);
      setLineDeleteError(
        t("notesSaveError", {
          defaultValue: "Couldn't save note. Try again.",
        })
      );
    }
  };

  const sourceTextForLine = (lineIndex: number) => {
    if (lineIndex >= sourceLineCount) {
      return t("notesPopoverNoSource", { defaultValue: "(extra line)" });
    }
    const text = poemLines[lineIndex] ?? "";
    return text.trim().length > 0 ? truncateText(text) : "…";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col" ariaLabelledby={titleId}>
        <SheetHeader>
          <SheetTitle id={titleId}>
            {t("notesTitle", { defaultValue: "Notes" })}
          </SheetTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
            aria-label={t("notesPopoverClose", { defaultValue: "Close" })}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-foreground-muted" />
              <span className="ml-2 text-sm text-foreground-secondary">
                {t("notesLoading", { defaultValue: "Loading notes..." })}
              </span>
            </div>
          ) : (
            <>
              {/* General Reflection */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("notesThreadTitle", {
                      defaultValue: "General Reflection",
                    })}
                  </h3>
                  <div className="flex items-center gap-2">
                    {saveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-xs text-foreground-secondary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("notesSaving", { defaultValue: "Saving..." })}
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        {t("notesSaved", { defaultValue: "Saved" })}
                      </span>
                    )}
                    {threadNote && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleClearThreadNote}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        {t("notesClear", { defaultValue: "Clear" })}
                      </Button>
                    )}
                  </div>
                </div>
                <ThreadNotesEditor
                  value={threadNote}
                  onChange={handleThreadNoteChange}
                  maxLength={5000}
                />
              </section>

              {/* Line Notes */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("notesLineTitle", { defaultValue: "Line Notes" })}
                  </h3>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    {t("notesSheetSubtitle", {
                      defaultValue: "Notes you've added to specific lines.",
                    })}
                  </p>
                </div>

                {lineDeleteError && (
                  <p className="text-xs text-error" role="alert">
                    {lineDeleteError}
                  </p>
                )}

                {sortedLineNotes.length === 0 ? (
                  <p className="text-sm italic text-foreground-muted">
                    {t("notesEmptyState", {
                      defaultValue:
                        "You haven't added any notes yet. Right-click a line or use the ✎ icon to add one.",
                    })}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sortedLineNotes.map(({ lineIndex, note }) => (
                      <li
                        key={lineIndex}
                        className="rounded-lg border border-border-subtle bg-muted/30 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {t("notesLineLabel", {
                              defaultValue: "Line {number}",
                              number: lineIndex + 1,
                            })}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onJumpToLine(lineIndex)}
                            >
                              {t("notesJumpToLine", {
                                defaultValue: "Jump",
                              })}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onEditLineNote(lineIndex)}
                            >
                              {t("notesEdit", { defaultValue: "Edit" })}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-error hover:text-error"
                              onClick={() => void handleDeleteLineNote(lineIndex)}
                            >
                              {t("notesDelete", { defaultValue: "Delete" })}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs italic text-foreground-secondary truncate">
                          {sourceTextForLine(lineIndex)}
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {note}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
