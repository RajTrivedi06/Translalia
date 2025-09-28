"use client";
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className = "",
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-60 disabled:cursor-not-allowed";
  const variants =
    variant === "outline"
      ? "border bg-white hover:bg-neutral-50 dark:bg-neutral-900"
      : variant === "ghost"
      ? "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
      : "bg-neutral-900 text-white hover:bg-neutral-800";
  const sizes =
    size === "sm"
      ? "px-2 py-1"
      : size === "lg"
      ? "px-4 py-2 text-base"
      : "px-3 py-1.5";
  return (
    <button
      className={`${base} ${variants} ${sizes} ${className}`}
      {...props}
    />
  );
}

export default Button;
