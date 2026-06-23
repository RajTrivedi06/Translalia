"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface TokenSuggestButtonProps {
  /** The word this affordance fetches suggestions for (used in the a11y label). */
  word: string;
  /** Open the suggestions popover for this word. */
  onSuggest: () => void;
  className?: string;
}

/**
 * Small "more suggestions" affordance shown in the corner of a word token.
 *
 * This is the discoverable, keyboard- and touch-accessible alternative to
 * right-click / long-press:
 *  - Mouse: hover the token, then click the icon.
 *  - Keyboard: Tab to the icon (it reveals on focus) and press Enter.
 *  - Touch: long-press the token still works; this icon stays out of the way.
 *
 * Hidden until the parent token is hovered or contains focus, so it never
 * clutters the workshop. The parent token must set `relative group`.
 */
export function TokenSuggestButton({
  word,
  onSuggest,
  className,
}: TokenSuggestButtonProps) {
  const t = useTranslations("Workshop");

  return (
    <button
      type="button"
      tabIndex={0}
      aria-label={t("wordSuggestLabel", {
        defaultValue: 'More suggestions for "{word}"',
        word,
      })}
      // Stop these from reaching the token's drag listeners and
      // add-to-notebook click/keyboard handlers.
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSuggest();
      }}
      className={cn(
        "absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full",
        "border border-border-subtle bg-surface text-accent shadow-sm touch-manipulation",
        "transition-opacity duration-fast hover:bg-accent-light/40 hover:text-accent-dark",
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

export default TokenSuggestButton;
