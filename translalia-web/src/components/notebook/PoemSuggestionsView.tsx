"use client";

import React from "react";
import { PoemSuggestionsPanel } from "./PoemSuggestionsPanel";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useGuideStore } from "@/store/guideSlice";
import { useThreadId } from "@/hooks/useThreadId";

export function PoemSuggestionsView() {
  const completedLines = useWorkshopStore((state) => state.completedLines);
  const completedCount = Object.keys(completedLines).length;
  const poemLines = useWorkshopStore((state) => state.poemLines);
  const threadId = useThreadId();
  const poem = useGuideStore((s) => s.poem);
  const guideAnswers = useGuideStore((s) => s.answers);

  // Get translation from completed lines
  const translationPoem = poemLines
    .map((_, idx) => completedLines[idx] || "")
    .join("\n");

  if (completedCount === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2 text-muted-foreground max-w-md">
          <p className="text-base font-medium">
            Complete at least one line to get suggestions
          </p>
          <p className="text-sm">
            Switch back to Notebook view to continue translating
          </p>
        </div>
      </div>
    );
  }

  if (!threadId || !poem.text) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2 text-muted-foreground">
          <p>Loading suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <PoemSuggestionsPanel
        threadId={threadId}
        sourcePoem={poem.text}
        translationPoem={translationPoem}
        guideAnswers={guideAnswers as Record<string, unknown>}
        layout="full"
        showCloseButton={false}
      />
    </div>
  );
}
