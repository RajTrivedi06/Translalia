/**
 * Shared interaction classes for the Translation Tuning UI.
 *
 * Centralizing these keeps focus rings and text links pixel-identical across
 * every tuning component (consistency audit), and makes the accent/underline
 * conventions easy to change in one place.
 */

/** Standard keyboard focus ring used on every interactive element. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

/** Inline text link: accent color, underline on hover, consistent focus ring. */
export const textLink =
  "rounded-sm text-accent transition-colors duration-fast hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

/**
 * Inline "editable value" affordance (Style, Tone, model settings, …): reads
 * as text but a dashed underline warms to accent on hover, and it carries a
 * proper focus ring for keyboard users.
 */
export const editableValue =
  "cursor-pointer rounded-sm border-b border-dashed border-border-subtle transition-colors duration-fast hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

/**
 * Segmented pill toggle (Reasoning/Off, Current/History): a compact two-button
 * switch. Centralized so every toggle in the tuning UI is pixel-identical —
 * same container, padding, and active/inactive treatment.
 */
export const pillToggleContainer =
  "inline-flex rounded-full border border-border-subtle bg-surface p-1";
export const pillToggle =
  "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
export const pillToggleActive = "bg-accent text-white";
export const pillToggleInactive = "text-foreground-secondary hover:bg-muted";
