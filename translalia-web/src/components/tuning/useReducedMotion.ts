import * as React from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 *
 * Returns `false` on the server and first client render (so SSR markup is
 * stable), then resolves to the real value on mount and updates live if the
 * OS setting changes. Used to skip JS-driven animation choreography (timers,
 * cross-fades) so reduced-motion users get instant state changes — the global
 * `@media (prefers-reduced-motion: reduce)` rule in globals.css already
 * neutralizes pure-CSS transitions/animations.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
