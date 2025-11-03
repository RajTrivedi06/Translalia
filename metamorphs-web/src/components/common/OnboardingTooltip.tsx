"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, HelpCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Onboarding tooltip system
 *
 * Features:
 * - Step-by-step guided tour
 * - Dismissible tooltips
 * - Persistent state (don't show again)
 * - Arrow pointing to target element
 * - Auto-advance option
 * - Progress indicator
 */

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector for target element
  position?: "top" | "bottom" | "left" | "right";
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingTooltipProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  autoStart?: boolean;
  storageKey?: string;
}

/**
 * OnboardingTooltip - Guided tour component
 */
export function OnboardingTooltip({
  steps,
  onComplete,
  autoStart = false,
  storageKey = "onboarding-completed",
}: OnboardingTooltipProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isActive, setIsActive] = React.useState(false);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  // Check if onboarding was completed before
  React.useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed && autoStart) {
      setIsActive(true);
    }
  }, [autoStart, storageKey]);

  // Update target element position
  React.useEffect(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const target = document.querySelector(step.target);

    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll target into view
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, "true");
    setIsActive(false);
    onComplete?.();
  };

  const handleDismiss = () => {
    setIsActive(false);
  };

  if (!isActive || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const position = step.position || "bottom";
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-[60] animate-fade-in" />

      {/* Highlight target */}
      {targetRect && (
        <div
          className="fixed z-[61] border-4 border-blue-500 rounded-lg pointer-events-none animate-pulse-subtle"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Tooltip Card */}
      {targetRect && (
        <Card
          className={cn(
            "fixed z-[62] w-80 max-w-[calc(100vw-32px)] shadow-2xl animate-fade-in",
            getTooltipPosition(targetRect, position)
          )}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-gray-500">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Dismiss tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-sm text-gray-700 mb-4">{step.content}</p>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              {step.action && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={step.action.onClick}
                >
                  {step.action.label}
                </Button>
              )}

              <Button size="sm" onClick={handleNext}>
                {currentStep === steps.length - 1 ? (
                  "Finish"
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

/**
 * Calculate tooltip position based on target element
 */
function getTooltipPosition(targetRect: DOMRect, position: string): string {
  const gap = 16; // Gap between tooltip and target

  switch (position) {
    case "top":
      return `top-[${targetRect.top - 200 - gap}px] left-[${
        targetRect.left
      }px]`;
    case "bottom":
      return `top-[${targetRect.bottom + gap}px] left-[${targetRect.left}px]`;
    case "left":
      return `top-[${targetRect.top}px] left-[${
        targetRect.left - 320 - gap
      }px]`;
    case "right":
      return `top-[${targetRect.top}px] left-[${targetRect.right + gap}px]`;
    default:
      return `top-[${targetRect.bottom + gap}px] left-[${targetRect.left}px]`;
  }
}

/**
 * Simple tooltip for inline help
 */
export function InlineTooltip({
  content,
  children,
  position = "top",
}: {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition"
        type="button"
      >
        {children}
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isVisible && (
        <div
          className={cn(
            "absolute z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none",
            position === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
            position === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
            position === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
            position === "right" && "left-full top-1/2 -translate-y-1/2 ml-2"
          )}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute w-2 h-2 bg-gray-900 transform rotate-45",
              position === "top" && "bottom-[-4px] left-1/2 -translate-x-1/2",
              position === "bottom" && "top-[-4px] left-1/2 -translate-x-1/2",
              position === "left" && "right-[-4px] top-1/2 -translate-y-1/2",
              position === "right" && "left-[-4px] top-1/2 -translate-y-1/2"
            )}
          />
        </div>
      )}
    </div>
  );
}
