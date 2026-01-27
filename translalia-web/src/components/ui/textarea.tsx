"use client";

import * as React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Use serif font for poetry content */
  poetry?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, poetry = false, ...props }, ref) => {
    return (
      <textarea
        className={`flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted ${
          poetry ? "font-serif text-base leading-relaxed" : ""
        } ${className || ""}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
