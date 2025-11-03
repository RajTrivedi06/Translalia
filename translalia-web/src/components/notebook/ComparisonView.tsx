"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
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
}: ComparisonViewProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const guideAnswers = useGuideStore((s) => s.answers);
  const translationIntent = useGuideStore(
    (s) => s.translationIntent.text ?? null
  );

  const targetLanguageName =
    guideAnswers.targetLanguage?.lang?.trim() || null;
  const targetVarietyName =
    guideAnswers.targetLanguage?.variety?.trim() || "";
  const targetLanguageDisplay =
    targetLanguageName ||
    (translationIntent ? "See translation intent" : "Not specified");

  const [copied, setCopied] = React.useState(false);
  const [syncScroll, setSyncScroll] = React.useState(true);

  const leftScrollRef = React.useRef<HTMLDivElement>(null);
  const rightScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollingRef = React.useRef<"left" | "right" | null>(null);

  const totalLines = poemLines.length;
  const completedCount = Object.keys(completedLines).length;
  const progressPercentage =
    totalLines > 0 ? Math.round((completedCount / totalLines) * 100) : 0;

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
  const comparisonLines = React.useMemo(() => {
    return poemLines.map((sourceLine, idx) => ({
      lineNumber: idx + 1,
      source: sourceLine,
      translation: completedLines[idx] || null,
      isCompleted: completedLines[idx] !== undefined,
    }));
  }, [poemLines, completedLines]);

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
            <p>Progress: ${completedCount}/${totalLines} lines (${progressPercentage}%)</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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

          {/* Stats and Actions Bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {completedCount}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">{totalLines}</span>{" "}
                lines ({progressPercentage}%)
              </div>
              {completedCount < totalLines && (
                <Badge variant="secondary" className="text-xs">
                  {totalLines - completedCount} remaining
                </Badge>
              )}
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyComparison}
                disabled={completedCount === 0}
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
                disabled={completedCount === 0}
                title="Export as TXT"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrintComparison}
                disabled={completedCount === 0}
                title="Print or save as PDF"
              >
                <Printer className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncScroll(!syncScroll)}
                className={cn(syncScroll && "bg-blue-50 text-blue-700")}
                title="Toggle synchronized scrolling"
              >
                {syncScroll ? "Sync: ON" : "Sync: OFF"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Split-Screen Comparison */}
        <div className="flex h-[calc(100%-140px)] gap-px bg-gray-200">
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
                    {line.isCompleted ? (
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-900 leading-relaxed font-medium flex-1">
                          {line.translation}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-400 italic flex-1">
                          Not yet translated
                        </p>
                      </div>
                    )}
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
        </div>

        {/* Footer Summary */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div>
              {completedCount === totalLines ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <Check className="w-4 h-4" />
                  Translation complete!
                </span>
              ) : (
                <span>
                  {totalLines - completedCount} line
                  {totalLines - completedCount !== 1 ? "s" : ""} remaining
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
