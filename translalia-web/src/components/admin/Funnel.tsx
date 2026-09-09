import { n } from "./format";

/** Five descending bars, each with its count and the drop from the step before. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const first = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const drop = prev !== null ? prev - step.value : null;
        return (
          <li key={step.label}>
            <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <span className="text-foreground">{step.label}</span>
              <span className="tabular-nums text-foreground-secondary">
                {n(step.value)}
                {drop !== null && drop > 0 ? (
                  <span className="text-foreground-muted"> · {n(drop)} fewer than the step before</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-6 w-full rounded-sm bg-muted">
              <div
                className="h-6 rounded-sm bg-accent"
                style={{ width: `${Math.max((step.value / first) * 100, step.value > 0 ? 1 : 0)}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
