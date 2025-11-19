// components/ui/card.tsx
"use client";
import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl border shadow-sm bg-white ${className}`}
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
  return <div className={`p-4 border-b ${className}`}>{children}</div>;
}

export function CardTitle({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
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
