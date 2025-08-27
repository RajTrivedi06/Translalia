"use client";
import * as React from "react";
import { groupJourney, type JourneyItem } from "@/lib/journey/group";

export function JourneyList({ items }: { items: JourneyItem[] }) {
  if (!items?.length)
    return <div className="text-sm text-neutral-500">No activity yet.</div>;
  const groups = groupJourney(items);
  return (
    <ol className="space-y-3">
      {groups.map((g, idx) => (
        <li
          key={g.header.id ?? `g-${idx}`}
          className="rounded-md border border-neutral-200 dark:border-neutral-800 p-2"
        >
          <div className="text-xs text-neutral-500">
            {new Date(g.header.created_at).toLocaleString()}
          </div>
          <div className="font-medium">{g.header.kind}</div>
          <div className="text-sm">{g.header.summary}</div>
          {g.header.meta ? (
            <pre className="mt-1 text-xs whitespace-pre-wrap text-neutral-600">
              {JSON.stringify(g.header.meta, null, 2)}
            </pre>
          ) : null}

          {g.children.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-neutral-500">
                Per-line details ({g.children.length})
              </summary>
              <div className="mt-1 space-y-1">
                {g.children.map((c) => (
                  <pre
                    key={c.id}
                    className="text-xs whitespace-pre-wrap text-neutral-600 border rounded p-1"
                  >
                    {JSON.stringify(
                      { summary: c.summary, meta: c.meta },
                      null,
                      2
                    )}
                  </pre>
                ))}
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
