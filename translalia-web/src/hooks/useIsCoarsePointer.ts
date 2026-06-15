"use client";

import * as React from "react";

/**
 * True when the primary input is touch/coarse (e.g. phones, tablets).
 * Used to keep note markers discoverable without hover.
 */
export function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarse(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isCoarse;
}
