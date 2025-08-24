"use client";
import * as React from "react";

export function JourneyList({
  items,
}: {
  items: Array<{
    id: string;
    kind: string;
    summary: string;
    meta: unknown;
    created_at: string;
  }>;
}) {
  if (!items?.length)
    return <div className="text-sm text-neutral-500">No activity yet.</div>;
  return (
    <ol className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className="rounded-md border border-neutral-200 dark:border-neutral-800 p-2"
        >
          <div className="text-xs text-neutral-500">
            {new Date(it.created_at).toLocaleString()}
          </div>
          <div className="font-medium">{it.kind}</div>
          <div className="text-sm">{it.summary}</div>
          {it.meta ? (
            <pre className="mt-1 text-xs whitespace-pre-wrap text-neutral-600">
              {JSON.stringify(it.meta, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
