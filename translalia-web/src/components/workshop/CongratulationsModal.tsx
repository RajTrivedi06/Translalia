"use client";

import * as React from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CongratulationsModalProps {
  open: boolean;
  onClose: () => void;
  totalLines: number;
}

// Particle component for floating elements
const FloatingParticle = ({
  delay,
  duration,
  size,
  color,
  startX,
  startY,
}: {
  delay: number;
  duration: number;
  size: number;
  color: string;
  startX: number;
  startY: number;
}) => (
  <div
    className="absolute rounded-full opacity-0 animate-float-particle"
    style={{
      width: size,
      height: size,
      background: color,
      left: `${startX}%`,
      top: `${startY}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      filter: "blur(0.5px)",
    }}
  />
);

// Confetti piece component
const ConfettiPiece = ({
  delay,
  color,
  left,
  rotation,
}: {
  delay: number;
  color: string;
  left: number;
  rotation: number;
}) => (
  <div
    className="absolute top-0 w-2 h-3 opacity-0 animate-confetti-fall"
    style={{
      left: `${left}%`,
      background: color,
      animationDelay: `${delay}s`,
      transform: `rotate(${rotation}deg)`,
      borderRadius: "1px",
    }}
  />
);

// Ring pulse component
const PulseRing = ({ delay, size }: { delay: number; size: number }) => (
  <div
    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400/30 opacity-0 animate-ring-pulse"
    style={{
      width: size,
      height: size,
      animationDelay: `${delay}s`,
    }}
  />
);

export function CongratulationsModal({
  open,
  onClose,
  totalLines,
}: CongratulationsModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [animationPhase, setAnimationPhase] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      // Orchestrated animation phases
      const timers = [
        setTimeout(() => setAnimationPhase(1), 50), // Backdrop
        setTimeout(() => setAnimationPhase(2), 200), // Modal container
        setTimeout(() => setAnimationPhase(3), 400), // Icon
        setTimeout(() => setAnimationPhase(4), 600), // Title
        setTimeout(() => setAnimationPhase(5), 800), // Stats
        setTimeout(() => setAnimationPhase(6), 1000), // Message & button
        setTimeout(() => setAnimationPhase(7), 1200), // Particles & confetti
      ];
      return () => timers.forEach(clearTimeout);
    } else {
      setAnimationPhase(0);
      const timer = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Generate particles
  const particles = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        delay: 0.1 + Math.random() * 0.8,
        duration: 3 + Math.random() * 2,
        size: 4 + Math.random() * 6,
        color: [
          "rgba(251, 191, 36, 0.6)", // Amber
          "rgba(167, 139, 250, 0.5)", // Purple
          "rgba(96, 165, 250, 0.5)", // Blue
          "rgba(52, 211, 153, 0.5)", // Green
        ][Math.floor(Math.random() * 4)],
        startX: Math.random() * 100,
        startY: 80 + Math.random() * 30,
      })),
    []
  );

  // Generate confetti
  const confetti = React.useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        color: [
          "#FBBF24",
          "#A78BFA",
          "#60A5FA",
          "#34D399",
          "#F472B6",
          "#FB923C",
        ][Math.floor(Math.random() * 6)],
        left: 10 + Math.random() * 80,
        rotation: Math.random() * 360,
      })),
    []
  );

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="congrats-title"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-700 ease-out",
          "bg-gradient-to-br from-slate-900/60 via-slate-800/60 to-slate-900/60",
          "backdrop-blur-md",
          animationPhase >= 1 ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={cn(
          "relative w-full max-w-lg",
          "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          animationPhase >= 2
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect behind card */}
        <div
          className={cn(
            "absolute -inset-4 rounded-[2.5rem] transition-opacity duration-1000",
            "bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20",
            "blur-2xl",
            animationPhase >= 3 ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Main Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl shadow-2xl border border-white/20">
          {/* Subtle noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Decorative top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500" />

          {/* Close button */}
          <button
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4 z-10 p-2 rounded-full",
              "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-slate-300"
            )}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {animationPhase >= 7 &&
              particles.map((p) => <FloatingParticle key={p.id} {...p} />)}
          </div>

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {animationPhase >= 7 &&
              confetti.map((c) => <ConfettiPiece key={c.id} {...c} />)}
          </div>

          {/* Content */}
          <div className="relative px-8 pt-12 pb-10 sm:px-12 sm:pt-16 sm:pb-12">
            {/* Success Icon with rings */}
            <div className="relative mx-auto mb-8 w-24 h-24 sm:w-28 sm:h-28">
              {/* Pulse rings */}
              {animationPhase >= 3 && (
                <>
                  <PulseRing delay={0} size={160} />
                  <PulseRing delay={0.4} size={200} />
                  <PulseRing delay={0.8} size={240} />
                </>
              )}

              {/* Icon container */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full",
                  "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500",
                  "shadow-lg shadow-amber-500/30",
                  "flex items-center justify-center",
                  "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  animationPhase >= 3
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-0 -rotate-180 opacity-0"
                )}
              >
                {/* Inner glow */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/30 to-transparent" />

                <CheckCircle2
                  className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 text-white drop-shadow-md",
                    "transition-all duration-500 delay-300",
                    animationPhase >= 3 ? "scale-100" : "scale-0"
                  )}
                  strokeWidth={2.5}
                />
              </div>

              {/* Floating sparkles around icon */}
              {animationPhase >= 4 && (
                <>
                  <Sparkles
                    className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-sparkle-float"
                    style={{ animationDelay: "0s" }}
                  />
                  <Sparkles
                    className="absolute -bottom-1 -left-3 w-5 h-5 text-purple-400 animate-sparkle-float"
                    style={{ animationDelay: "0.3s" }}
                  />
                  <Sparkles
                    className="absolute top-0 -left-4 w-4 h-4 text-blue-400 animate-sparkle-float"
                    style={{ animationDelay: "0.6s" }}
                  />
                </>
              )}
            </div>

            {/* Title */}
            <h2
              id="congrats-title"
              className={cn(
                "text-center text-3xl sm:text-4xl font-semibold tracking-tight",
                "text-slate-800",
                "transition-all duration-700 ease-out",
                animationPhase >= 4
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              )}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                transitionDelay: animationPhase >= 4 ? "0ms" : "0ms",
              }}
            >
              Translation Complete
            </h2>

            {/* Decorative divider */}
            <div
              className={cn(
                "mx-auto mt-4 mb-6 flex items-center justify-center gap-3",
                "transition-all duration-700 ease-out",
                animationPhase >= 4 ? "opacity-100 scale-100" : "opacity-0 scale-75"
              )}
              style={{ transitionDelay: "100ms" }}
            >
              <div className="w-12 h-px bg-gradient-to-r from-transparent to-slate-300" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <div className="w-12 h-px bg-gradient-to-l from-transparent to-slate-300" />
            </div>

            {/* Stats Card */}
            <div
              className={cn(
                "relative mx-auto max-w-xs rounded-2xl",
                "bg-gradient-to-br from-slate-50 to-slate-100",
                "border border-slate-200/80",
                "shadow-sm",
                "transition-all duration-700 ease-out",
                animationPhase >= 5
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              )}
            >
              <div className="px-8 py-6">
                <div className="flex items-center justify-center gap-8">
                  {/* Lines count */}
                  <div className="text-center">
                    <div
                      className={cn(
                        "text-4xl font-bold tabular-nums",
                        "bg-gradient-to-br from-slate-700 to-slate-900 bg-clip-text text-transparent"
                      )}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {totalLines}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                      {totalLines === 1 ? "Line" : "Lines"}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-12 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent" />

                  {/* Completion */}
                  <div className="text-center">
                    <div
                      className={cn(
                        "text-4xl font-bold tabular-nums",
                        "bg-gradient-to-br from-emerald-500 to-teal-600 bg-clip-text text-transparent"
                      )}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      100%
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Complete
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            <p
              className={cn(
                "mt-6 text-center text-base sm:text-lg text-slate-600 leading-relaxed",
                "transition-all duration-700 ease-out",
                animationPhase >= 6
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              )}
            >
              Your translation is ready for review.
              <br className="hidden sm:block" />
              <span className="text-slate-500">
                Take a moment to refine your work or share it.
              </span>
            </p>

            {/* Action Buttons */}
            <div
              className={cn(
                "mt-8 flex flex-col sm:flex-row items-center justify-center gap-3",
                "transition-all duration-700 ease-out",
                animationPhase >= 6
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: "100ms" }}
            >
              <Button
                onClick={onClose}
                size="lg"
                className={cn(
                  "relative overflow-hidden group",
                  "px-8 py-3 h-auto text-base font-medium",
                  "bg-gradient-to-r from-slate-800 to-slate-900",
                  "hover:from-slate-700 hover:to-slate-800",
                  "text-white shadow-lg shadow-slate-900/20",
                  "transition-all duration-300",
                  "hover:shadow-xl hover:shadow-slate-900/30",
                  "hover:-translate-y-0.5",
                  "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                )}
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="relative">Continue to Review</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=JetBrains+Mono:wght@600&display=swap");

        @keyframes float-particle {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0);
          }
          10% {
            opacity: 1;
            transform: translateY(-20px) scale(1);
          }
          90% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(0.5) rotate(180deg);
          }
        }

        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(-20px) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(400px) rotate(720deg);
          }
        }

        @keyframes ring-pulse {
          0% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
          }
        }

        @keyframes sparkle-float {
          0%,
          100% {
            opacity: 0.7;
            transform: translateY(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: translateY(-8px) rotate(10deg);
          }
        }

        .animate-float-particle {
          animation: float-particle ease-out forwards;
        }

        .animate-confetti-fall {
          animation: confetti-fall 2.5s ease-in forwards;
        }

        .animate-ring-pulse {
          animation: ring-pulse 2s ease-out infinite;
        }

        .animate-sparkle-float {
          animation: sparkle-float 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
