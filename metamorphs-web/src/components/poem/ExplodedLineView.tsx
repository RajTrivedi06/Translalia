"use client";
type Token = { surface: string; options: string[] };
type Line = { idx: number; tokens: Token[] };
export default function ExplodedLineView({ lines }: { lines: Line[] }) {
  if (!lines?.length) return null;
  return (
    <div
      role="table"
      aria-label="Exploded tokens"
      className="rounded-2xl border"
    >
      <div
        role="row"
        className="grid grid-cols-12 border-b bg-slate-50 p-2 text-xs font-medium"
      >
        <div role="columnheader" className="col-span-3">
          Token
        </div>
        <div role="columnheader" className="col-span-9">
          Options
        </div>
      </div>
      {lines.flatMap((line) =>
        line.tokens.map((t, i) => (
          <div
            role="row"
            key={`${line.idx}-${i}`}
            className="grid grid-cols-12 p-2 border-b last:border-b-0"
          >
            <div role="cell" className="col-span-3 font-mono text-sm">
              {t.surface}
            </div>
            <div
              role="cell"
              className="col-span-9 text-sm flex flex-wrap gap-2"
            >
              {t.options.map((opt, j) => (
                <span key={j} className="rounded-lg border px-2 py-0.5">
                  {opt}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
