"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegenerateGuidanceDialog } from "./RegenerateGuidanceDialog";
import type { WordSuggestion } from "./AdditionalSuggestions";

type TokenSuggestionRangeMode = "focused" | "balanced" | "adventurous";

type TokenSuggestionOptions = {
  extraHints?: string[];
  suggestionRangeMode?: TokenSuggestionRangeMode;
};

interface TokenSuggestionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusLabel: string;
  suggestions: WordSuggestion[];
  isLoading: boolean;
  errorMessage?: string | null;
  onGenerate: (options?: TokenSuggestionOptions) => void;
  onRegenerate: (guidance: string, options?: TokenSuggestionOptions) => void;
  onWordClick: (word: string) => void;
}

export function TokenSuggestionsPopover({
  open,
  onOpenChange,
  focusLabel,
  suggestions,
  isLoading,
  errorMessage,
  onGenerate,
  onRegenerate,
  onWordClick,
}: TokenSuggestionsPopoverProps) {
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [extraHintDraft, setExtraHintDraft] = useState("");
  const [extraHints, setExtraHints] = useState<string[]>([]);
  const [rangeMode, setRangeMode] =
    useState<TokenSuggestionRangeMode>("balanced");
  const groupedSuggestions = React.useMemo(() => {
    const groups: Record<string, WordSuggestion[]> = {
      A: [],
      B: [],
      C: [],
      any: [],
    };
    suggestions.forEach((s) => {
      const key = s.fitsWith && groups[s.fitsWith] ? s.fitsWith : "any";
      groups[key].push(s);
    });
    return groups;
  }, [suggestions]);

  const handleRegenerate = (guidance: string) => {
    setShowRegenerateDialog(false);
    onRegenerate(guidance, {
      extraHints,
      suggestionRangeMode: rangeMode,
    });
  };

  useEffect(() => {
    if (!open) {
      setExtraHints([]);
      setExtraHintDraft("");
      setRangeMode("balanced");
    }
  }, [open]);

  const handleAddHint = () => {
    const next = extraHintDraft.trim();
    if (!next) return;
    if (extraHints.includes(next)) {
      setExtraHintDraft("");
      return;
    }
    if (extraHints.length >= 5) return;
    setExtraHints((prev) => [...prev, next]);
    setExtraHintDraft("");
  };

  const handleHintKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddHint();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Word ideas</DialogTitle>
            <DialogDescription>
              Tap a suggestion to use it in your line.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Focus word
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
                {focusLabel}
              </span>
            </div>

            <div className="rounded-lg border bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Extra hints (optional)
                  </p>
                  <p className="text-xs text-slate-500">
                    Add a few vibes or rules to guide the suggestions.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500">
                  Up to 5
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {extraHints.length === 0 ? (
                  <span className="text-xs text-slate-400">
                    No extra hints yet.
                  </span>
                ) : (
                  extraHints.map((hint, index) => (
                    <span
                      key={`${hint}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                    >
                      {hint}
                      <button
                        type="button"
                        onClick={() =>
                          setExtraHints((prev) =>
                            prev.filter((_, idx) => idx !== index)
                          )
                        }
                        className="text-slate-400 hover:text-slate-600"
                        aria-label="Remove hint"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={extraHintDraft}
                  onChange={(event) => setExtraHintDraft(event.target.value)}
                  onKeyDown={handleHintKeyDown}
                  placeholder="e.g. playful, rhyme with “moon”, use verbs"
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddHint}
                  disabled={
                    !extraHintDraft.trim() || extraHints.length >= 5 || isLoading
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Style range
                </p>
                <p className="text-xs text-slate-500">
                  Pick how bold the ideas should feel.
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {(["focused", "balanced", "adventurous"] as const).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRangeMode(mode)}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold",
                        "transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                        rangeMode === mode
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                      aria-pressed={rangeMode === mode}
                    >
                      {mode === "focused" && "Focused"}
                      {mode === "balanced" && "Balanced"}
                      {mode === "adventurous" && "Adventurous"}
                    </button>
                  )
                )}
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {rangeMode === "focused" &&
                  "Stays closer to the current meaning and style."}
                {rangeMode === "balanced" &&
                  "A mix of safe and fresh options."}
                {rangeMode === "adventurous" &&
                  "More playful and unexpected word choices."}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Generating suggestions...
              </div>
            ) : errorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {errorMessage}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No suggestions yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Try generating a fresh set of word ideas.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onGenerate({ extraHints, suggestionRangeMode: rangeMode })
                  }
                  className="mt-3"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Get suggestions
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(["A", "B", "C", "any"] as const).map((groupKey) => {
                  const groupItems = groupedSuggestions[groupKey];
                  if (groupItems.length === 0) return null;
                  return (
                    <div
                      key={groupKey}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                    >
                      {groupKey !== "any" && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          Fits with
                          <Badge variant="outline" className="text-[10px]">
                            {groupKey}
                          </Badge>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {groupItems.map((suggestion, index) => (
                          <button
                            key={`${suggestion.word}-${groupKey}-${index}`}
                            type="button"
                            onClick={() => onWordClick(suggestion.word)}
                            className={cn(
                              "flex flex-col items-start gap-1 px-3 py-2 text-left",
                              "rounded-lg border border-gray-200",
                              "bg-white hover:bg-gray-50",
                              "hover:border-gray-300 hover:shadow-sm",
                              "transition-all duration-150",
                              "text-sm cursor-pointer group"
                            )}
                            title={suggestion.reasoning || undefined}
                          >
                            {suggestion.fitsWith &&
                              suggestion.fitsWith !== "any" && (
                                <Badge variant="outline" className="text-[10px]">
                                  {suggestion.fitsWith}
                                </Badge>
                              )}
                            <span className="font-medium text-slate-900">
                              {suggestion.word}
                            </span>
                            {suggestion.reasoning && (
                              <span className="text-[11px] text-slate-500">
                                {suggestion.reasoning}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onGenerate({ extraHints, suggestionRangeMode: rangeMode })
              }
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRegenerateDialog(true)}
              disabled={isLoading || suggestions.length === 0}
            >
              Refine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegenerateGuidanceDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        onRegenerate={handleRegenerate}
        isLoading={isLoading}
      />
    </>
  );
}
