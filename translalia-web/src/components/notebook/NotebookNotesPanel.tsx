"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Save, Check, Loader2, X } from "lucide-react";
import { useNotebookStore } from "@/store/notebookSlice";
import {
  useNotebookNotes,
  useSaveNotebookNotes,
} from "@/lib/hooks/useNotebookNotes";
import { ThreadNotesEditor } from "./ThreadNotesEditor";
import { LineNotesEditor } from "./LineNotesEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkshopStore } from "@/store/workshopSlice";

interface NotebookNotesPanelProps {
  className?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NotebookNotesPanel({ className }: NotebookNotesPanelProps) {
  const t = useTranslations("Notebook");
  const notesExpanded = useNotebookStore((s) => s.notesExpanded);
  const toggleNotesPanel = useNotebookStore((s) => s.toggleNotesPanel);
  const setNotesExpanded = useNotebookStore((s) => s.setNotesExpanded);
  const threadNote = useNotebookStore((s) => s.threadNote);
  const lineNotes = useNotebookStore((s) => s.lineNotes);
  const setThreadNote = useNotebookStore((s) => s.setThreadNote);
  const setLineNote = useNotebookStore((s) => s.setLineNote);
  const setNotes = useNotebookStore((s) => s.setNotes);
  const updateNotesLastSaved = useNotebookStore((s) => s.updateNotesLastSaved);

  const currentLineIndex = useWorkshopStore((s) => s.currentLineIndex);

  const { data: notesData, isLoading } = useNotebookNotes();
  const saveNotes = useSaveNotebookNotes();

  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load notes from API into store when fetched
  React.useEffect(() => {
    if (notesData && isInitialLoad) {
      setNotes(notesData.threadNote, notesData.lineNotes);
      setHasUnsavedChanges(false);
      setIsInitialLoad(false);
    }
  }, [notesData, setNotes, isInitialLoad]);

  // Debounced auto-save
  const debouncedSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!hasUnsavedChanges) return;

