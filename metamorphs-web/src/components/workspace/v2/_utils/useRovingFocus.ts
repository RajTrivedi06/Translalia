// src/components/workspace/v2/_utils/useRovingFocus.ts
import * as React from "react";

export function useRovingFocus(count: number) {
  const [idx, setIdx] = React.useState(0);
  const refs = React.useRef<HTMLElement[]>([]);

  const bind = (i: number) => (el: HTMLElement | null) => {
    if (el) refs.current[i] = el;
  };

  const focus = (i: number) => refs.current[i]?.focus();

  return {
    idx,
    setIdx,
    bind,
    focus,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const n = Math.min(count - 1, idx + 1);
        setIdx(n);
        focus(n);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const n = Math.max(0, idx - 1);
        setIdx(n);
        focus(n);
      }
    },
  };
}