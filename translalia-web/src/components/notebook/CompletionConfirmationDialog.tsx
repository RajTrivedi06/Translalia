"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompletionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  poemPreview: string;
  totalLines: number;
}

export function CompletionConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  poemPreview,
  totalLines,
}: CompletionConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                All Lines Completed!
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                You've translated all {totalLines} lines of your poem
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Question */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-base font-semibold text-gray-900 mb-1">
              Are you done working on the poem?
            </p>
            <p className="text-sm text-gray-600">
              Review your complete translation below. If you're satisfied, click
              "Yes, I'm Done" to finalize your masterpiece.
            </p>
          </div>

          {/* Poem Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Your Complete Translation
              </h3>
              <span className="text-xs text-gray-500">
                {poemPreview.split("\n").filter(Boolean).length} lines
              </span>
            </div>
            <div
              className={cn(
                "rounded-lg border-2 border-gray-200 bg-white p-4",
                "max-h-[400px] overflow-y-auto",
                "font-serif text-base leading-relaxed"
              )}
            >
              <pre className="whitespace-pre-wrap text-gray-800 font-sans">
                {poemPreview || "No translation available"}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-3 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            Continue Editing
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Yes, I'm Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

