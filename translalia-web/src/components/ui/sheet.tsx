"use client";
import * as React from "react";

type SheetContextValue = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetContent({
  side = "right",
  className = "",
  children,
  ariaLabelledby,
}: {
  side?: "right" | "left";
  className?: string;
  children: React.ReactNode;
  ariaLabelledby?: string;
}) {
  const ctx = React.useContext(SheetContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!ctx?.open) return;
    const el = contentRef.current;
    if (!el) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = el?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        ctx?.onOpenChange(false);
      }
      if (e.key === "Tab") {
        // basic focus trap
        const fEls = el?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = Array.from(fEls || []).filter(
          (n) => !n.hasAttribute("disabled")
        );
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !el?.contains(active || null)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [ctx?.open, ctx?.onOpenChange]);

  if (!ctx || !ctx.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
    >
      <div
        className="absolute inset-0 bg-foreground/40"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        ref={contentRef}
        className={`absolute top-0 h-full w-full max-w-[720px] bg-surface shadow-modal outline-none ${
          side === "right" ? "right-0 animate-slide-in-right" : "left-0 animate-slide-in-left"
        } ${className}`}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border-subtle px-6 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SheetTitle({
  id,
  children,
  className = "",
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 id={id} className={`text-lg font-semibold text-foreground ${className}`}>
      {children}
    </h2>
  );
}

export function SheetFooter({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

export default Sheet;
