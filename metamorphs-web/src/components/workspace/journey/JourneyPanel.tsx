"use client";

import { useWorkspace } from "@/store/workspace";

export function JourneyPanel() {
  const journey = useWorkspace((s) => s.journey);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="px-4 py-3 font-semibold">
        Summary of the whole iteration
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {journey.length === 0 ? (
          <div className="text-sm text-neutral-500 flex flex-col items-center justify-center gap-2 pt-8">
            <img src="/file.svg" alt="" className="h-8 w-8 opacity-50" />
            <div>No items yet. Pin changes from Compare.</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {journey.map((j) => (
              <li key={j.id} className="rounded-md border bg-white p-3 text-sm">
                {j.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
