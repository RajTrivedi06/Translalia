"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    id: "source",
    title: "Source",
    description: "Your original text, rich with meaning and nuance",
    icon: "📜",
  },
  {
    id: "choices",
    title: "Choices",
    description: "Explore multiple paths, each with its own voice",
    icon: "🔀",
  },
  {
    id: "assembly",
    title: "Assembly",
    description: "Craft your version with intention and care",
    icon: "✨",
  },
];

export function TranslationJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [lineProgress, setLineProgress] = useState(0);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    // Animate line drawing
    const lineTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setLineProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 30);
      return () => clearInterval(interval);
    }, 300);

    // Animate steps
    const stepTimers = steps.map((_, index) =>
      setTimeout(() => setActiveStep(index), 500 + index * 600)
    );

    return () => {
      clearTimeout(lineTimer);
      stepTimers.forEach(clearTimeout);
    };
  }, [isInView]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 to-white p-8 shadow-lg ring-1 ring-slate-200 sm:p-12"
    >
      {/* Background decoration */}
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-sky-100 opacity-50 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-blue-100 opacity-50 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            The Translation Journey
          </p>
          <h3 className="font-serif text-2xl text-slate-900 sm:text-3xl">
            From source to your unique voice
          </h3>
        </div>

        {/* Journey stepper */}
        <div className="relative flex items-center justify-between">
          {/* Connecting line (background) */}
          <div className="absolute left-[10%] right-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-slate-200" />

          {/* Animated line */}
          <div
            className="absolute left-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-300 ease-out"
            style={{ width: `${lineProgress * 0.8}%` }}
          />

          {/* Steps */}
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`relative z-10 flex flex-col items-center transition-all duration-500 ${
                index <= activeStep ? "opacity-100" : "opacity-30"
              }`}
              style={{
                transform: index <= activeStep ? "translateY(0)" : "translateY(10px)",
              }}
            >
              {/* Step circle */}
              <div
                className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg transition-all duration-500 sm:h-20 sm:w-20 sm:text-3xl ${
                  index <= activeStep
                    ? "bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sky-200"
                    : "bg-white text-slate-400"
                }`}
              >
                {step.icon}
              </div>

              {/* Step content */}
              <div className="text-center">
                <h4
                  className={`mb-1 text-sm font-semibold transition-colors duration-500 sm:text-base ${
                    index <= activeStep ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.title}
                </h4>
                <p className="hidden max-w-[120px] text-xs text-slate-500 sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow indicators */}
        <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
          <span className="text-sm">Scroll to explore</span>
          <svg
            className="h-4 w-4 animate-bounce"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
