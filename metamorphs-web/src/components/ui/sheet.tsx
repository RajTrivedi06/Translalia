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
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        ref={contentRef}
        className={
          `absolute top-0 h-full w-full max-w-[720px] bg-white dark:bg-neutral-900 shadow-xl outline-none ${
            side === "right" ? "right-0" : "left-0"
          } ` + className
        }
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
      className={`flex items-center justify-between border-b px-4 py-3 ${className}`}
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
    <div id={id} className={`font-semibold ${className}`}>
      {children}
    </div>
  );
}

export default Sheet;
