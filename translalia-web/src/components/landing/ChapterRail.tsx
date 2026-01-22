"use client";

import { useEffect, useState } from "react";

interface Chapter {
  id: string;
  number: string;
  label: string;
}

const chapters: Chapter[] = [
  { id: "hero", number: "01", label: "Intro" },
  { id: "problem", number: "02", label: "Problem" },
  { id: "voice", number: "03", label: "Voice" },
  { id: "solution", number: "04", label: "Solution" },
  { id: "craft", number: "05", label: "Craft" },
  { id: "cta", number: "06", label: "Start" },
];

export function ChapterRail() {
  const [activeChapter, setActiveChapter] = useState("hero");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show rail after scrolling past hero
      setIsVisible(window.scrollY > 200);

      // Find active chapter based on scroll position
      const sections = chapters.map((ch) => ({
        id: ch.id,
        element: document.getElementById(ch.id),
      }));

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= window.innerHeight / 2) {
            setActiveChapter(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToChapter = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed left-4 top-1/2 z-50 -translate-y-1/2 transition-all duration-500 sm:left-6 lg:left-8 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-label="Page sections"
    >
      <ul className="flex flex-col gap-3">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <button
              onClick={() => scrollToChapter(chapter.id)}
              className={`group flex items-center gap-2 transition-all duration-300 ${
                activeChapter === chapter.id
                  ? "text-sky-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              aria-current={activeChapter === chapter.id ? "true" : undefined}
            >
              {/* Number indicator */}
              <span
                className={`font-mono text-xs font-medium transition-all duration-300 ${
                  activeChapter === chapter.id
                    ? "scale-110 text-sky-600"
                    : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {chapter.number}
              </span>

              {/* Connecting line */}
              <span
                className={`h-px transition-all duration-300 ${
                  activeChapter === chapter.id
                    ? "w-6 bg-sky-600"
                    : "w-3 bg-slate-300 group-hover:w-5 group-hover:bg-slate-400"
                }`}
              />

              {/* Label - only visible on hover or active */}
              <span
                className={`text-xs font-medium transition-all duration-300 ${
                  activeChapter === chapter.id
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                }`}
              >
                {chapter.label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Progress line */}
      <div className="absolute -left-2 top-0 h-full w-px bg-slate-200">
        <div
          className="w-full bg-sky-500 transition-all duration-300"
          style={{
            height: `${(chapters.findIndex((c) => c.id === activeChapter) + 1) / chapters.length * 100}%`,
          }}
        />
      </div>
    </nav>
  );
}
