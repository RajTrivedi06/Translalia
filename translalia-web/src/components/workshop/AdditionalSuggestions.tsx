"use client";

import React, { useState } from "react";
import { RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RegenerateGuidanceDialog } from "./RegenerateGuidanceDialog";

export interface WordSuggestion {
  word: string;
  reasoning?: string;
  register?: string;
  literalness?: number;
  use?: "replace" | "insert" | "opening" | "closing";
  fitsWith?: "A" | "B" | "C" | "any";
}

interface AdditionalSuggestionsProps {
  suggestions: WordSuggestion[];
  isLoading: boolean;
  errorMessage?: string | null;
  onGenerate: () => void;
  onRegenerate: (guidance: string) => void;
  onWordClick: (word: string) => void;
}

export function AdditionalSuggestions({
  suggestions,
  isLoading,
  errorMessage,
  onGenerate,
  onRegenerate,
  onWordClick,
}: AdditionalSuggestionsProps) {
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
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
    onRegenerate(guidance);
  };

  if (suggestions.length === 0 && !isLoading) {
    return (
      <div className="border-t border-gray-200 pt-4 mt-4">
        {errorMessage && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {errorMessage}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Get More Suggestions
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Get more suggestions for the whole segment (or right-click on a word to see more possible translations of that word)
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-gray-200 pt-4 mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="space-y-2 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Generating suggestions...
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {errorMessage}
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">More Suggestions</span>
                <Badge variant="secondary" className="text-xs">
                  {suggestions.length}
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRegenerateDialog(true)}
                disabled={isLoading}
                className="h-7 text-xs"
              >
                <RefreshCw
                  className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")}
                />
                Refine
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Click any word to add it to your notebook. These suggestions
                consider the surrounding lines for better flow.
              </p>
            </div>

            <div className="space-y-3">
              {(["A", "B", "C", "any"] as const).map((groupKey) => {
                const groupItems = groupedSuggestions[groupKey];
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupKey} className="space-y-2">
                    {groupKey !== "any" && (
                      <div className="text-xs font-semibold text-slate-600">
                        Fits with {groupKey}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {groupItems.map((suggestion, index) => (
                        <button
                          key={`${suggestion.word}-${groupKey}-${index}`}
                          type="button"
                          onClick={() => onWordClick(suggestion.word)}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-2",
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
                          <span className="font-medium">{suggestion.word}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                View reasoning for suggestions
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.word}-reason-${index}`}
                    className="p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <span className="font-medium">{suggestion.word}</span>
                    {suggestion.reasoning && (
                      <span className="text-muted-foreground">
                        : {suggestion.reasoning}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : null}
      </div>

      <RegenerateGuidanceDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        onRegenerate={handleRegenerate}
        isLoading={isLoading}
      />
    </>
  );
}
