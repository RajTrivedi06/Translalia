"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  X,
  Check,
  Edit2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  User,
  FileText,
} from "lucide-react";
import { DragData } from "@/types/drag";
import { GuideAnswers } from "@/store/guideSlice";

export interface AIAssistantPanelProps {
  /** The words selected by the user for this cell */
  selectedWords: DragData[];
  /** The original source line text */
  sourceLineText: string;
  /** User's guide rail preferences */
  guideAnswers: GuideAnswers;
  /** Thread ID for API calls */
  threadId: string;
  /** Cell ID being assisted */
  cellId: string;
  /** Callback when suggestion is accepted */
  onApplySuggestion: (cellId: string, suggestion: string) => void;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Optional instruction type */
  instruction?: "refine" | "rephrase" | "expand" | "simplify";
}

type AssistMode = "write" | "assist";

interface AIError {
  type: "network" | "rate_limit" | "api_error" | "invalid_response";
  message: string;
  retryable: boolean;
}

interface AISuggestion {
  suggestion: string;
  confidence: number;
  reasoning?: string;
  alternatives?: string[];
}

export function AIAssistantPanel({
  selectedWords,
  sourceLineText,
  guideAnswers,
  threadId,
  cellId,
  onApplySuggestion,
  onClose,
  instruction = "refine",
}: AIAssistantPanelProps) {
  const [mode, setMode] = React.useState<AssistMode>("write");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AIError | null>(null);
  const [suggestion, setSuggestion] = React.useState<AISuggestion | null>(null);

  // User's current version (assembled words)
  const userVersion = selectedWords.map((w) => w.text).join(" ");

  // Fetch AI suggestion when mode changes to "assist"
  React.useEffect(() => {
    if (mode === "assist" && !suggestion && !loading) {
      fetchAISuggestion();
    }
  }, [mode]);

  const fetchAISuggestion = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/notebook/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          cellId,
          selectedWords,
          sourceLineText,
          instruction,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 429) {
          setError({
            type: "rate_limit",
            message: "Rate limit reached. Please wait a moment and try again.",
            retryable: true,
          });
        } else {
          setError({
            type: "api_error",
            message: data.error || "AI service error. Please try again.",
            retryable: true,
          });
        }
        return;
      }

      const data = await response.json();
      setSuggestion({
        suggestion: data.suggestion,
        confidence: data.confidence,
        reasoning: data.reasoning,
        alternatives: data.alternatives,
      });
    } catch (err) {
      console.error("[AIAssistantPanel] Error:", err);
      setError({
        type: "network",
        message: "Network error. Please check your connection and try again.",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setSuggestion(null);
    fetchAISuggestion();
  };

  const handleAccept = () => {
    if (suggestion) {
      onApplySuggestion(cellId, suggestion.suggestion);
      onClose();
    }
  };

  const handleReject = () => {
    setMode("write");
    setSuggestion(null);
    setError(null);
  };

  const handleModify = () => {
    if (suggestion) {
      // For now, just apply the suggestion and let user edit in the cell
      onApplySuggestion(cellId, suggestion.suggestion);
      onClose();
    }
  };

  const handleSelectAlternative = (alt: string) => {
    onApplySuggestion(cellId, alt);
    onClose();
  };

  return (
    <div className="bg-white border rounded-lg shadow-lg p-4 space-y-4 max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          AI Translation Assistant
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-2">
        <AIChoiceCard
          mode="write"
          selected={mode === "write"}
          onClick={() => setMode("write")}
        />
        <AIChoiceCard
          mode="assist"
          selected={mode === "assist"}
          onClick={() => setMode("assist")}
        />
      </div>

      {/* Your Words Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-700">Your Words:</h4>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-900">{userVersion}</p>
        </div>
      </div>

      {/* AI Assist Mode Content */}
      {mode === "assist" && (
        <>
          {/* Loading State */}
          {loading && <AILoadingState />}

          {/* Error State */}
          {error && (
            <AIErrorState
              error={error}
              onRetry={handleRetry}
              onWriteMyself={() => setMode("write")}
            />
          )}

          {/* Suggestion Display */}
          {suggestion && !loading && !error && (
            <>
              <AISuggestionDisplay
                suggestion={suggestion.suggestion}
                confidence={suggestion.confidence}
                reasoning={suggestion.reasoning}
                alternatives={suggestion.alternatives}
                onSelectAlternative={handleSelectAlternative}
              />

              {/* Comparison */}
              <TranslationComparison
                original={sourceLineText}
                userVersion={userVersion}
                aiSuggestion={suggestion.suggestion}
              />

              {/* Action Buttons */}
              <AISuggestionActions
                onAccept={handleAccept}
                onReject={handleReject}
                onModify={handleModify}
              />
            </>
          )}
        </>
      )}

      {/* Write Myself Mode Content */}
      {mode === "write" && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            You're in manual mode. Edit your translation directly in the cell,
            or switch to AI Assist for suggestions.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Choice Card Component - Write Myself vs AI Assist
 */
interface AIChoiceCardProps {
  mode: AssistMode;
  selected: boolean;
  onClick: () => void;
}

function AIChoiceCard({ mode, selected, onClick }: AIChoiceCardProps) {
  const isWrite = mode === "write";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className="text-2xl">{isWrite ? "✍️" : "🤖"}</div>
      <div className="flex-1">
        <h3 className="font-medium text-sm">
          {isWrite ? "Write Myself" : "AI Assist"}
        </h3>
        <p className="text-xs text-gray-500">
          {isWrite ? "Manual editing" : "AI suggestions"}
        </p>
      </div>
      {selected && <Check className="w-4 h-4 text-blue-600" />}
    </button>
  );
}

/**
 * Loading State Component
 */
function AILoadingState() {
  return (
    <div className="p-6 text-center space-y-3">
      <div className="inline-block animate-spin">
        <Sparkles className="w-8 h-8 text-blue-500" />
      </div>
      <p className="text-sm text-gray-600">Generating AI suggestion...</p>
      <p className="text-xs text-gray-500">Analyzing your word choices</p>
    </div>
  );
}

/**
 * Error State Component
 */
interface AIErrorStateProps {
  error: AIError;
  onRetry: () => void;
  onWriteMyself: () => void;
}

function AIErrorState({ error, onRetry, onWriteMyself }: AIErrorStateProps) {
  return (
    <div className="p-4 space-y-3 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle className="w-5 h-5" />
        <h3 className="font-medium text-sm">AI Assist Error</h3>
      </div>

      <p className="text-sm text-red-600">{error.message}</p>

      {error.retryable && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="w-full"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onWriteMyself}
        className="w-full text-gray-600"
      >
        Write Myself Instead
      </Button>
    </div>
  );
}

/**
 * AI Suggestion Display Component
 */
interface AISuggestionDisplayProps {
  suggestion: string;
  confidence: number;
  reasoning?: string;
  alternatives?: string[];
  onSelectAlternative: (alt: string) => void;
}

function AISuggestionDisplay({
  suggestion,
  confidence,
  reasoning,
  alternatives,
  onSelectAlternative,
}: AISuggestionDisplayProps) {
  return (
    <div className="space-y-3">
      {/* Main Suggestion */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">
          AI Suggestion:
        </h4>
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <p className="text-base font-medium text-gray-900 leading-relaxed">
            {suggestion}
          </p>
        </div>
      </div>

      {/* Confidence & Reasoning */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600">Confidence: {confidence}%</span>
          </div>
          {confidence >= 90 && (
            <Badge className="text-xs bg-green-500">High Quality</Badge>
          )}
        </div>

        {reasoning && (
          <p className="text-xs text-gray-600 italic">{reasoning}</p>
        )}
      </div>

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">
            Alternative Phrasings:
          </h4>
          <div className="space-y-2">
            {alternatives.map((alt, idx) => (
              <button
                key={idx}
                className="w-full text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                onClick={() => onSelectAlternative(alt)}
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Translation Comparison Component
 */
interface TranslationComparisonProps {
  original: string;
  userVersion: string;
  aiSuggestion: string;
}

function TranslationComparison({
  original,
  userVersion,
  aiSuggestion,
}: TranslationComparisonProps) {
  return (
    <div className="space-y-3 pt-3 border-t">
      <h4 className="text-xs font-medium text-gray-700">Comparison:</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Your Version */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Your Version</span>
          </div>
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs">{userVersion}</p>
          </div>
        </div>

        {/* AI Suggestion */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>AI Suggestion</span>
          </div>
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs">{aiSuggestion}</p>
          </div>
        </div>
      </div>

      {/* Original for Reference */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>Original Line</span>
        </div>
        <div className="p-2 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-600 italic">{original}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * AI Suggestion Actions Component
 */
interface AISuggestionActionsProps {
  onAccept: () => void;
  onReject: () => void;
  onModify: () => void;
}

function AISuggestionActions({
  onAccept,
  onReject,
  onModify,
}: AISuggestionActionsProps) {
  return (
    <div className="flex items-center gap-2 pt-4 border-t">
      <Button variant="outline" size="sm" onClick={onReject} className="flex-1">
        <X className="w-4 h-4 mr-2" />
        Reject
      </Button>

      <Button variant="outline" size="sm" onClick={onModify} className="flex-1">
        <Edit2 className="w-4 h-4 mr-2" />
        Modify
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={onAccept}
        className="flex-1 bg-green-600 hover:bg-green-700"
      >
        <Check className="w-4 h-4 mr-2" />
        Accept
      </Button>
    </div>
  );
}
