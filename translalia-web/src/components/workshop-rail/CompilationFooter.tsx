"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { Button } from "@/components/ui/button";
import { useSaveLine } from "@/lib/hooks/useWorkshopFlow";
import { useThreadId } from "@/hooks/useThreadId";
import { useQueryClient } from "@tanstack/react-query";
import { qkNotebookCells } from "@/lib/queryKeys";
import { Check } from "lucide-react";

export function CompilationFooter() {
  const queryClient = useQueryClient();
  const threadId = useThreadId() || undefined;
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex)!;
  const wordOptions = useWorkshopStore((s) => s.wordOptions) || [];
  const selections = useWorkshopStore((s) => s.selections);
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const clearSelections = useWorkshopStore((s) => s.clearSelections);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);

  const [showSuccess, setShowSuccess] = React.useState(false);

  // Check if using new line translation format
  const currentLineTranslation =
    selectedLineIndex !== null ? lineTranslations[selectedLineIndex] : null;
  const currentSelectedVariant =
    selectedLineIndex !== null ? selectedVariant[selectedLineIndex] : null;

  // Get compiled line: either from selected variant or from word selections
  const compiledLine = React.useMemo(() => {
    if (currentLineTranslation && currentSelectedVariant) {
      const variant = currentLineTranslation.translations.find(
        (v) => v.variant === currentSelectedVariant
      );
      return variant?.fullText || "";
    }
    // Fall back to old word selection assembly
    return Object.keys(selections)
      .sort((a, b) => Number(a) - Number(b))
      .map((pos) => selections[Number(pos)])
      .join(" ");
  }, [currentLineTranslation, currentSelectedVariant, selections]);

  // Check if complete: either variant selected or all words selected
  const isComplete = React.useMemo(() => {
    if (currentLineTranslation && currentSelectedVariant) {
      return true;
    }
    // Old workflow: check if all words are selected
    return wordOptions?.every((_, i) => selections[i]);
  }, [currentLineTranslation, currentSelectedVariant, wordOptions, selections]);

  const { mutate: saveLine, isPending } = useSaveLine();

  function apply() {
    if (!threadId) return;

    // Use new format if line translation is available
    if (currentLineTranslation && currentSelectedVariant) {
      const variant = currentLineTranslation.translations.find(
        (v) => v.variant === currentSelectedVariant
      );
      if (!variant) return;

      saveLine(
        {
          threadId,
          lineIndex: selectedLineIndex,
          originalLine: poemLines[selectedLineIndex],
          variant: currentSelectedVariant,
          lineTranslation: currentLineTranslation,
        },
        {
          onSuccess: (res) => {
            // Update workshop store
            setCompletedLine(res.lineIndex, res.translatedLine);

            // Optimistic UI update: patch notebook cells cache
            queryClient.setQueryData(
              qkNotebookCells(threadId),
              (
                prev:
                  | {
                      cells?: Array<{
                        lineIndex: number;
                        translation?: {
                          text?: string;
                          status?: string;
                          lockedWords?: number[];
                        };
                      }>;
                    }
                  | undefined
              ) => {
                if (!prev?.cells) return prev;
                return {
                  ...prev,
                  cells: prev.cells.map((c) =>
                    c.lineIndex === res.lineIndex
                      ? {
                          ...c,
                          translation: {
                            ...(c.translation ?? {}),
                            text: res.translatedLine,
                            status: c.translation?.status ?? "draft",
                            lockedWords: c.translation?.lockedWords ?? [],
                          },
                        }
                      : c
                  ),
                };
              }
            );

            // Authoritative refetch
            queryClient.invalidateQueries({
              queryKey: qkNotebookCells(threadId),
              exact: true,
            });

            // Clear selections (for old workflow)
            clearSelections();

            // Show success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
          },
        }
      );
    } else {
      // Old workflow: use word selections
      const payload = Object.entries(selections).map(
        ([position, selectedWord]) => ({
          position: Number(position),
          selectedWord,
        })
      );

      saveLine(
        {
          threadId,
          lineIndex: selectedLineIndex,
          originalLine: poemLines[selectedLineIndex],
          selections: payload,
          wordOptions: wordOptions ?? undefined,
        },
        {
          onSuccess: (res) => {
            // Update workshop store
            setCompletedLine(res.lineIndex, res.translatedLine);

            // Optimistic UI update: patch notebook cells cache
            queryClient.setQueryData(
              qkNotebookCells(threadId),
              (
                prev:
                  | {
                      cells?: Array<{
                        lineIndex: number;
                        translation?: {
                          text?: string;
                          status?: string;
                          lockedWords?: number[];
                        };
                      }>;
                    }
                  | undefined
              ) => {
                if (!prev?.cells) return prev;
                return {
                  ...prev,
                  cells: prev.cells.map((c) =>
                    c.lineIndex === res.lineIndex
                      ? {
                          ...c,
                          translation: {
                            ...(c.translation ?? {}),
                            text: res.translatedLine,
                            status: c.translation?.status ?? "draft",
                            lockedWords: c.translation?.lockedWords ?? [],
                          },
                        }
                      : c
                  ),
                };
              }
            );

            // Authoritative refetch
            queryClient.invalidateQueries({
              queryKey: qkNotebookCells(threadId),
              exact: true,
            });

            // Clear selections
            clearSelections();

            // Show success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
          },
        }
      );
    }
  }

  return (
    <div className="border-t bg-white p-3">
      <div className="text-sm mb-2">
        {compiledLine || "Select words to build a line…"}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={apply} disabled={!isComplete || isPending}>
          {showSuccess ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Applied!
            </>
          ) : (
            "Apply to Notebook"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (currentLineTranslation && currentSelectedVariant) {
              // Clear variant selection for new workflow
              if (selectedLineIndex !== null) {
                useWorkshopStore
                  .getState()
                  .selectVariant(selectedLineIndex, null);
              }
            } else {
              // Clear word selections for old workflow
              clearSelections();
            }
          }}
          disabled={isPending}
        >
          Clear Selection
        </Button>
      </div>
      {showSuccess && (
        <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          Line saved to Notebook
        </div>
      )}
    </div>
  );
}
