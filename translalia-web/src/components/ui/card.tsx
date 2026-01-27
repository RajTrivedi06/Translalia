// components/ui/card.tsx
"use client";
import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border border-border-subtle bg-surface shadow-card ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`p-4 border-b border-border-subtle ${className}`}>{children}</div>;
}

export function CardTitle({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <h2 className={`text-lg font-semibold text-foreground ${className}`}>{children}</h2>;
}

export function CardContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function CardFooter({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`p-4 pt-0 flex items-center gap-2 ${className}`}>{children}</div>;
}
