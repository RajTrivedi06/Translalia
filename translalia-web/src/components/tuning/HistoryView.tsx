import { cn } from "@/lib/utils";
import { promptHistory } from "./mockData";
import { textLink } from "./uiClasses";

function Score({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-xs text-foreground-muted">{label}</span>{" "}
      <span className="font-mono text-sm text-foreground">{value}</span>
    </span>
  );
}

/**
 * "History" tab — recent runs for the current line, as quiet rows (not cards).
 */
export function HistoryView() {
  return (
    <section>
      <h3 className="text-lg font-semibold text-foreground">
        Recent runs for Line 1
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Compare how different settings produced different variants for this
        line.
      </p>

      <div className="mt-2">
        {promptHistory.map((entry) => (
          <div
            key={`${entry.preset}-${entry.timeAgo}`}
            className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-border-subtle py-4 last:border-0"
          >
            <div className="min-w-40">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {entry.preset}
                </span>
                {entry.active && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-foreground-muted">
                {entry.timeAgo}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <Score label="Diversity" value={entry.diversity} />
              <Score label="Quality" value={entry.quality} />
              <Score label="Fidelity" value={entry.fidelity} />
            </div>

            <div className="flex items-center gap-4">
              <button type="button" className={cn("text-sm", textLink)}>
                Compare ›
              </button>
              <button type="button" className={cn("text-sm", textLink)}>
                Restore ›
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
