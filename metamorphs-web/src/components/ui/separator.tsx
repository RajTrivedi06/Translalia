"use client";
import * as React from "react";

export function Separator({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full border-t border-neutral-200 dark:border-neutral-800 ${className}`}
    />
  );
}

export default Separator;
