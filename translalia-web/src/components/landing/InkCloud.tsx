"use client";

import { useEffect, useRef, useState } from "react";

interface Glyph {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  speed: number;
  char: string;
}

export function InkCloud() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [glyphs] = useState<Glyph[]>(() => {
    const chars = ["✳", "◦", "·", "○", "∘", "✦", "◇", "⟡", "∗", "⁂"];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 24 + 12,
      opacity: Math.random() * 0.15 + 0.05,
      rotation: Math.random() * 360,
      speed: Math.random() * 0.5 + 0.2,
      char: chars[Math.floor(Math.random() * chars.length)],
    }));
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ink cloud blobs */}
      <div
        className="absolute -right-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-sky-200 opacity-30 blur-[150px]"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      />
      <div
        className="absolute -left-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-blue-200 opacity-30 blur-[120px]"
        style={{
          transform: `translateY(${scrollY * -0.08}px)`,
        }}
      />
      <div
        className="absolute left-1/3 top-1/3 h-[300px] w-[300px] rounded-full bg-slate-200 opacity-20 blur-[100px]"
        style={{
          transform: `translateY(${scrollY * 0.05}px) translateX(${scrollY * 0.02}px)`,
        }}
      />

      {/* Floating glyphs */}
      {glyphs.map((glyph) => (
        <span
          key={glyph.id}
          className="absolute font-serif text-slate-400 transition-transform duration-1000 ease-out"
          style={{
            left: `${glyph.x}%`,
            top: `${glyph.y}%`,
            fontSize: `${glyph.size}px`,
            opacity: glyph.opacity,
            transform: `
              translateY(${scrollY * glyph.speed * -0.3}px)
              rotate(${glyph.rotation + scrollY * glyph.speed * 0.1}deg)
            `,
          }}
        >
          {glyph.char}
        </span>
      ))}
    </div>
  );
}
