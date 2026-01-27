"use client";
import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "error";
};

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-fast";
  
  const variantStyles = {
    default: "border-transparent bg-accent text-white",
    secondary: "border-transparent bg-muted text-foreground-secondary",
    outline: "border-border text-foreground",
    success: "border-transparent bg-success-light text-success",
    warning: "border-transparent bg-warning-light text-warning",
    error: "border-transparent bg-error-light text-error",
  };

  return (
    <span className={`${base} ${variantStyles[variant]} ${className}`} {...props} />
  );
}