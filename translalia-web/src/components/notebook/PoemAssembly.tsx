"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import {
  FileText,
  Download,
  Copy,
  Check,
  Edit2,
  AlertCircle,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PoemAssemblyProps {
  /** Optional: Callback when a line is clicked for editing */
  onEditLine?: (lineIndex: number) => void;
  /** Optional: Show source poem alongside translation */
  showSource?: boolean;
  /** Optional: Enable copy/export actions */
  enableActions?: boolean;
}

/**
 * PoemAssembly - Display and manage the assembled translated poem
 *
 * Features:
 * - Shows all lines with completion status
 * - Side-by-side source and translation view
 * - Click to edit any line
 * - Copy to clipboard
 * - Export functionality
 * - Visual indicators for missing lines
 * - Auto-save on changes
 */
export function PoemAssembly({
  onEditLine,
  showSource = true,
  enableActions = true,
}: PoemAssemblyProps) {
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const selectLine = useWorkshopStore((s) => s.selectLine);
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

  const totalLines = poemLines.length;
  const completedCount = Object.keys(completedLines).length;
  const isComplete = completedCount === totalLines;
  const missingLines = poemLines
    .map((_, idx) => idx)
    .filter((idx) => !completedLines[idx]);

  // Assemble complete poem text
  const assembledPoem = React.useMemo(() => {
    return poemLines
      .map((_, idx) => completedLines[idx] || "[Not yet translated]")
      .join("\n");
  }, [poemLines, completedLines]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(assembledPoem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExport = () => {
    // Create a formatted export with metadata
    const targetLang =
      targetLanguageName ||
      (translationIntent ? "As described in translation intent" : "Unknown");
    const intentSection = translationIntent
      ? `Intent: ${translationIntent}\n\n`
      : "";
    const exportText = `Translation to ${targetLang}\n${intentSection}${"=".repeat(
      50
    )}\n\n${assembledPoem}\n\n${"=".repeat(
      50
    )}\nSource Text:\n\n${poemLines.join("\n")}`;

    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translation-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // Create a print-friendly version
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the translation");
      return;
    }

    const targetLang =
      targetLanguageName ||
      (translationIntent ? "As described in translation intent" : "Unknown");
    const targetVariety = targetVarietyName;
    const translator = guideAnswers.audience?.audience || "";
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
          <title>Translation - ${targetLang}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              body { margin: 0; padding: 20mm; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
            }
            body {
              font-family: 'Georgia', 'Times New Roman', serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 8px;
              color: #1a1a1a;
            }
            .meta {
              font-size: 12px;
              color: #666;
              margin-bottom: 32px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 16px;
            }
            .poem-section {
              margin-bottom: 40px;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
            }
            .poem-line {
              margin-bottom: 12px;
              line-height: 1.8;
            }
            .line-number {
              display: inline-block;
              width: 30px;
              color: #999;
              font-size: 11px;
            }
            .source-line {
              font-style: italic;
              color: #666;
            }
            .translation-line {
              color: #1a1a1a;
            }
            .missing-line {
              color: #999;
              font-style: italic;
            }
            @media screen {
              .no-print {
                position: sticky;
                top: 0;
                background: white;
                padding: 16px;
                border-bottom: 1px solid #ddd;
                margin: -40px -40px 40px -40px;
                text-align: center;
              }
              .no-print button {
                background: #4f46e5;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              }
              .no-print button:hover {
                background: #4338ca;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">Print / Save as PDF</button>
            <button onclick="window.close()" style="background: #6b7280; margin-left: 8px;">Close</button>
          </div>

          <h1>Translation to ${targetLang}${
      targetVariety ? ` (${targetVariety})` : ""
    }</h1>
          <div class="meta">
            <div>Date: ${new Date().toLocaleDateString()}</div>
            ${translationIntent ? `<div>Intent: ${safeIntentHtml}</div>` : ""}
            ${translator ? `<div>Audience: ${translator}</div>` : ""}
            <div>Lines: ${completedCount}/${totalLines} completed</div>
          </div>

          <div class="poem-section">
            <div class="section-title">Translation</div>
            ${poemLines
              .map((_, idx) => {
                const translation = completedLines[idx];
                return `<div class="poem-line">
                  <span class="line-number">${idx + 1}.</span>
                  <span class="${
                    translation ? "translation-line" : "missing-line"
                  }">
                    ${translation || "[Not yet translated]"}
                  </span>
                </div>`;
              })
              .join("")}
          </div>

          <div class="page-break"></div>

          <div class="poem-section">
            <div class="section-title">Source Text</div>
            ${poemLines
              .map(
                (line, idx) => `<div class="poem-line">
                <span class="line-number">${idx + 1}.</span>
                <span class="source-line">${line}</span>
              </div>`
              )
              .join("")}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleEditLine = (lineIndex: number) => {
    selectLine(lineIndex);
    onEditLine?.(lineIndex);
  };

  if (totalLines === 0) {
    return (
      <Card className="p-6 text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 className="font-medium text-gray-900 mb-2">No Poem Loaded</h3>
        <p className="text-sm text-gray-600">
          Start by loading a poem in the Guide Rail to begin translation.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Assembled Translation
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {completedCount} of {totalLines} lines completed
          </p>
          {translationIntent && (
            <p className="text-xs text-gray-500 mt-1 max-w-prose">
              {translationIntent}
            </p>
          )}
        </div>

        {/* Actions */}
        {enableActions && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={completedCount === 0}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={completedCount === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={completedCount === 0}
              title="Print or save as PDF"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print/PDF
            </Button>
          </div>
        )}
      </div>

      {/* Completion Status */}
      {!isComplete && missingLines.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium">
              {missingLines.length} line{missingLines.length !== 1 ? "s" : ""}{" "}
              remaining
            </p>
            <p className="mt-1">
              Lines {missingLines.map((i) => i + 1).join(", ")} still need
              translation.
            </p>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            Translation complete!
          </span>
        </div>
      )}

      {/* Poem Display */}
      <div className="grid grid-cols-1 gap-4">
        {showSource ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Source Column */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 sticky top-0 bg-white pb-2">
                Source Text
              </h4>
              {poemLines.map((line, idx) => (
                <div
                  key={`source-${idx}`}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    Line {idx + 1}
                  </div>
                  <p className="text-sm text-gray-900">{line}</p>
                </div>
              ))}
            </div>

            {/* Translation Column */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 sticky top-0 bg-white pb-2">
                Translation
              </h4>
              {poemLines.map((_, idx) => {
                const translation = completedLines[idx];
                const hasTranslation = !!translation;

                return (
                  <button
                    key={`translation-${idx}`}
                    onClick={() => handleEditLine(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded border transition-all group",
                      hasTranslation
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:shadow-md"
                        : "bg-white border-gray-300 border-dashed hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">
                        Line {idx + 1}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasTranslation ? (
                          <Badge className="text-xs bg-green-100 text-green-700">
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                        <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        hasTranslation
                          ? "text-gray-900 font-medium"
                          : "text-gray-400 italic"
                      )}
                    >
                      {translation || "Click to translate..."}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          // Translation only view
          <div className="space-y-2">
            {poemLines.map((_, idx) => {
              const translation = completedLines[idx];
              const hasTranslation = !!translation;

              return (
                <button
                  key={`translation-${idx}`}
                  onClick={() => handleEditLine(idx)}
                  className={cn(
                    "w-full text-left p-4 rounded border transition-all group",
                    hasTranslation
                      ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:shadow-md"
                      : "bg-white border-gray-300 border-dashed hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-500">Line {idx + 1}</div>
                    <div className="flex items-center gap-1">
                      {hasTranslation ? (
                        <Badge className="text-xs bg-green-100 text-green-700">
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                      <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-base leading-relaxed",
                      hasTranslation
                        ? "text-gray-900 font-medium"
                        : "text-gray-400 italic"
                    )}
                  >
                    {translation || "Click to translate..."}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
