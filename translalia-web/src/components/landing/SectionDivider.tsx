"use client";

import { useEffect, useRef, useState } from "react";

interface SectionDividerProps {
  variant?: "wave" | "dots" | "gradient" | "line";
  className?: string;
}

export function SectionDivider({ variant = "line", className = "" }: SectionDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const divider = dividerRef.current;
    if (!divider) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(divider);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isInView]);

  if (variant === "wave") {
    return (
      <div
        ref={dividerRef}
        className={`relative h-24 w-full overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            className="fill-slate-100 transition-all duration-700"
            style={{
              transform: `translateX(${isInView ? 0 : -50}px)`,
              opacity: isInView ? 1 : 0,
            }}
            d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z"
          />
        </svg>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div
        ref={dividerRef}
        className={`flex items-center justify-center gap-3 py-12 ${className}`}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full bg-slate-300 transition-all duration-500 ${
              isInView ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
            style={{
              transitionDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "gradient") {
    return (
      <div
        ref={dividerRef}
        className={`relative h-32 w-full overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-100 to-transparent transition-all duration-1000"
          style={{
            transform: `translateX(${isInView ? 0 : -100}%)`,
            opacity: isInView ? 1 : 0,
          }}
        />
        <div
          className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent transition-all duration-1000 delay-300"
          style={{
            transform: `scaleX(${isInView ? 1 : 0})`,
          }}
        />
      </div>
    );
  }

  // Default: line variant with parallax
  return (
    <div
      ref={dividerRef}
      className={`relative flex items-center justify-center py-16 ${className}`}
      aria-hidden="true"
    >
      <div className="relative flex w-full max-w-2xl items-center gap-4">
        {/* Left line */}
        <div
          className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-300 transition-all duration-700"
          style={{
            transform: `scaleX(${isInView ? 1 : 0})`,
            transformOrigin: "right",
          }}
        />

        {/* Center ornament */}
        <div
          className="relative transition-all duration-700"
          style={{
            transform: `rotate(${scrollY * 0.05}deg) scale(${isInView ? 1 : 0})`,
          }}
        >
          <span className="text-lg text-slate-400">◆</span>
        </div>

        {/* Right line */}
        <div
          className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-300 transition-all duration-700"
          style={{
            transform: `scaleX(${isInView ? 1 : 0})`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
}
