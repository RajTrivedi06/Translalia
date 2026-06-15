import { promptReasoning } from "../mockData";
import { SectionHeader } from "./SectionHeader";

export function ReasoningTrace() {
  const { tokens, steps } = promptReasoning;

  return (
    <section className="my-2 border-t border-dashed border-border-subtle py-6">
      <SectionHeader
        title="AI Reasoning Trace"
        right={
          <span className="font-mono text-xs text-accent">
            {tokens} reasoning tokens
          </span>
        }
      />

      <ol className="mt-4 space-y-5 border-l-2 border-accent/20 pl-4">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-foreground-secondary">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
