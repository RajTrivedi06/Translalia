import { formatWeek, n } from "./format";

/**
 * Cumulative lines translated by week. One SVG polyline, current total
 * labelled at the right end. Under five points there is no line, only the
 * points, so a trend is never implied by two dots.
 */
export function GrowthChart({ weeks }: { weeks: Array<{ week: string; lines: number }> }) {
  let running = 0;
  const points = weeks.map((w) => ({ week: w.week, total: (running += w.lines) }));
  const total = points.at(-1)?.total ?? 0;
  const drawLine = points.length >= 5;

  const width = 720;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 8, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = Math.max(total, 1);
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;
  const path = points.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const last = points.at(-1);
  const first = points[0];

  return (
    <div className="w-full">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Cumulative lines translated by week, now ${n(total)}`}
        >
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-border-subtle"
            strokeWidth={1}
          />
          {drawLine ? (
            <polyline points={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
          ) : null}
          {points.map((p, i) => (
            <circle key={p.week} cx={x(i)} cy={y(p.total)} r={drawLine ? 2.5 : 4} className="fill-accent" />
          ))}
        </svg>
        {/* Labels are HTML, not SVG text, so they keep their size when the chart shrinks on a phone. */}
        {last ? (
          <div className="pointer-events-none absolute right-0 top-0 -translate-y-1/2 rounded bg-surface px-1.5 text-base font-semibold tabular-nums text-foreground">
            {n(last.total)}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-xs text-foreground-muted">
        <span>{first ? formatWeek(first.week) : ""}</span>
        <span>{last && points.length > 1 ? formatWeek(last.week) : ""}</span>
      </div>
    </div>
  );
}
