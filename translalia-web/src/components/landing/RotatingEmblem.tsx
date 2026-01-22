"use client";

import { useEffect, useRef, useState } from "react";

interface EmblemProps {
  className?: string;
}

export function RotatingEmblem({ className = "" }: EmblemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
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

  const baseRotation = scrollY * 0.02;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {/* Outer ring - slowest rotation */}
      <div
        className="absolute h-64 w-64 rounded-full border-2 border-sky-200 opacity-40 sm:h-80 sm:w-80"
        style={{
          transform: `rotate(${baseRotation}deg) translateZ(0)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Second ring - medium rotation with offset */}
      <div
        className="absolute h-52 w-52 rounded-full border border-sky-300 opacity-50 sm:h-64 sm:w-64"
        style={{
          transform: `rotate(${-baseRotation * 1.2}deg) translateZ(10px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Third ring - faster rotation */}
      <div
        className="absolute h-40 w-40 rounded-full border border-dashed border-sky-400 opacity-60 sm:h-48 sm:w-48"
        style={{
          transform: `rotate(${baseRotation * 1.5}deg) translateZ(20px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Inner ring - fastest rotation */}
      <div
        className="absolute h-28 w-28 rounded-full border-2 border-sky-500 opacity-70 sm:h-32 sm:w-32"
        style={{
          transform: `rotate(${-baseRotation * 2}deg) translateZ(30px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Center dot */}
      <div className="absolute h-3 w-3 rounded-full bg-sky-600" />

      {/* Decorative markers on rings */}
      <div
        className="absolute h-64 w-64 sm:h-80 sm:w-80"
        style={{
          transform: `rotate(${baseRotation}deg)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400" />
        <div className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-sky-400" />
        <div className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400" />
        <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-sky-400" />
      </div>

      {/* Floating glyphs around the emblem */}
      <div
        className="absolute h-72 w-72 sm:h-96 sm:w-96"
        style={{
          transform: `rotate(${-baseRotation * 0.5}deg)`,
          transition: "transform 0.15s ease-out",
        }}
      >
        <span
          className="absolute left-0 top-1/4 font-serif text-lg text-sky-400 opacity-60"
          style={{ transform: `rotate(${baseRotation * 0.5}deg)` }}
        >
          ✦
        </span>
        <span
          className="absolute right-0 top-1/3 font-serif text-xl text-sky-300 opacity-50"
          style={{ transform: `rotate(${baseRotation * 0.5}deg)` }}
        >
          ◇
        </span>
        <span
          className="absolute bottom-1/4 left-1/4 font-serif text-lg text-sky-500 opacity-40"
          style={{ transform: `rotate(${baseRotation * 0.5}deg)` }}
        >
          ∘
        </span>
        <span
          className="absolute bottom-1/3 right-1/4 font-serif text-xl text-sky-400 opacity-50"
          style={{ transform: `rotate(${baseRotation * 0.5}deg)` }}
        >
          ⟡
        </span>
      </div>
    </div>
  );
}
