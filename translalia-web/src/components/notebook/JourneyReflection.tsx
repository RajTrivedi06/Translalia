"use client";

import * as React from "react";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { useJourneyReflection } from "@/hooks/useJourneyReflection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export interface JourneyReflectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

type Stage = "input" | "display" | "feedback-offer" | "feedback-loading" | "feedback-display" | "error";

/**
 * JourneyReflection - Two-stage conversational reflection system
 *
 * Features:
 * - Stage 1: Student types reflection ("How did your journey feel?")
 * - Stage 2: Reflection displayed as journal entry
 * - Stage 3: Opt-in feedback offer
 * - Stage 4: AI generates warm, brief feedback (Phase 2)
 * - Stage 5: Feedback displayed in chat bubble style (Phase 2)
 *
 * This component handles Phase 1 (input & storage) fully.
 * Phase 2 (feedback generation) will be integrated in the next iteration.
 */
export function JourneyReflection({
  open,
  onOpenChange,
  projectId,
}: JourneyReflectionProps) {
  const threadId = useThreadId();
  const poemLines = useWorkshopStore((s) => s.poemLines);
  const completedLines = useWorkshopStore((s) => s.completedLines);

  const {
    reflection,
    isLoading,
    error,
    saveReflection,
    generateFeedback,
    reset,
  } = useJourneyReflection();

  const [stage, setStage] = React.useState<Stage>("input");
  const [inputValue, setInputValue] = React.useState("");
  const [charCount, setCharCount] = React.useState(0);

  const totalLines = poemLines.length;
  const completedCount = Object.keys(completedLines).length;

  const MAX_CHARS = 5000;
  const MIN_CHARS = 10;

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setInputValue(value);
      setCharCount(value.length);
    }
  };

  // Handle reflection submission
  const handleSubmitReflection = async () => {
    if (!threadId || inputValue.length < MIN_CHARS) {
      return;
    }

    const saved = await saveReflection({
      threadId,
      projectId,
      studentReflection: inputValue,
      completedLinesCount: completedCount,
      totalLinesCount: totalLines,
    });

    if (saved) {
      setStage("display");
      setInputValue("");
      setCharCount(0);
    }
  };

  // Handle requesting feedback
  const handleRequestFeedback = async () => {
    if (!reflection || !threadId) return;

    setStage("feedback-loading");

    const updated = await generateFeedback({
      journeyReflectionId: reflection.id,
      studentReflection: reflection.studentReflection,
      completedLines,
      poemLines,
      completedCount,
      totalCount: totalLines,
      threadId,
    });

    if (updated) {
      setStage("feedback-display");
    } else {
      setStage("error");
    }
  };

  // Handle closing dialog
  const handleClose = () => {
    reset();
    setStage("input");
    onOpenChange(false);
  };

  // Handle cancel from input
  const handleCancel = () => {
    setInputValue("");
    setCharCount(0);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            Your Translation Reflection
          </DialogTitle>
          <DialogDescription>
            Share your translation journey - how it felt, what you found interesting or challenging
          </DialogDescription>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          {stage === "input" && (
            <InputStage
              value={inputValue}
              charCount={charCount}
              maxChars={MAX_CHARS}
              minChars={MIN_CHARS}
              isLoading={isLoading}
              onInputChange={handleInputChange}
              onSubmit={handleSubmitReflection}
              onCancel={handleCancel}
            />
          )}

          {stage === "display" && reflection && (
            <DisplayStage
              reflection={reflection}
              completedCount={completedCount}
              totalLines={totalLines}
              onRequestFeedback={handleRequestFeedback}
              onDone={handleClose}
            />
          )}

          {stage === "feedback-loading" && (
            <FeedbackLoadingStage />
          )}

          {stage === "feedback-display" && reflection && (
            <FeedbackDisplayStage
              feedback={reflection.aiFeedback || ""}
              onDone={handleClose}
            />
          )}

          {stage === "error" && error && (
            <ErrorStage
              error={error}
              onRetry={() => {
                if (reflection) {
                  handleRequestFeedback();
                }
              }}
              onDone={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Stage 1: Input Reflection
 */
function InputStage({
  value,
  charCount,
  maxChars,
  minChars,
  isLoading,
  onInputChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  charCount: number;
  maxChars: number;
  minChars: number;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const isValid = charCount >= minChars;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📓 YOUR REFLECTION
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          How did your translation journey feel? What was the most interesting or challenging part for you?
        </p>

        <textarea
          value={value}
          onChange={onInputChange}
          disabled={isLoading}
          placeholder="Share your thoughts about your translation journey..."
          className="w-full min-h-[180px] p-4 rounded-lg border border-gray-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none text-base leading-relaxed disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        <div className="mt-2 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {charCount}/{maxChars} characters
          </span>
          {charCount < minChars && charCount > 0 && (
            <span className="text-xs text-amber-600">
              At least {minChars} characters required
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="min-w-[120px]"
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!isValid || isLoading}
          className="min-w-[160px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Save & Continue →
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Stage 2: Display Saved Reflection + Feedback Offer
 */
function DisplayStage({
  reflection,
  completedCount,
  totalLines,
  onRequestFeedback,
  onDone,
}: {
  reflection: any;
  completedCount: number;
  totalLines: number;
  onRequestFeedback: () => void;
  onDone: () => void;
}) {
  const progressPercentage =
    totalLines > 0 ? Math.round((completedCount / totalLines) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Journal Entry Display */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📖 YOUR THOUGHTS
        </h3>

        <div className="bg-white rounded-lg p-5 border border-gray-200 mb-4">
          <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
            "{reflection.studentReflection}"
          </p>
        </div>

        {/* Progress Info */}
        <div className="text-xs text-gray-600 space-y-1">
          <p>
            Lines completed: {completedCount} of {totalLines} ({progressPercentage}%)
          </p>
          <p>Saved at {new Date(reflection.createdAt).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Feedback Offer */}
      <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-3">
              A helpful friend would like to comment
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              I can share some thoughts about your translation journey if you'd like. It's totally optional!
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onDone}
                className="min-w-[120px]"
              >
                No thanks
              </Button>
              <Button
                onClick={onRequestFeedback}
                className="min-w-[140px] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                Sure! Tell me →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stage 3: Feedback Loading State
 */
function FeedbackLoadingStage() {
  const [loadingMessage, setLoadingMessage] = React.useState(
    "Thinking about your journey..."
  );

  React.useEffect(() => {
    const messages = [
      "Thinking about your journey...",
      "Reviewing your creative choices...",
      "Analyzing your translation decisions...",
      "Crafting thoughts about your work...",
      "Almost ready to share...",
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center animate-pulse">
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Generating Feedback
      </h3>
      <p className="text-sm text-gray-600 animate-pulse mb-6">
        {loadingMessage}
      </p>
      <p className="text-xs text-gray-500">
        This usually takes 10-20 seconds, thanks for waiting! 🎉
      </p>
    </div>
  );
}

/**
 * Stage 4: Display AI Feedback (Chat Bubble Style)
 */
function FeedbackDisplayStage({
  feedback,
  onDone,
}: {
  feedback: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Chat Bubble */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💬 THOUGHTS FROM YOUR TRANSLATION COMPANION
        </h3>

        <div className="bg-white rounded-lg p-5 border border-blue-200 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
            {feedback}
          </p>
        </div>

        <p className="text-xs text-gray-500">
          This feedback is based on your reflection and translation journey.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-end">
        <Button
          onClick={onDone}
          className="min-w-[140px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * Error State
 */
function ErrorStage({
  error,
  onRetry,
  onDone,
}: {
  error: string;
  onRetry: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md">{error}</p>
      <p className="text-xs text-gray-500 mb-6">
        Your reflection was saved, but we couldn't generate feedback right now.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
        <Button
          onClick={onRetry}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
