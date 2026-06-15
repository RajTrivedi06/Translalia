"use client";
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className = "", variant = "default", size = "md", ...props },
    ref
  ) {
    const base =
      "inline-flex items-center justify-center font-medium rounded-md transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

    const variantStyles = {
      default:
        "bg-accent text-white hover:bg-accent-dark shadow-card",
      outline:
        "border border-border bg-surface text-foreground hover:bg-muted shadow-card",
      ghost: "bg-transparent text-foreground hover:bg-muted",
      destructive: "bg-error text-white hover:bg-error/90 shadow-card",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      />
    );
  }
);

export default Button;
