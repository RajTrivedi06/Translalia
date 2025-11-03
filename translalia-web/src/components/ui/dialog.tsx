"use client";
import * as React from "react";

export function Dialog({
  open,
  onOpenChange,
  ariaLabelledby,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ariaLabelledby?: string;
  children: React.ReactNode;
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = el?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "Tab") {
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
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={contentRef}
        className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 shadow-xl outline-none dark:bg-neutral-900"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b px-2 pb-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
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

export function DialogDescription({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-sm text-gray-600 mt-2 ${className}`}>{children}</div>
  );
}

export function DialogFooter({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mt-6 ${className}`}>
      {children}
    </div>
  );
}

export function DialogContent({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export default Dialog;
