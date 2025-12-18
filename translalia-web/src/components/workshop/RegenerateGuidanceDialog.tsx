"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";

interface RegenerateGuidanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: (guidance: string) => void;
  isLoading?: boolean;
}

export function RegenerateGuidanceDialog({
  open,
  onOpenChange,
  onRegenerate,
  isLoading = false,
}: RegenerateGuidanceDialogProps) {
  const [guidance, setGuidance] = useState("");

  const handleSubmit = () => {
    if (guidance.trim()) {
      onRegenerate(guidance.trim());
      setGuidance("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Refine Suggestions
          </DialogTitle>
          <DialogDescription>
            Tell the AI how to improve the word suggestions. Be specific!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Examples:
• Make them more archaic
• Focus on internal rhyme
• Use more metaphorical language
• Suggest verbs instead of nouns
• Make them more colloquial"
            className="min-h-[120px] resize-none"
            autoFocus
          />

          <div className="text-xs text-muted-foreground">
            Tip: Press Cmd/Ctrl + Enter to regenerate
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!guidance.trim() || isLoading}
          >
            {isLoading ? "Regenerating..." : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
