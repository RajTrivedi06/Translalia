"use client";
import { useState } from "react";
type Props = {
  lines: number;
  start?: number | null;
  end?: number | null;
  onChange?: (s: number, e: number) => void;
};
export default function LineFrame({
  lines,
  start = null,
  end = null,
  onChange,
}: Props) {
  const [s, setS] = useState(start ?? 1);
  const [e, setE] = useState(
    end ?? Math.min(lines, Math.max(1, (start ?? 1) + 1))
  );
  function bump(ds: number, de: number) {
    const ns = Math.max(1, Math.min(lines, s + ds));
    const ne = Math.max(ns, Math.min(lines, e + de));
    setS(ns);
    setE(ne);
    onChange?.(ns, ne);
  }
  return (
    <div
      className="mt-2 flex items-center gap-2"
      aria-label="Line selection frame"
    >
      <div className="text-sm">Lines:</div>
      <div className="flex items-center gap-1">
        <button
          className="rounded border px-2"
          onClick={() => bump(-1, 0)}
          aria-label="Move start up"
        >
          –
        </button>
        <span className="px-2 tabular-nums">{s}</span>
        <button
          className="rounded border px-2"
          onClick={() => bump(1, 0)}
          aria-label="Move start down"
        >
          +
        </button>
      </div>
      <span>to</span>
      <div className="flex items-center gap-1">
        <button
          className="rounded border px-2"
          onClick={() => bump(0, -1)}
          aria-label="Move end up"
        >
          –
        </button>
        <span className="px-2 tabular-nums">{e}</span>
        <button
          className="rounded border px-2"
          onClick={() => bump(0, 1)}
          aria-label="Move end down"
        >
          +
        </button>
      </div>
      <span className="text-xs opacity-60">(keyboard ↑/↓ support later)</span>
    </div>
  );
}
