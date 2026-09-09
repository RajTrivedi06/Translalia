import { n } from "./format";

/** Horizontal bars, longest first, every bar carrying its number. */
export function BarList({
  rows,
  unit,
}: {
  rows: Array<{ label: string; value: number; note?: string }>;
  unit: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <span className="truncate text-sm text-foreground" title={row.label}>
            {row.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-6 rounded-sm bg-accent"
              style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap text-sm tabular-nums text-foreground-secondary">
              {n(row.value)}
              {row.note ? <span className="text-foreground-muted"> {row.note}</span> : null}
              <span className="sr-only"> {unit}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
