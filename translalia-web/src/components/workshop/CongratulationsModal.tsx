"use client";

import * as React from "react";
import { CheckCircle2, Sparkles, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CongratulationsModalProps {
  open: boolean;
  onClose: () => void;
  totalLines: number;
}

export function CongratulationsModal({
  open,
  onClose,
  totalLines,
}: CongratulationsModalProps) {
  const [showContent, setShowContent] = React.useState(false);
  const [showStars, setShowStars] = React.useState(false);
  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // Stagger animations
      setTimeout(() => setShowContent(true), 100);
      setTimeout(() => setShowStars(true), 300);
      setTimeout(() => setShowConfetti(true), 500);
    } else {
      setShowContent(false);
      setShowStars(false);
      setShowConfetti(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop with fade */}
      <div
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-sm",
          "transition-opacity duration-500",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Content */}
      <div
        className={cn(
          "relative bg-gradient-to-br from-white via-blue-50 to-purple-50",
          "rounded-3xl shadow-2xl",
          "w-full max-w-2xl",
          "transform transition-all duration-700 ease-out",
          showContent
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          {/* Animated stars */}
          {showStars &&
            Array.from({ length: 20 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "absolute text-yellow-400 animate-pulse",
                  "w-4 h-4"
                )}
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`,
                }}
              />
            ))}

          {/* Sparkle effects */}
          {showConfetti &&
            Array.from({ length: 30 }).map((_, i) => (
              <Sparkles
                key={i}
                className={cn(
                  "absolute text-blue-400 animate-ping",
                  "w-3 h-3"
                )}
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1.5}s`,
                }}
              />
            ))}
        </div>

        {/* Main content */}
        <div className="relative p-8 md:p-12 text-center">
          {/* Trophy icon with bounce animation */}
          <div
            className={cn(
              "mx-auto mb-6 w-24 h-24 rounded-full",
              "bg-gradient-to-br from-yellow-400 to-orange-500",
              "flex items-center justify-center",
              "shadow-lg",
              "transform transition-all duration-700 ease-out",
              showContent
                ? "scale-100 rotate-0"
                : "scale-0 rotate-180"
            )}
          >
            <Trophy className="w-12 h-12 text-white" />
          </div>

          {/* Check circle with scale animation */}
          <div
            className={cn(
              "mx-auto mb-6 w-20 h-20 rounded-full",
              "bg-green-500 flex items-center justify-center",
              "shadow-lg",
              "transform transition-all duration-500 ease-out",
              showContent
                ? "scale-100 opacity-100"
                : "scale-0 opacity-0"
            )}
            style={{ transitionDelay: "200ms" }}
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>

          {/* Title with fade and slide */}
          <h2
            className={cn(
              "text-4xl md:text-5xl font-bold mb-4",
              "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600",
              "bg-clip-text text-transparent",
              "transform transition-all duration-700 ease-out",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "300ms" }}
          >
            Congratulations! 🎉
          </h2>

          {/* Subtitle */}
          <p
            className={cn(
              "text-xl md:text-2xl text-gray-700 mb-2",
              "transform transition-all duration-700 ease-out",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "400ms" }}
          >
            You've completed your translation!
          </p>

          {/* Stats */}
          <div
            className={cn(
              "mt-8 mb-8 p-6 rounded-2xl",
              "bg-white/80 backdrop-blur-sm",
              "border-2 border-blue-200",
              "transform transition-all duration-700 ease-out",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "500ms" }}
          >
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {totalLines}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {totalLines === 1 ? "Line" : "Lines"} Translated
                </div>
              </div>
              <div className="w-px h-12 bg-gray-300" />
              <div>
                <div className="text-3xl font-bold text-green-600">100%</div>
                <div className="text-sm text-gray-600 mt-1">Complete</div>
              </div>
            </div>
          </div>

          {/* Message */}
          <p
            className={cn(
              "text-lg text-gray-600 mb-8",
              "transform transition-all duration-700 ease-out",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "600ms" }}
          >
            Your beautiful translation is ready. You can review it, make final
            adjustments, or share it with the world!
          </p>

          {/* Button */}
          <div
            className={cn(
              "transform transition-all duration-700 ease-out",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "700ms" }}
          >
            <Button
              onClick={onClose}
              size="lg"
              className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