      setSaveStatus("saving");
      try {
        await saveNotes.mutateAsync({
          threadNote: threadNote,
          lineNotes: lineNotes,
        });
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
        updateNotesLastSaved();
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("[NotebookNotesPanel] Save error:", error);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 2500); // 2.5 second debounce
  }, [
    hasUnsavedChanges,
    threadNote,
    lineNotes,
    saveNotes,
    updateNotesLastSaved,
  ]);

  // Trigger debounced save when notes change (but not on initial load)
  React.useEffect(() => {
    if (hasUnsavedChanges && !isInitialLoad) {
      // Only auto-save if we've loaded initial data and user made changes
      debouncedSave();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [threadNote, lineNotes, debouncedSave, hasUnsavedChanges, isInitialLoad]);

  const handleThreadNoteChange = (value: string) => {
    setThreadNote(value);
    setHasUnsavedChanges(true);
  };

  const handleLineNoteChange = (lineIndex: number, value: string | null) => {
    setLineNote(lineIndex, value);
    setHasUnsavedChanges(true);
  };

  const handleManualSave = React.useCallback(async () => {
    if (saveStatus === "saving") return;

    setSaveStatus("saving");
    try {
      await saveNotes.mutateAsync({
        threadNote: threadNote,
        lineNotes: lineNotes,
      });
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      updateNotesLastSaved();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("[NotebookNotesPanel] Manual save error:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [saveStatus, saveNotes, threadNote, lineNotes, updateNotesLastSaved]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!notesExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        setNotesExpanded(false);
      } else if (modifier && e.key === "Enter") {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notesExpanded, setNotesExpanded, handleManualSave]);

  const currentLineNote =
    currentLineIndex !== null ? lineNotes[currentLineIndex] || null : null;
  const hasLineNotes = Object.keys(lineNotes).length > 0;

  return (
    <div
      className={cn(
        "flex flex-col border-t border-slate-200 bg-white",
        className
      )}
    >
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={toggleNotesPanel}
        className={cn(
          "flex items-center justify-between px-4 py-3",
          "hover:bg-slate-50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        )}
        aria-label={
          notesExpanded
            ? t("notesCollapse", { defaultValue: "Collapse notes" })
            : t("notesExpand", { defaultValue: "Expand notes" })
        }
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {t("notesTitle", { defaultValue: "Notes" })}
          </span>
          {hasUnsavedChanges && (
            <Badge
              variant="secondary"
              className="text-xs text-amber-600 bg-amber-50"
            >
              {t("notesUnsaved", { defaultValue: "Unsaved" })}
            </Badge>
          )}
          {saveStatus === "saving" && (
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {t("notesSaving", { defaultValue: "Saving..." })}
            </Badge>
          )}
          {saveStatus === "saved" && (
            <Badge
              variant="secondary"
              className="text-xs text-green-600 bg-green-50"
            >
              <Check className="w-3 h-3 mr-1" />
              {t("notesSaved", { defaultValue: "Saved" })}
            </Badge>
          )}
          {hasLineNotes && (
            <Badge variant="outline" className="text-xs">
              {Object.keys(lineNotes).length}{" "}
              {t("notesLineCount", { defaultValue: "line notes" })}
            </Badge>
          )}
        </div>
        {notesExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {notesExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 bg-slate-50/50">
              <div className="max-h-[400px] overflow-y-auto p-4 space-y-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    <span className="ml-2 text-sm text-slate-500">
                      {t("notesLoading", { defaultValue: "Loading notes..." })}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Thread Notes Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t("notesThreadTitle", {
                            defaultValue: "General Reflection",
                          })}
                        </h3>
                        {threadNote && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              setThreadNote(null);
                              setHasUnsavedChanges(true);
                            }}
                          >
                            <X className="w-3 h-3 mr-1" />
                            {t("notesClear", { defaultValue: "Clear" })}
                          </Button>
                        )}
                      </div>
                      <ThreadNotesEditor
                        value={threadNote}
                        onChange={handleThreadNoteChange}
                        maxLength={5000}
                      />
                    </div>

                    {/* Line Notes Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t("notesLineTitle", { defaultValue: "Line Notes" })}
                        </h3>
                        {currentLineIndex !== null && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleManualSave}
                            disabled={
                              saveStatus === "saving" || !hasUnsavedChanges
                            }
                          >
                            {saveStatus === "saving" ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                {t("notesSaving", {
                                  defaultValue: "Saving...",
                                })}
                              </>
                            ) : (
                              <>
                                <Save className="w-3 h-3 mr-1" />
                                {t("notesSave", { defaultValue: "Save" })} (⌘↵)
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Current Line Note Editor */}
                      {currentLineIndex !== null && (
                        <LineNotesEditor
                          lineIndex={currentLineIndex}
                          value={currentLineNote}
                          onChange={handleLineNoteChange}
                          maxLength={1000}
                        />
                      )}

                      {currentLineIndex === null && (
                        <p className="text-sm text-slate-500 italic">
                          {t("notesSelectLine", {
                            defaultValue:
                              "Select a line in the notebook to add a note",
                          })}
                        </p>
                      )}

                      {/* Show other line notes if any */}
                      {hasLineNotes && Object.keys(lineNotes).length > 1 && (
                        <div className="mt-4 space-y-3">
                          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                            {t("notesOtherLines", {
                              defaultValue: "Other Line Notes",
                            })}
                          </p>
                          {Object.entries(lineNotes)
                            .filter(([idx]) => Number(idx) !== currentLineIndex)
                            .map(([idx, note]) => (
                              <div key={idx} className="space-y-1">
                                <LineNotesEditor
                                  lineIndex={Number(idx)}
                                  value={note}
                                  onChange={handleLineNoteChange}
                                  maxLength={1000}
                                />
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
