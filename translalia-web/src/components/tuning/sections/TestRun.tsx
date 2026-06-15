import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { testRunResult, type ValidationTone } from "../mockData";
import { SectionHeader } from "./SectionHeader";
import { textLink } from "../uiClasses";

const validationText: Record<ValidationTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

const validationDot: Record<ValidationTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

const variantLabels = ["A", "B", "C"];

export function TestRun() {
  const { current, tuned, validations } = testRunResult;

  return (
    <section className="my-2 border-t border-dashed border-border-subtle py-6">
      <SectionHeader title="Test Run" />

      <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">
        Run your changes against Line 1 (
        <span className="font-serif italic text-foreground">
          Hombres necios que acusáis
        </span>
        ) and compare side-by-side with the current pipeline.
      </p>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-card transition-colors duration-fast hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Play size={14} />
          Test Run
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground-secondary transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <RotateCcw size={14} />
          Reset to defaults
        </button>
        <button type="button" className={cn("text-sm", textLink)}>
          Save as preset →
        </button>
      </div>

      {/* Side-by-side comparison */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-muted p-4">
          <h5 className="text-xs uppercase tracking-wider text-foreground-muted">
            Current output
          </h5>
          <div className="mt-3 space-y-2">
            {current.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground">
                <span className="mr-1 font-medium text-foreground-muted">
                  {variantLabels[i]}.
                </span>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-success-light/40 p-4">
          <h5 className="text-xs uppercase tracking-wider text-accent">
            Your tuning
          </h5>
          <div className="mt-3 space-y-2">
            {tuned.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground">
                <span className="mr-1 font-medium text-accent">
                  {variantLabels[i]}.
                </span>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Validation pills */}
      <div className="mt-4 flex flex-wrap items-center gap-6">
        {validations.map((v) => (
          <span
            key={v.label}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              validationText[v.tone],
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                validationDot[v.tone],
              )}
            />
            {v.label}
          </span>
        ))}
      </div>
    </section>
  );
}
