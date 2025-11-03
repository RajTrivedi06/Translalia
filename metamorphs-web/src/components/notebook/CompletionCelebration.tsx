"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, PartyPopper, FileText, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompletionCelebrationProps {
  /** Whether the celebration dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** Total lines in the poem */
  totalLines: number;
  /** Callback to view the comparison */
  onViewComparison?: () => void;
  /** Callback to view journey summary */
  onViewJourney?: () => void;
  /** Callback to export poem */
  onExport?: () => void;
}

/**
 * CompletionCelebration - Celebration modal when poem translation is complete
 *
 * Features:
 * - Confetti animation
 * - Completion statistics
 * - Quick actions (view comparison, journey, export)
 * - Encouraging message
 * - Smooth fade-in animation
 */
export function CompletionCelebration({
  open,
  onOpenChange,
  totalLines,
  onViewComparison,
  onViewJourney,
  onExport,
}: CompletionCelebrationProps) {
  const [showConfetti, setShowConfetti] = React.useState(false);

  // Trigger confetti animation when dialog opens
  React.useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timeout = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Confetti Effect */}
        {showConfetti && <ConfettiEffect />}

        <div className="relative">
          <DialogHeader className="text-center space-y-4">
            {/* Animated Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 rounded-full flex items-center justify-center animate-bounce">
                  <PartyPopper className="w-10 h-10 text-white" />
                </div>
                {/* Sparkle effects */}
                <Sparkles className="w-5 h-5 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
                <Sparkles className="w-4 h-4 text-purple-500 absolute -bottom-1 -left-2 animate-pulse delay-75" />
                <Sparkles className="w-4 h-4 text-pink-500 absolute top-0 -left-3 animate-pulse delay-150" />
              </div>
            </div>

            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎉 Translation Complete! 🎉
            </DialogTitle>
            <DialogDescription className="text-base">
              Congratulations! You&apos;ve successfully translated all{" "}
              {totalLines} lines of your poem. Your creative work is complete!
            </DialogDescription>
          </DialogHeader>

          {/* Stats Card */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 via-pink-50 to-yellow-50 rounded-lg border border-purple-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-1">
                {totalLines}
              </div>
              <div className="text-sm text-gray-600">Lines Translated</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <Button
              onClick={onViewComparison}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 group"
              size="lg"
            >
              <FileText className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              View Side-by-Side Comparison
            </Button>

            <Button
              onClick={onViewJourney}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 group"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
              View Translation Journey
            </Button>

            <Button
              onClick={onExport}
              variant="outline"
              className="w-full border-purple-300 hover:bg-purple-50 group"
              size="lg"
            >
              <Share2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Export & Share
            </Button>
          </div>

          {/* Encouraging Message */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 text-center italic">
              &ldquo;Translation is not just transferring words—it&apos;s
              bridging worlds. You&apos;ve created something beautiful.&rdquo;
              ✨
            </p>
          </div>

          {/* Close Button */}
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confetti animation effect
 */
function ConfettiEffect() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: [
      "bg-purple-500",
      "bg-pink-500",
      "bg-yellow-500",
      "bg-blue-500",
      "bg-green-500",
    ][i % 5],
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 2}s`,
    animationDuration: `${3 + Math.random() * 2}s`,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100]">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className={cn(
            "absolute w-2 h-2 rounded-full",
            piece.color,
            "animate-confetti"
          )}
          style={{
            left: piece.left,
            top: "-10px",
            animationDelay: piece.animationDelay,
            animationDuration: piece.animationDuration,
          }}
        />
      ))}

      {/* Add custom animation to globals.css */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation-name: confetti-fall;
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
