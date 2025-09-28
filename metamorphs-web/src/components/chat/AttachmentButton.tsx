"use client";
import * as React from "react";

export default function AttachmentButton({
  onFiles,
}: {
  onFiles?: (files: FileList) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1">
      📎 Attach
      <input
        type="file"
        accept=".txt,.pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles?.(e.target.files)}
      />
    </label>
  );
}
