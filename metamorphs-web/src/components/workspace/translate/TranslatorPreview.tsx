"use client";
import * as React from "react";

export function TranslatorPreview({
  lines,
  notes,
  disabled,
  onAccept,
}: {
  lines: string[];
  notes: string[];
  disabled?: boolean;
  onAccept: (sel: { index: number; text: string }[]) => Promise<void>;
}) {
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});

  const toggle = (i: number) => setSelected((s) => ({ ...s, [i]: !s[i] }));
  const selList = Object.entries(selected)
    .filter(([_, v]) => v)
    .map(([k]) => ({ index: Number(k), text: lines[Number(k)] }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-neutral-500">
          Version A (select lines to accept)
        </h3>
        <div className="mt-2 rounded-md border divide-y">
          {lines.map((ln, i) => (
            <label key={i} className="flex items-start gap-3 p-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!selected[i]}
                onChange={() => toggle(i)}
              />
              <pre className="whitespace-pre-wrap text-sm">{ln || " "}</pre>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-neutral-500">Notes</h3>
        <ul className="mt-2 list-disc pl-6 text-sm">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2">
        <button
          className="rounded-md bg-neutral-900 text-white px-4 py-2 disabled:opacity-50"
          disabled={!selList.length || disabled}
          onClick={async () => {
            await onAccept(selList);
          }}
        >
          Accept selected ({selList.length})
        </button>
      </div>
    </div>
  );
}
