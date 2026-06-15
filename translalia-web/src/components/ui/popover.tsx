"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type PopoverContextValue = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

export function Popover({
  open,
  onOpenChange,
  anchorRef: externalAnchorRef,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const internalAnchorRef = React.useRef<HTMLElement | null>(null);
  const anchorRef = externalAnchorRef ?? internalAnchorRef;

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, anchorRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

export function PopoverAnchor({
  children,
}: {
  children: React.ReactElement<{ ref?: React.Ref<HTMLElement> }>;
}) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) {
    throw new Error("PopoverAnchor must be used within Popover");
  }

  const child = React.Children.only(children) as React.ReactElement & {
    ref?: React.Ref<HTMLElement>;
  };

  return React.cloneElement(child, {
    ref: mergeRefs(child.ref, ctx.anchorRef as React.Ref<HTMLElement>),
  } as React.HTMLAttributes<HTMLElement>);
}

export function PopoverContent({
  className = "",
  children,
  align = "end",
  sideOffset = 6,
  ariaLabelledby,
}: {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  ariaLabelledby?: string;
}) {
  const ctx = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const canPortal = typeof document !== "undefined";

  const updatePosition = React.useCallback(() => {
    const anchor = ctx?.anchorRef.current;
    const content = contentRef.current;
    if (!anchor || !content) return false;

    const anchorRect = anchor.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const viewportPadding = 8;

    let top = anchorRect.bottom + sideOffset;
    let left = anchorRect.left;

    if (align === "center") {
      left = anchorRect.left + anchorRect.width / 2 - contentRect.width / 2;
    } else if (align === "end") {
      left = anchorRect.right - contentRect.width;
    }

    if (left + contentRect.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - contentRect.width - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    if (top + contentRect.height > window.innerHeight - viewportPadding) {
      top = anchorRect.top - contentRect.height - sideOffset;
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    setPosition({ top, left });
    return true;
  }, [align, ctx?.anchorRef, sideOffset]);

  React.useLayoutEffect(() => {
    if (!ctx?.open) return;

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(raf);
  }, [ctx?.open, updatePosition, children]);

  React.useEffect(() => {
    if (!ctx?.open) return;
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [ctx?.open, updatePosition]);

  React.useEffect(() => {
    if (!ctx?.open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [ctx?.open, updatePosition]);

  React.useEffect(() => {
    if (!ctx?.open) return;
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const popoverCtx = ctx;
    const trapEl: HTMLDivElement = contentEl;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const autofocus = trapEl.querySelector<HTMLElement>(
      "[data-popover-autofocus]"
    );
    const focusable =
      autofocus ??
      trapEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    focusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        popoverCtx.onOpenChange(false);
      }
      if (e.key === "Tab") {
        const fEls = trapEl.querySelectorAll<HTMLElement>(
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
          if (active === first || !trapEl.contains(active || null)) {
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

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (trapEl.contains(target)) return;
      if (popoverCtx.anchorRef.current?.contains(target)) return;
      popoverCtx.onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      previouslyFocused?.focus?.();
    };
  }, [ctx?.open, ctx?.onOpenChange, ctx?.anchorRef]);

  if (!ctx?.open || !canPortal) return null;

  return createPortal(
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={ariaLabelledby}
      className={`fixed z-50 min-w-[240px] max-w-[320px] rounded-lg border border-border-subtle bg-surface p-4 shadow-modal outline-none animate-popover-in ${className}`}
      style={{
        top: position.top,
        left: position.left,
      }}
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body
  );
}

export default Popover;
