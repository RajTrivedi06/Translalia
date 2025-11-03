"use client";

import * as React from "react";

export function PrismaticStrip({
  variants,
  index,
}: {
  variants: Array<{ label: "A" | "B" | "C"; text: string; confidence: number }>;
  index: number;
}) {
  return (
    <div className="px-4 pb-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {variants.map((v, i) => (
          <div key={i} className="rounded-md border p-2 bg-neutral-50">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold">{v.label}</span>
              <span className="text-neutral-500">
                {Math.round(v.confidence * 100)}%
              </span>
            </div>
            <div className="text-sm line-clamp-3">{v.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
