"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { Button } from "@/components/ui/button";
import { useSaveLine } from "@/lib/hooks/useWorkshopFlow";
import { useThreadId } from "@/hooks/useThreadId";
import { useQueryClient } from "@tanstack/react-query";
import { qkNotebookCells } from "@/lib/queryKeys";
import { Check } from "lucide-react";

interface CompilationFooterProps {
  /** Lines in the current stanza/segment */
  stanzaLines?: string[];
  /** Global line offset for the current stanza */
  globalLineOffset?: number;
  /** Callback to deselect line and return to line selector */
  onReturnToLineSelector?: () => void;
}

export function CompilationFooter({
  stanzaLines,
  globalLineOffset = 0,
  onReturnToLineSelector,
}: CompilationFooterProps) {
  const queryClient = useQueryClient();
  const threadId = useThreadId() || undefined;
  const selectedLineIndex = useWorkshopStore((s) => s.selectedLineIndex)!;
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);
  const selectedVariant = useWorkshopStore((s) => s.selectedVariant);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);
  const selectLine = useWorkshopStore((s) => s.selectLine);
  const deselectLine = useWorkshopStore((s) => s.deselectLine);

  const [showSuccess, setShowSuccess] = React.useState(false);

  // Check if using new line translation format
  const currentLineTranslation =
    selectedLineIndex !== null ? lineTranslations[selectedLineIndex] : null;
  const currentSelectedVariant =
    selectedLineIndex !== null ? selectedVariant[selectedLineIndex] : null;

  // Compiled line comes from the selected variant (line-level only)
  const compiledLine = React.useMemo(() => {
    if (!currentLineTranslation || !currentSelectedVariant) return "";
    const variant = currentLineTranslation.translations.find(
      (v) => v.variant === currentSelectedVariant
    );
    return variant?.fullText || "";
  }, [currentLineTranslation, currentSelectedVariant]);

  // Complete when a variant is selected for this line
  const isComplete = React.useMemo(() => {
    return !!(currentLineTranslation && currentSelectedVariant);
  }, [currentLineTranslation, currentSelectedVariant]);

  const { mutate: saveLine, isPending } = useSaveLine();

  function apply() {
    if (!threadId) return;

    if (!currentLineTranslation || !currentSelectedVariant) return;

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

          // Show success feedback
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);

          // Auto-advance to next line after showing success message
          if (stanzaLines && selectedLineIndex !== null) {
            // Calculate next line index within the current stanza
            const currentIndexInStanza = selectedLineIndex - globalLineOffset;
            const nextIndexInStanza = currentIndexInStanza + 1;

            setTimeout(() => {
              if (nextIndexInStanza < stanzaLines.length) {
                // There's a next line in this stanza - select it
                const nextGlobalIndex = globalLineOffset + nextIndexInStanza;
                selectLine(nextGlobalIndex);
              } else {
                // Last line in stanza - return to line selector
                if (onReturnToLineSelector) {
                  onReturnToLineSelector();
                } else {
                  deselectLine();
                }
              }
            }, 1500); // Show success message for 1.5s before advancing
          }
        },
      }
    );
  }

  return (
    <div className="border-t bg-white p-3">
      <div className="text-sm mb-2">
        {compiledLine || "Select a variant to build a line…"}
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
            if (selectedLineIndex !== null) {
              useWorkshopStore
                .getState()
                .selectVariant(selectedLineIndex, null);
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
