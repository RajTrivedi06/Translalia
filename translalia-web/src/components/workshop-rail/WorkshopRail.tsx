"use client";

import * as React from "react";
import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { WorkshopHeader } from "@/components/workshop-rail/WorkshopHeader";
import { LineSelector } from "@/components/workshop-rail/LineSelector";
import { WordGrid } from "@/components/workshop-rail/WordGrid";
import { CompilationFooter } from "@/components/workshop-rail/CompilationFooter";

export function WorkshopRail() {
  const threadId = useThreadId();
  const poem = useGuideStore((s) => s.poem);
  const guideStep = useGuideStore((s) => s.currentStep);
  const { selectedLineIndex, poemLines, setPoemLines, reset } = useWorkshopStore();

  // Reset workshop when Guide Rail returns to setup state
  React.useEffect(() => {
    if (guideStep === "setup" && poemLines.length > 0) {
      console.log("[WorkshopRail] Guide returned to setup, clearing workshop");
      reset();
    }
  }, [guideStep, poemLines.length, reset]);

  React.useEffect(() => {
    console.log("[WorkshopRail] Poem text changed:", {
      hasPoemText: !!poem.text,
      poemLength: poem.text?.length,
      currentPoemLines: poemLines.length,
      preserveFormatting: poem.preserveFormatting,
    });

    if (poem.text) {
      // Respect preserveFormatting flag for line splitting
      const preserveFormatting = poem.preserveFormatting ?? false;
      const lines = preserveFormatting
        ? poem.text.split("\n") // Keep ALL lines including blank ones
        : poem.text
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean); // Old behavior: collapse blanks
      console.log("[WorkshopRail] Setting poem lines:", {
        count: lines.length,
        preserveFormatting,
        lines,
      });
      setPoemLines(lines);
    } else if (!poem.text && poemLines.length > 0) {
      // Clear workshop if poem is cleared
      console.log("[WorkshopRail] Poem cleared, resetting workshop");
      reset();
    }
  }, [poem.text, poem.preserveFormatting, setPoemLines, poemLines.length, reset]);

  console.log("[WorkshopRail] Render:", {
    poemLinesCount: poemLines.length,
    selectedLineIndex,
    threadId,
  });

  // Show welcome message if no poem lines
  if (!poemLines || poemLines.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <WorkshopHeader />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No Poem Loaded
            </h3>
            <p className="text-sm text-gray-500">
              Complete the Guide Rail on the left to analyze a poem and start translating.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <WorkshopHeader />

      <div className="flex-1 overflow-y-auto">
        {selectedLineIndex === null ? (
          <LineSelector poemLines={poemLines} />
        ) : (
          <WordGrid threadId={threadId || undefined} />
        )}
      </div>

      {selectedLineIndex !== null ? <CompilationFooter /> : null}
    </div>
  );
}
