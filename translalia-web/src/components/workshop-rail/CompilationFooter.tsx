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
  const clearSelections = useWorkshopStore((s) => s.clearSelections);
  const setCompletedLine = useWorkshopStore((s) => s.setCompletedLine);

  const [showSuccess, setShowSuccess] = React.useState(false);

  const compiledLine = Object.keys(selections)
    .sort((a, b) => Number(a) - Number(b))
    .map((pos) => selections[Number(pos)])
    .join(" ");

  const isComplete = wordOptions?.every((_, i) => selections[i]);

  const { mutate: saveLine, isPending } = useSaveLine();

  function apply() {
    if (!threadId) return;
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
          onClick={clearSelections}
          disabled={isPending}
        >
          Clear Selections
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
