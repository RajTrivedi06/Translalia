"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, FileText } from "lucide-react";

export interface FinalizeLineDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** Line index being finalized */
  lineIndex: number;
  /** Source line text */
  sourceText: string;
  /** Translation text */
  translationText: string;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Optional: Show warning if translation seems incomplete */
  showWarning?: boolean;
}

/**
 * FinalizeLineDialog - Confirmation dialog for finalizing a translation line
 *
 * Shows:
 * - Source line
 * - Translation
 * - Confirmation prompt
 * - Warning if translation seems incomplete
 *
 * Features:
 * - Compare source and translation side-by-side
 * - Warn if translation is very short or empty
 * - Allow user to go back and edit
 * - Keyboard shortcuts (Enter to confirm, Esc to cancel)
 */
export function FinalizeLineDialog({
  open,
  onOpenChange,
  lineIndex,
  sourceText,
  translationText,
  onConfirm,
  showWarning = false,
}: FinalizeLineDialogProps) {
  const hasTranslation = translationText.trim().length > 0;
  const isTooShort = translationText.trim().split(/\s+/).length < 2;

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
      if (e.key === "Enter" && hasTranslation) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasTranslation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            Save Line {lineIndex + 1}?
          </DialogTitle>
          <DialogDescription>
            This will save your translation and move to the next line. You can
            still edit it later if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Line */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FileText className="w-3 h-3" />
              <span>Source Line</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-900">{sourceText}</p>
            </div>
          </div>

          {/* Translation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Check className="w-3 h-3" />
              <span>Your Translation</span>
            </div>
            <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-900 font-medium">
                {hasTranslation ? translationText : "(No translation)"}
              </p>
            </div>
          </div>

          {/* Warning Messages */}
          {showWarning && hasTranslation && isTooShort && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium">Translation seems short</p>
                <p className="mt-1">
                  Your translation appears shorter than expected. Please review
                  before saving.
                </p>
              </div>
            </div>
          )}

          {!hasTranslation && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium">No translation provided</p>
                <p className="mt-1">
                  You haven't provided a translation for this line. Saving
                  will mark it as skipped.
                </p>
              </div>
            </div>
          )}

          {/* Status Badge */}
          {hasTranslation && (
            <div className="flex items-center justify-center">
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Ready to save
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Go Back & Edit
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasTranslation}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirm Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
