"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useWorkshopState } from "@/lib/hooks/useWorkshopFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeftRight,
  Copy,
  Download,
  Printer,
  Check,
  AlertCircle,
  X,
  Edit,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonViewProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when sheet open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional: Highlight differences */
  highlightDiffs?: boolean;
  /** Optional: Show line numbers */
  showLineNumbers?: boolean;
  /** Optional: Embedded mode (no Sheet wrapper) */
  embedded?: boolean;
}

/**
 * ComparisonView - Side-by-side comparison of source and translation
 *
 * Features:
 * - Split-screen layout with synchronized scrolling
 * - Line-by-line alignment
 * - Completion status indicators
 * - Missing line highlighting
 * - Export capabilities (copy, TXT, PDF)
 * - Difference highlighting (optional)
 * - Mobile-responsive stacking
 */
export function ComparisonView({
  open,
  onOpenChange,
  highlightDiffs = true,
  showLineNumbers = true,
  embedded = false,
}: ComparisonViewProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const setDraft = useWorkshopStore((s) => s.setDraft);
  const setDraftLines = useWorkshopStore((s) => s.setDraftLines);
  const guideAnswers = useGuideStore((s) => s.answers);
  const translationIntent = useGuideStore(
    (s) => s.translationIntent.text ?? null
  );

  const threadId = useThreadId() || undefined;
  const { data: savedWorkshopLines } = useWorkshopState(threadId);

  const targetLanguageName = guideAnswers.targetLanguage?.lang?.trim() || null;
  const targetVarietyName = guideAnswers.targetLanguage?.variety?.trim() || "";
  const targetLanguageDisplay =
    targetLanguageName ||
    (translationIntent ? "See translation intent" : "Not specified");

  const [copied, setCopied] = React.useState(false);
  const [syncScroll, setSyncScroll] = React.useState(true);

  // Whole-edit mode state
  const [editMode, setEditMode] = React.useState<"compare" | "whole-edit">(
    "compare"
  );
  const [wholeTranslation, setWholeTranslation] = React.useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const leftScrollRef = React.useRef<HTMLDivElement>(null);
  const rightScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollingRef = React.useRef<"left" | "right" | null>(null);

  const totalLines = poemLines.length;
  const getSavedTranslated = React.useCallback(
    (idx: number) => {
      if (!savedWorkshopLines || typeof savedWorkshopLines !== "object") {
        return null;
      }
      const entry = (savedWorkshopLines as Record<number, unknown>)[idx];
      if (!entry || typeof entry !== "object") return null;
      const translated = (entry as { translated?: unknown }).translated;
      return typeof translated === "string" && translated.trim().length > 0
        ? translated
        : null;
    },
    [savedWorkshopLines]
  );

  const confirmedCompletedCount = React.useMemo(() => {
    let count = 0;
    for (let idx = 0; idx < poemLines.length; idx++) {
      if (getSavedTranslated(idx) !== null) count++;
    }
    return count;
  }, [poemLines.length, getSavedTranslated]);
  const progressPercentage =
    totalLines > 0
      ? Math.round((confirmedCompletedCount / totalLines) * 100)
      : 0;

  // Synchronized scrolling
  const handleScroll = (
    source: "left" | "right",
    e: React.UIEvent<HTMLDivElement>
  ) => {
    if (!syncScroll) return;
    if (scrollingRef.current && scrollingRef.current !== source) return;

    scrollingRef.current = source;
    const target = e.currentTarget;
    const otherRef = source === "left" ? rightScrollRef : leftScrollRef;

    if (otherRef.current) {
      otherRef.current.scrollTop = target.scrollTop;
    }

    // Reset scrolling ref after a brief delay
    setTimeout(() => {
      scrollingRef.current = null;
    }, 50);
  };

  // Assemble comparison data
  const getConfirmedTranslation = getSavedTranslated;

  const getStudioValue = React.useCallback(
    (idx: number) => {
      const hasDraft = Object.prototype.hasOwnProperty.call(
        draftLines,
        idx
      );
      if (hasDraft) return draftLines[idx] ?? "";
      return getConfirmedTranslation(idx) ?? "";
    },
    [draftLines, getConfirmedTranslation]
  );

  const isLineConfirmedSaved = React.useCallback(
    (idx: number) => getConfirmedTranslation(idx) !== null,
    [getConfirmedTranslation]
  );

  const comparisonLines = React.useMemo(() => {
    return poemLines.map((sourceLine, idx) => {
      const translation = getStudioValue(idx);
      const confirmed = isLineConfirmedSaved(idx);
      return {
        lineNumber: idx + 1,
        source: sourceLine,
        translation: translation.trim().length > 0 ? translation : null,
        isCompleted: confirmed,
      };
    });
  }, [poemLines, getStudioValue, isLineConfirmedSaved]);

  const availableTranslationCount = React.useMemo(() => {
    return comparisonLines.reduce((acc, line) => {
      return typeof line.translation === "string" &&
        line.translation.trim().length > 0
        ? acc + 1
        : acc;
    }, 0);
  }, [comparisonLines]);

  // Assemble complete translation from Studio drafts + confirmed saves
  const assembleWholeTranslation = React.useCallback(() => {
    return poemLines.map((_, idx) => getStudioValue(idx) || "").join("\n");
  }, [poemLines, getStudioValue]);

  // When a confirmed save arrives, drop any matching drafts
  React.useEffect(() => {
    if (!savedWorkshopLines) return;

    const currentDrafts = useWorkshopStore.getState().draftLines;
    const nextDrafts: Record<number, string> = { ...currentDrafts };
    let changed = false;

    for (const [k, draft] of Object.entries(currentDrafts)) {
      const idx = Number(k);
      if (!Number.isFinite(idx)) continue;
      const confirmed = getConfirmedTranslation(idx);
      if (confirmed && draft.trim() === confirmed.trim()) {
        delete nextDrafts[idx];
        changed = true;
      }
    }

    if (changed) {
      useWorkshopStore.getState().setDraftLines(nextDrafts);
    }
  }, [savedWorkshopLines, getConfirmedTranslation]);

  // Initialize whole translation when entering edit mode
  React.useEffect(() => {
    if (editMode === "whole-edit" && !wholeTranslation) {
      setWholeTranslation(assembleWholeTranslation());
    }
  }, [editMode, wholeTranslation, assembleWholeTranslation]);

  // Save whole translation back to Studio drafts
  const handleSaveWholeTranslation = React.useCallback(() => {
    // Split the whole translation back into lines
    const translationLines = wholeTranslation.split("\n");

    // Only store drafts that differ from confirmed saves.
    // This avoids "blank drafts" overriding newly confirmed translations.
    const nextDraftLines: Record<number, string> = {};
    translationLines.forEach((line, idx) => {
      if (idx < poemLines.length) {
        const draft = line.trim();
        const confirmed = (getConfirmedTranslation(idx) ?? "").trim();
        if (draft !== confirmed) {
          nextDraftLines[idx] = draft;
        }
      }
    });

    // Save into drafts (does not mark as confirmed-saved)
    setDraftLines(nextDraftLines);

    // Show success feedback
    setSaveSuccess(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [
    wholeTranslation,
    poemLines.length,
    getConfirmedTranslation,
    setDraftLines,
  ]);

  // Reset whole translation to original
  const handleResetWholeTranslation = React.useCallback(() => {
    setWholeTranslation(assembleWholeTranslation());
    setHasUnsavedChanges(false);
  }, [assembleWholeTranslation]);

  // Keyboard shortcuts for whole-edit mode
  React.useEffect(() => {
    if (editMode !== "whole-edit" || !open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSaveWholeTranslation();
        }
      }

      // ESC to discard changes
      if (e.key === "Escape" && hasUnsavedChanges) {
        e.preventDefault();
        if (confirm("Discard unsaved changes?")) {
          handleResetWholeTranslation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editMode,
    open,
    hasUnsavedChanges,
    handleSaveWholeTranslation,
    handleResetWholeTranslation,
  ]);

  // Export functions
  const handleCopyComparison = async () => {
    const text = comparisonLines
      .map(
        (line) =>
          `${line.lineNumber}. ${line.source}\n   → ${
            line.translation || "[Not translated]"
          }`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExportComparison = () => {
    const targetLang =
      targetLanguageName ||
      (translationIntent ? "As described in translation intent" : "Unknown");
    const intentLine = translationIntent
      ? `Intent: ${translationIntent}\n`
      : "";
    const header = `Source-Translation Comparison\nTarget Language: ${targetLang}\n${intentLine}Date: ${new Date().toLocaleDateString()}\n${"=".repeat(
      60
    )}\n\n`;

    const content = comparisonLines
      .map(
        (line) =>
          `Line ${line.lineNumber}\nSource: ${line.source}\nTranslation: ${
            line.translation || "[Not yet translated]"
          }\n`
      )
      .join("\n");

    const exportText = header + content;
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintComparison = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the comparison");
      return;
    }

    const targetLang =
      targetLanguageName ||
      (translationIntent ? "As described in translation intent" : "Unknown");
    const safeIntentHtml = translationIntent
      ? translationIntent
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />")
      : "";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Source-Translation Comparison</title>
          <meta charset="utf-8">
          <style>
            @media print {
              body { margin: 0; padding: 20mm; }
              .no-print { display: none; }
            }
            body {
              font-family: 'Georgia', 'Times New Roman', serif;
              line-height: 1.6;
              color: #333;
              max-width: 1000px;
              margin: 0 auto;
              padding: 40px;
            }
            h1 {
              font-size: 22px;
              margin-bottom: 24px;
              color: #1a1a1a;
              border-bottom: 2px solid #333;
              padding-bottom: 8px;
            }
            .comparison-row {
              display: grid;
              grid-template-columns: 40px 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
              padding-bottom: 20px;
              border-bottom: 1px solid #eee;
            }
            .line-number {
              color: #999;
              font-size: 12px;
              font-weight: bold;
            }
            .source {
              font-style: italic;
              color: #666;
            }
            .translation {
              color: #1a1a1a;
              font-weight: 500;
            }
            .missing {
              color: #999;
              font-style: italic;
            }
            .column-header {
              font-size: 12px;
              font-weight: bold;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 12px;
            }
            .comparison-meta {
              font-size: 12px;
              color: #666;
              margin-bottom: 24px;
            }
            .comparison-meta div {
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Print / Save as PDF</button>
            <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-left: 8px;">Close</button>
          </div>

          <h1>Source-Translation Comparison - ${targetLang}</h1>
          <div class="comparison-meta">
            <div>Target language: ${targetLang}</div>
            ${translationIntent ? `<div>Intent: ${safeIntentHtml}</div>` : ""}
            <div>Date: ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="comparison-row" style="border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px;">
            <div class="line-number"></div>
            <div class="column-header">Source Text</div>
            <div class="column-header">Translation</div>
          </div>

          ${comparisonLines
            .map(
              (line) => `
            <div class="comparison-row">
              <div class="line-number">${line.lineNumber}</div>
              <div class="source">${line.source}</div>
              <div class="${line.translation ? "translation" : "missing"}">
                ${line.translation || "[Not yet translated]"}
              </div>
            </div>
          `
            )
            .join("")}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; font-size: 12px; color: #666;">
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Progress: ${confirmedCompletedCount}/${totalLines} lines (${progressPercentage}%)</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Handle sheet close with unsaved changes warning
  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      // Warn if closing with unsaved changes
      if (!isOpen && hasUnsavedChanges && editMode === "whole-edit") {
        if (!confirm("You have unsaved changes. Close anyway?")) {
          return; // Don't close
        }
        // Reset state if closing without saving
        setHasUnsavedChanges(false);
        setWholeTranslation("");
      }

      // Reset edit mode when closing
      if (!isOpen) {
        setEditMode("compare");
        setWholeTranslation("");
        setHasUnsavedChanges(false);
      }

      onOpenChange(isOpen);
    },
    [hasUnsavedChanges, editMode, onOpenChange]
  );

  // Render the main content (used in both embedded and sheet modes)
  const renderContent = () => (
    <>
      {/* Header */}
      <div className="border-b pb-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">
              {embedded
                ? "Comparison"
                : "Source-Translation Comparison"}
            </h2>
          </div>
          {!embedded && (
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 hover:bg-gray-100 transition"
              aria-label="Close comparison"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
        {embedded && (
          <p className="text-sm text-muted-foreground mt-2">
            Edit and refine your complete translation
          </p>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant={editMode === "compare" ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode("compare")}
            className="gap-1"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Line-by-Line
          </Button>
          <Button
            variant={editMode === "whole-edit" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setEditMode("whole-edit");
              if (!wholeTranslation) {
                setWholeTranslation(assembleWholeTranslation());
              }
            }}
            className="gap-1"
          >
            <Edit className="w-4 h-4" />
            Edit Whole
          </Button>

          {hasUnsavedChanges && editMode === "whole-edit" && (
            <Badge
              variant="secondary"
              className="text-amber-600 bg-amber-50 ml-2"
            >
              ⚠️ Unsaved changes
            </Badge>
          )}

          {saveSuccess && (
            <Badge
              variant="secondary"
              className="text-green-600 bg-green-50 ml-2"
            >
              <Check className="w-3 h-3 mr-1" />
              Saved!
            </Badge>
          )}
        </div>

        {/* Stats and Actions Bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {confirmedCompletedCount}
              </span>{" "}
              of <span className="font-medium text-gray-900">{totalLines}</span>{" "}
              lines ({progressPercentage}%)
            </div>
            {confirmedCompletedCount < totalLines && (
              <Badge variant="secondary" className="text-xs">
                {totalLines - confirmedCompletedCount} remaining
              </Badge>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyComparison}
              disabled={availableTranslationCount === 0}
              title="Copy comparison"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportComparison}
              disabled={availableTranslationCount === 0}
              title="Export as TXT"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrintComparison}
              disabled={availableTranslationCount === 0}
              title="Print or save as PDF"
            >
              <Printer className="w-4 h-4 mr-1" />
              PDF
            </Button>
            {editMode === "compare" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncScroll(!syncScroll)}
                className={cn(syncScroll && "bg-blue-50 text-blue-700")}
                title="Toggle synchronized scrolling"
              >
                {syncScroll ? "Sync: ON" : "Sync: OFF"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Split-Screen Comparison / Whole Edit Mode */}
      <div
        className={cn(
          "flex gap-px bg-gray-200",
          embedded ? "flex-1 min-h-0" : "h-[calc(100%-180px)]"
        )}
      >
        {editMode === "compare" ? (
          <>
            {/* Source Column */}
            <div className="flex-1 bg-white flex flex-col">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Source Text
                </h3>
                <p className="text-xs text-gray-500 mt-1">Original poem</p>
              </div>
              <div
                ref={leftScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                onScroll={(e) => handleScroll("left", e)}
              >
                {comparisonLines.map((line) => (
                  <div
                    key={`source-${line.lineNumber}`}
                    className="group relative"
                    id={`source-line-${line.lineNumber}`}
                  >
                    {showLineNumbers && (
                      <div className="text-xs text-gray-400 font-mono mb-1">
                        Line {line.lineNumber}
                      </div>
                    )}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {line.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-1 bg-gray-300 flex-shrink-0" />

            {/* Translation Column */}
            <div className="flex-1 bg-white flex flex-col">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Translation
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  {targetLanguageDisplay}
                  {targetLanguageName && targetVarietyName
                    ? ` (${targetVarietyName})`
                    : ""}
                </p>
                {translationIntent && (
                  <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                    {translationIntent}
                  </p>
                )}
              </div>
              <div
                ref={rightScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                onScroll={(e) => handleScroll("right", e)}
              >
                {comparisonLines.map((line) => (
                  <div
                    key={`translation-${line.lineNumber}`}
                    className="group relative"
                    id={`translation-line-${line.lineNumber}`}
                  >
                    {showLineNumbers && (
                      <div className="text-xs text-gray-400 font-mono mb-1">
                        Line {line.lineNumber}
                      </div>
                    )}
                    <div
                      className={cn(
                        "p-3 rounded-lg border transition",
                        line.isCompleted
                          ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:border-blue-300"
                          : "bg-white border-gray-300 border-dashed hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {line.isCompleted ? (
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        )}

                        <textarea
                          value={getStudioValue(line.lineNumber - 1)}
                          onChange={(e) =>
                            setDraft(
                              line.lineNumber - 1,
                              e.target.value
                            )
                          }
                          placeholder={
                            line.isCompleted
                              ? undefined
                              : "Translation not yet completed"
                          }
                          className={cn(
                            "flex-1 min-h-[44px] w-full resize-y bg-transparent",
                            "text-sm leading-relaxed outline-none",
                            line.isCompleted
                              ? "text-gray-900 font-medium"
                              : "text-gray-700"
                          )}
                        />
                      </div>
                    </div>

                    {/* Difference indicator (if enabled) */}
                    {highlightDiffs && line.isCompleted && (
                      <DifferenceIndicator
                        source={line.source}
                        translation={line.translation || ""}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Left: Original Poem (read-only reference) */}
            <div className="flex-1 bg-white flex flex-col">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Original Poem
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Reference while editing
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-800">
                  {poemLines.join("\n")}
                </pre>
              </div>
            </div>

            {/* Divider */}
            <div className="w-1 bg-gray-300 flex-shrink-0" />

            {/* Right: Editable Complete Translation */}
            <div className="flex-1 bg-white flex flex-col">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Your Complete Translation
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Edit the entire translation as continuous text
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetWholeTranslation}
                      className="gap-1"
                      title="Reset to original"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveWholeTranslation}
                      disabled={!hasUnsavedChanges}
                      className="gap-1"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-4 flex flex-col min-h-0">
                <textarea
                  value={wholeTranslation}
                  onChange={(e) => {
                    setWholeTranslation(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full flex-1 resize-none border rounded-lg p-4 font-sans text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
                  placeholder="Your complete translation will appear here..."
                  spellCheck={false}
                />
              </div>
              <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  Tip: Press{" "}
                  <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px]">
                    ⌘/Ctrl
                  </kbd>{" "}
                  +{" "}
                  <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px]">
                    Enter
                  </kbd>{" "}
                  to save
                </span>
                <span>{wholeTranslation.split("\n").length} lines</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Summary */}
      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div>
            {confirmedCompletedCount === totalLines ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Check className="w-4 h-4" />
                Translation complete!
              </span>
            ) : (
              <span>
                {totalLines - confirmedCompletedCount} line
                {totalLines - confirmedCompletedCount !== 1 ? "s" : ""}{" "}
                remaining
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Synchronized scrolling:</span>
            <Badge
              variant={syncScroll ? "default" : "secondary"}
              className="text-xs"
            >
              {syncScroll ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
      </div>
    </>
  );

  // If embedded, render content directly without Sheet
  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-background">
        {renderContent()}
      </div>
    );
  }

  // Otherwise, use Sheet wrapper (original behavior)
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl"
        ariaLabelledby="comparison-title"
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle
              id="comparison-title"
              className="flex items-center gap-2"
            >
              <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              Source-Translation Comparison
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 hover:bg-gray-100 transition"
              aria-label="Close comparison"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant={editMode === "compare" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode("compare")}
              className="gap-1"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Line-by-Line
            </Button>
            <Button
              variant={editMode === "whole-edit" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditMode("whole-edit");
                if (!wholeTranslation) {
                  setWholeTranslation(assembleWholeTranslation());
                }
              }}
              className="gap-1"
            >
              <Edit className="w-4 h-4" />
              Edit Whole
            </Button>

            {hasUnsavedChanges && editMode === "whole-edit" && (
              <Badge
                variant="secondary"
                className="text-amber-600 bg-amber-50 ml-2"
              >
                ⚠️ Unsaved changes
              </Badge>
            )}

            {saveSuccess && (
              <Badge
                variant="secondary"
                className="text-green-600 bg-green-50 ml-2"
              >
                <Check className="w-3 h-3 mr-1" />
                Saved!
              </Badge>
            )}
          </div>

          {/* Stats and Actions Bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {confirmedCompletedCount}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">{totalLines}</span>{" "}
                lines ({progressPercentage}%)
              </div>
              {confirmedCompletedCount < totalLines && (
                <Badge variant="secondary" className="text-xs">
                  {totalLines - confirmedCompletedCount} remaining
                </Badge>
              )}
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyComparison}
                disabled={availableTranslationCount === 0}
                title="Copy comparison"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportComparison}
                disabled={availableTranslationCount === 0}
                title="Export as TXT"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrintComparison}
                disabled={availableTranslationCount === 0}
                title="Print or save as PDF"
              >
                <Printer className="w-4 h-4 mr-1" />
                PDF
              </Button>
              {editMode === "compare" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSyncScroll(!syncScroll)}
                  className={cn(syncScroll && "bg-blue-50 text-blue-700")}
                  title="Toggle synchronized scrolling"
                >
                  {syncScroll ? "Sync: ON" : "Sync: OFF"}
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Split-Screen Comparison / Whole Edit Mode */}
        <div className="flex h-[calc(100%-180px)] gap-px bg-gray-200">
          {editMode === "compare" ? (
            <>
              {/* Source Column */}
              <div className="flex-1 bg-white flex flex-col">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Source Text
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Original poem</p>
                </div>
                <div
                  ref={leftScrollRef}
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                  onScroll={(e) => handleScroll("left", e)}
                >
                  {comparisonLines.map((line) => (
                    <div
                      key={`source-${line.lineNumber}`}
                      className="group relative"
                      id={`source-line-${line.lineNumber}`}
                    >
                      {showLineNumbers && (
                        <div className="text-xs text-gray-400 font-mono mb-1">
                          Line {line.lineNumber}
                        </div>
                      )}
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
                        <p className="text-sm text-gray-900 leading-relaxed">
                          {line.source}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="w-1 bg-gray-300 flex-shrink-0" />

              {/* Translation Column */}
              <div className="flex-1 bg-white flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Translation
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {targetLanguageDisplay}
                    {targetLanguageName && targetVarietyName
                      ? ` (${targetVarietyName})`
                      : ""}
                  </p>
                  {translationIntent && (
                    <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                      {translationIntent}
                    </p>
                  )}
                </div>
                <div
                  ref={rightScrollRef}
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                  onScroll={(e) => handleScroll("right", e)}
                >
                  {comparisonLines.map((line) => (
                    <div
                      key={`translation-${line.lineNumber}`}
                      className="group relative"
                      id={`translation-line-${line.lineNumber}`}
                    >
                      {showLineNumbers && (
                        <div className="text-xs text-gray-400 font-mono mb-1">
                          Line {line.lineNumber}
                        </div>
                      )}
                      <div
                        className={cn(
                          "p-3 rounded-lg border transition",
                          line.isCompleted
                            ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:border-blue-300"
                            : "bg-white border-gray-300 border-dashed hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {line.isCompleted ? (
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}

                          <textarea
                            value={getStudioValue(line.lineNumber - 1)}
                            onChange={(e) =>
                              setDraft(
                                line.lineNumber - 1,
                                e.target.value
                              )
                            }
                            placeholder={
                              line.isCompleted
                                ? undefined
                                : "Translation not yet completed"
                            }
                            className={cn(
                              "flex-1 min-h-[44px] w-full resize-y bg-transparent",
                              "text-sm leading-relaxed outline-none",
                              line.isCompleted
                                ? "text-gray-900 font-medium"
                                : "text-gray-700"
                            )}
                          />
                        </div>
                      </div>

                      {/* Difference indicator (if enabled) */}
                      {highlightDiffs && line.isCompleted && (
                        <DifferenceIndicator
                          source={line.source}
                          translation={line.translation || ""}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Left: Original Poem (read-only reference) */}
              <div className="flex-1 bg-white flex flex-col">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Original Poem
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Reference while editing
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-800">
                    {poemLines.join("\n")}
                  </pre>
                </div>
              </div>

              {/* Divider */}
              <div className="w-1 bg-gray-300 flex-shrink-0" />

              {/* Right: Editable Complete Translation */}
              <div className="flex-1 bg-white flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Your Complete Translation
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Edit the entire translation as continuous text
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetWholeTranslation}
                        className="gap-1"
                        title="Reset to original"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveWholeTranslation}
                        disabled={!hasUnsavedChanges}
                        className="gap-1"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-4 flex flex-col min-h-0">
                  <textarea
                    value={wholeTranslation}
                    onChange={(e) => {
                      setWholeTranslation(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full flex-1 resize-none border rounded-lg p-4 font-sans text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
                    placeholder="Your complete translation will appear here..."
                    spellCheck={false}
                  />
                </div>
                <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Tip: Press{" "}
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px]">
                      ⌘/Ctrl
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px]">
                      Enter
                    </kbd>{" "}
                    to save
                  </span>
                  <span>{wholeTranslation.split("\n").length} lines</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Summary */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div>
              {confirmedCompletedCount === totalLines ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <Check className="w-4 h-4" />
                  Translation complete!
                </span>
              ) : (
                <span>
                  {totalLines - confirmedCompletedCount} line
                  {totalLines - confirmedCompletedCount !== 1 ? "s" : ""}{" "}
                  remaining
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Synchronized scrolling:</span>
              <Badge
                variant={syncScroll ? "default" : "secondary"}
                className="text-xs"
              >
                {syncScroll ? "ON" : "OFF"}
              </Badge>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * DifferenceIndicator - Shows simple metrics comparing source and translation
 */
function DifferenceIndicator({
  source,
  translation,
}: {
  source: string;
  translation: string;
}) {
  const sourceWords = source.split(/\s+/).filter(Boolean).length;
  const translationWords = translation.split(/\s+/).filter(Boolean).length;
  const wordDiff = translationWords - sourceWords;
  const lengthRatio = translation.length / source.length;

  // Don't show if very similar
  if (Math.abs(wordDiff) <= 1 && lengthRatio > 0.8 && lengthRatio < 1.2) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-1">
        <span>Word count:</span>
        <Badge variant="secondary" className="text-xs">
          {sourceWords} → {translationWords}
          {wordDiff > 0 && ` (+${wordDiff})`}
          {wordDiff < 0 && ` (${wordDiff})`}
        </Badge>
      </div>
      {lengthRatio < 0.7 && (
        <span className="text-amber-600">⚠️ Much shorter</span>
      )}
      {lengthRatio > 1.5 && (
        <span className="text-amber-600">⚠️ Much longer</span>
      )}
    </div>
  );
}
