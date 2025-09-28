"use client";
import { useState } from "react";
export default function VersionCard({
  title,
  text,
  meta,
}: {
  title: string;
  text: string;
  meta?: { model?: string; promptPreview?: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">{text}</pre>
      <button
        className="mt-2 text-xs underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`meta-${title}`}
      >
        {open ? "Hide prompt & model" : "Show prompt & model"}
      </button>
      <div
        id={`meta-${title}`}
        className={open ? "mt-2 text-xs space-y-1" : "hidden"}
      >
        {meta?.model && (
          <div>
            <b>Model:</b> {meta.model}
          </div>
        )}
        {meta?.promptPreview && (
          <details className="opacity-80">
            <summary>Prompt preview</summary>
            <pre className="whitespace-pre-wrap">{meta.promptPreview}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
