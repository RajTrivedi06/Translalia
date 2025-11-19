"use client";

import React from "react";
import { usePoetryMacroCritique } from "@/lib/hooks/usePoetryMacroCritique";
import type {
  PoetryMacroCritiqueResponse,
  PoemSuggestion,
  PoemSuggestionOption,
} from "@/types/poemSuggestion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface PoemSuggestionsPanelProps {
  threadId: string;
  sourcePoem: string;
  translationPoem: string;
  guideAnswers?: Record<string, unknown>;
  onClose: () => void;
}

/**
 * PoemSuggestionsPanel
 *
 * Displays macro-level suggestions for the student's translation
 * after they've completed line-by-line work in the Workshop phase.
 *
 * Shows suggestions for:
 * - Rhyme strategy
 * - Tone & register
 * - Meaning expansion
 * - Rhythm & meter
 * - Imagery & style
 * - Form & structure
 */
export function PoemSuggestionsPanel({
  threadId,
  sourcePoem,
  translationPoem,
  guideAnswers,
  onClose,
}: PoemSuggestionsPanelProps) {
  const [expandedSuggestions, setExpandedSuggestions] = React.useState<
    Set<string>
  >(new Set());
  const [selectedOption, setSelectedOption] = React.useState<string | null>(
    null
  );

  const critiqueMutation = usePoetryMacroCritique();

  // Auto-fetch suggestions when component mounts
  React.useEffect(() => {
    critiqueMutation.mutate({
      threadId,
      sourcePoem,
      translationPoem,
      guideAnswers,
    });
  }, []);

  const toggleSuggestion = (suggestionId: string) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  };

  const data = critiqueMutation.data;
  const isLoading = critiqueMutation.isPending;
  const error = critiqueMutation.error;

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Exploring Your Translation</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Sparkles className="w-8 h-8 mx-auto text-blue-500 animate-spin mb-3" />
            <p className="text-gray-600">
              Analyzing your translation...
            </p>
            <p className="text-xs text-gray-500 mt-1">
              We're looking at rhyme, tone, imagery, and more
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Exploring Your Translation</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-medium mb-1">Failed to generate suggestions</p>
          <p className="text-xs">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => critiqueMutation.mutate({
              threadId,
              sourcePoem,
              translationPoem,
              guideAnswers,
            })}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const applicableSuggestions = data.suggestions.filter(
    (s) => s.isApplicable
  );

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Ideas to Explore
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Overall observations */}
        {data.overallObservations && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed">
              {data.overallObservations}
            </p>
          </div>
        )}

        {/* Suggestions */}
        <div className="space-y-3">
          {applicableSuggestions.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              No suggestions at this time. Your translation is complete!
            </p>
          ) : (
            applicableSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isExpanded={expandedSuggestions.has(suggestion.id)}
                onToggle={() => toggleSuggestion(suggestion.id)}
                onSelectOption={(optionId) => setSelectedOption(optionId)}
                isOptionSelected={selectedOption?.startsWith(suggestion.id) ?? false}
              />
            ))
          )}
        </div>

        {/* Student prompts */}
        {data.studentPromptsToConsider &&
          data.studentPromptsToConsider.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-sm text-amber-900 mb-3">
                Reflective Questions
              </h4>
              <ul className="space-y-2">
                {data.studentPromptsToConsider.map((prompt, idx) => (
                  <li key={idx} className="text-sm text-amber-800 leading-relaxed">
                    <span className="font-medium">{idx + 1}.</span> {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex-shrink-0">
        <p className="text-xs text-gray-600 text-center">
          These are suggestions to explore, not requirements. Choose what feels
          right for your translation.
        </p>
      </div>
    </div>
  );
}

/**
 * SuggestionCard - Displays a single suggestion with expandable options
 */
interface SuggestionCardProps {
  suggestion: PoemSuggestion;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectOption: (optionId: string) => void;
  isOptionSelected: boolean;
}

function SuggestionCard({
  suggestion,
  isExpanded,
  onToggle,
  onSelectOption,
  isOptionSelected,
}: SuggestionCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Badge
            variant={
              isOptionSelected ? "default" : "secondary"
            }
            className="text-xs"
          >
            {suggestion.categoryLabel}
          </Badge>
          <p className="font-medium text-gray-800 text-sm">
            {suggestion.sourceAnalysis}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
          {/* Your translation analysis */}
          <div className="p-3 bg-white rounded border border-gray-200">
            <h5 className="text-xs font-semibold text-gray-700 mb-1">
              In Your Translation
            </h5>
            <p className="text-sm text-gray-700">{suggestion.yourTranslation}</p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {suggestion.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                suggestionId={suggestion.id}
                onSelect={() => onSelectOption(`${suggestion.id}-${option.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * OptionCard - Displays a single option within a suggestion
 */
interface OptionCardProps {
  option: PoemSuggestionOption;
  suggestionId: string;
  onSelect: () => void;
}

function OptionCard({ option, suggestionId, onSelect }: OptionCardProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const difficultyColor = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    challenging: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-3 bg-white rounded border border-gray-200 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h6 className="font-medium text-sm text-gray-800">
            {option.title}
          </h6>
          <p className="text-xs text-gray-600 mt-1">{option.description}</p>
        </div>
        <Badge
          className={`text-xs flex-shrink-0 ${
            difficultyColor[option.difficulty]
          }`}
          variant="secondary"
        >
          {option.difficulty}
        </Badge>
      </div>

      {showDetails && (
        <div className="pt-2 border-t border-gray-200 space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Why?</p>
            <p className="text-xs text-gray-600">{option.rationale}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Try This</p>
            <p className="text-xs text-gray-600">{option.action}</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
      >
        {showDetails ? "Hide" : "Show"} Details
      </button>
    </div>
  );
}
