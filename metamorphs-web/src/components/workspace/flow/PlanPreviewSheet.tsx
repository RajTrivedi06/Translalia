"use client";
import * as React from "react";

export function PlanPreviewSheet({
  open,
  onOpenChange,
  poem,
  fields,
  onLooksGood,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poem: string;
  fields: Record<string, unknown>;
  onLooksGood: () => Promise<void>;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`}>
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white dark:bg-neutral-900 shadow-xl p-6 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Plan + Poem Preview</h2>
          <p className="text-sm text-neutral-500">
            Review exactly what will be sent to the translator.
          </p>
        </div>
        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-medium text-neutral-500">
              Poem (verbatim)
            </h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-100 dark:bg-neutral-800 p-3 text-sm">
              {poem || "—"}
            </pre>
          </section>
          <section>
            <h3 className="text-sm font-medium text-neutral-500">
              Collected Fields
            </h3>
            <div className="mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
              <dl className="space-y-2">
                {Object.entries(fields || {}).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="font-medium">
                      {typeof v === "object"
                        ? JSON.stringify(v, null, 2)
                        : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-md bg-neutral-900 text-white px-4 py-2"
            onClick={async () => {
              await onLooksGood();
              onOpenChange(false);
            }}
          >
            Looks good
          </button>
          <button
            className="rounded-md border px-4 py-2"
            onClick={() => onOpenChange(false)}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
