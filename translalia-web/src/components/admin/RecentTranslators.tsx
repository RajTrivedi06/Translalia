import { n, plural, relativeTime } from "./format";

export function RecentTranslators({
  rows,
  now,
}: {
  rows: Array<{ name: string; last_active: string; poems_finished: number }>;
  now: number;
}) {
  return (
    <ul className="divide-y divide-border-subtle">
      {rows.map((row) => (
        <li key={`${row.name}-${row.last_active}`} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
          <span className="truncate text-foreground">{row.name}</span>
          <span className="whitespace-nowrap tabular-nums text-foreground-secondary">
            {relativeTime(row.last_active, now)}
            <span className="text-foreground-muted">
              {" · "}
              {n(row.poems_finished)} {plural(row.poems_finished, "poem")} finished
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
