"use client";
import { useState } from "react";
import type { UploadItem } from "@/state/uploads";
export default function UploadsTray({
  items = [] as UploadItem[],
  renderItem,
}: {
  items?: UploadItem[];
  renderItem?: (it: UploadItem, i: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div aria-label="Uploads tray">
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="uploads-list"
      >
        {open ? "Hide uploads" : `Show uploads (${items.length})`}
      </button>
      <ul
        id="uploads-list"
        role="list"
        className={`${open ? "mt-2 space-y-1" : "hidden"}`}
      >
        {items.length === 0 && (
          <li className="text-sm opacity-60">No uploads yet</li>
        )}
        {items.map((it, i) =>
          renderItem ? (
            renderItem(it, i)
          ) : (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border px-3 py-1"
            >
              <span className="truncate">{it.name}</span>
              <span className="text-xs tabular-nums opacity-70">
                {Math.round(it.size / 1024)} KB
              </span>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
