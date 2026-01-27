"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideStepsProps {
  className?: string;
  children: [ReactNode, ReactNode, ReactNode, ReactNode, ReactNode];
  stepTitles: [string, string, string, string, string];
  stepCompletions: [boolean, boolean, boolean, boolean, boolean];
  value?: string;
  onValueChange?: (value: string) => void;
  onEditStep?: (stepIndex: number) => void;
  canEditSteps?: boolean;
}

function pickDefaultStep(stepCompletions: GuideStepsProps["stepCompletions"]) {
  const firstIncomplete = stepCompletions.findIndex((done) => !done);
  const idx =
    firstIncomplete === -1 ? stepCompletions.length - 1 : firstIncomplete;
  return `step-${idx + 1}`;
}

export function GuideSteps({
  className,
  children,
  stepTitles,
  stepCompletions,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  onEditStep,
  canEditSteps = false,
}: GuideStepsProps) {
  const defaultValue = useMemo(
    () => pickDefaultStep(stepCompletions),
    [stepCompletions]
  );

  const [internalValue, setInternalValue] = useState<string>(defaultValue);

  // Use controlled value if provided, otherwise use internal state
  const openValue = controlledValue ?? internalValue;
  const setOpenValue = controlledOnValueChange ?? setInternalValue;

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface shadow-card",
        "h-full min-h-0 flex flex-col",
        className
      )}
    >
      {/* This is the key: the accordion gets the remaining height + scroll */}
      <Accordion
        type="single"
        collapsible
        value={openValue}
        onValueChange={setOpenValue}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
          "px-0"
        )}
      >
        {children.map((child, index) => {
          const value = `step-${index + 1}`;
          const isComplete = stepCompletions[index];
          const isOpen = openValue === value;

          return (
            <AccordionItem
              key={value}
              value={value}
              className="border-b border-border-subtle last:border-b-0"
            >
              <AccordionTrigger
                className={cn(
                  "hover:no-underline",
                  "px-5 py-4",
                  "transition-colors duration-fast",
                  "hover:bg-muted data-[state=open]:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                )}
              >
                <div className="flex w-full items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors duration-fast",
                      isComplete
                        ? "bg-success text-white"
                        : isOpen
                        ? "bg-accent text-white"
                        : "bg-muted text-foreground-secondary"
                    )}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {stepTitles[index]}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    {isComplete && (
                      <span
                        className="text-sm font-semibold text-success"
                        aria-label="Completed"
                        title="Completed"
                      >
                        ✓
                      </span>
                    )}
                    {isComplete && canEditSteps && onEditStep && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditStep(index);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2 py-1",
                          "text-xs font-medium text-foreground-secondary",
                          "hover:bg-border-subtle hover:text-foreground",
                          "transition-colors duration-fast",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                        )}
                        title="Edit this step"
                        aria-label="Edit this step"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-5 pb-6 pt-2">
                {/* extra padding so focus rings don't feel cramped */}
                <div className="pt-2">{child}</div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
