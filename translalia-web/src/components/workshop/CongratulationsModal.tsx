"use client";

import * as React from "react";
import { CheckCircle2, Sparkles, X, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export interface CongratulationsModalProps {
  open: boolean;
  onClose: () => void;
  totalLines: number;
}

const actionButtonBase =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-medium transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

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
    className="absolute rounded-full opacity-0 animate-congrats-float-particle"
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
    className="absolute top-0 h-3 w-2 opacity-0 animate-congrats-confetti-fall"
    style={{
      left: `${left}%`,
      background: color,
      animationDelay: `${delay}s`,
      transform: `rotate(${rotation}deg)`,
      borderRadius: "1px",
    }}
  />
);

const PulseRing = ({ delay, size }: { delay: number; size: number }) => (
  <div
    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent/25 opacity-0 animate-congrats-ring-pulse"
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
  const t = useTranslations("Thread");
  const [mounted, setMounted] = React.useState(false);
  const [animationPhase, setAnimationPhase] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const timers = [
        setTimeout(() => setAnimationPhase(1), 50),
        setTimeout(() => setAnimationPhase(2), 200),
        setTimeout(() => setAnimationPhase(3), 400),
        setTimeout(() => setAnimationPhase(4), 600),
        setTimeout(() => setAnimationPhase(5), 800),
        setTimeout(() => setAnimationPhase(6), 1000),
        setTimeout(() => setAnimationPhase(7), 1200),
      ];
      return () => timers.forEach(clearTimeout);
    } else {
      setAnimationPhase(0);
      const timer = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const particles = React.useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        delay: 0.1 + Math.random() * 0.8,
        duration: 3 + Math.random() * 2,
        size: 4 + Math.random() * 5,
        color: [
          "rgba(2, 132, 199, 0.45)",
          "rgba(16, 185, 129, 0.4)",
          "rgba(245, 158, 11, 0.45)",
          "rgba(56, 189, 248, 0.4)",
        ][Math.floor(Math.random() * 4)],
        startX: Math.random() * 100,
        startY: 80 + Math.random() * 30,
      })),
    []
  );

  const confetti = React.useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        color: ["#0284C7", "#10B981", "#F59E0B", "#38BDF8", "#0EA5E9"][
          Math.floor(Math.random() * 5)
        ],
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
      <div
        className={cn(
          "absolute inset-0 bg-foreground/50 backdrop-blur-sm transition-opacity duration-500 ease-out",
          animationPhase >= 1 ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "relative w-full max-w-md transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          animationPhase >= 2
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-8 scale-95 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-accent/15 via-success/10 to-accent-light/20 blur-2xl transition-opacity duration-1000",
            animationPhase >= 3 ? "opacity-100" : "opacity-0"
          )}
        />

        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-accent via-accent-dark to-success" />

          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full p-2 text-foreground-muted transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {animationPhase >= 7 &&
              particles.map((p) => <FloatingParticle key={p.id} {...p} />)}
          </div>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {animationPhase >= 7 &&
              confetti.map((c) => <ConfettiPiece key={c.id} {...c} />)}
          </div>

          <div className="relative flex flex-col items-center px-6 pb-8 pt-11 text-center sm:px-10 sm:pb-10 sm:pt-14">
            <div className="relative mb-7 h-20 w-20 sm:mb-8 sm:h-24 sm:w-24">
              {animationPhase >= 3 && (
                <>
                  <PulseRing delay={0} size={140} />
                  <PulseRing delay={0.4} size={176} />
                  <PulseRing delay={0.8} size={212} />
                </>
              )}

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark shadow-lg shadow-accent/25 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  animationPhase >= 3
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-180 scale-0 opacity-0"
                )}
              >
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
                <CheckCircle2
                  className={cn(
                    "relative h-10 w-10 text-white drop-shadow-sm transition-all duration-500 delay-300 sm:h-12 sm:w-12",
                    animationPhase >= 3 ? "scale-100" : "scale-0"
                  )}
                  strokeWidth={2.5}
                />
              </div>

              {animationPhase >= 4 && (
                <>
                  <Sparkles
                    className="absolute -right-1 -top-1 h-5 w-5 animate-congrats-sparkle-float text-warning"
                    style={{ animationDelay: "0s" }}
                  />
                  <Sparkles
                    className="absolute -bottom-1 -left-2 h-4 w-4 animate-congrats-sparkle-float text-accent-light"
                    style={{ animationDelay: "0.3s" }}
                  />
                </>
              )}
            </div>

            <h2
              id="congrats-title"
              className={cn(
                "font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
                "transition-all duration-700 ease-out",
                animationPhase >= 4
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
            >
              {t("translationComplete")}
            </h2>

            <div
              className={cn(
                "mt-3 flex items-center justify-center gap-2",
                "transition-all duration-700 ease-out",
                animationPhase >= 4 ? "scale-100 opacity-100" : "scale-90 opacity-0"
              )}
            >
              <div className="h-px w-10 bg-gradient-to-r from-transparent to-border" />
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <div className="h-px w-10 bg-gradient-to-l from-transparent to-border" />
            </div>

            <div
              className={cn(
                "mt-5 w-full max-w-xs overflow-hidden rounded-xl border border-border-subtle bg-muted/60",
                "transition-all duration-700 ease-out",
                animationPhase >= 5
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-3 scale-[0.98] opacity-0"
              )}
            >
              <div className="grid grid-cols-2 divide-x divide-border-subtle">
                <div className="px-4 py-5">
                  <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
                    {totalLines}
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-foreground-muted">
                    {totalLines === 1
                      ? t("congratulationsLine")
                      : t("congratulationsLines")}
                  </div>
                </div>
                <div className="px-4 py-5">
                  <div className="bg-gradient-to-br from-success to-accent bg-clip-text font-mono text-3xl font-bold tabular-nums text-transparent">
                    100%
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-foreground-muted">
                    {t("congratulationsComplete")}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "mt-6 w-full max-w-sm space-y-1",
                "transition-all duration-700 ease-out",
                animationPhase >= 6
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
              )}
            >
              <p className="text-base leading-relaxed text-foreground-secondary">
                {t("congratulationsMessage")}
              </p>
              <p className="text-sm leading-relaxed text-foreground-muted">
                {t("congratulationsSubmessage")}
              </p>
            </div>

            <div
              className={cn(
                "mt-8 grid w-full max-w-sm grid-cols-1 gap-3 sm:grid-cols-2",
                "transition-all duration-700 ease-out",
                animationPhase >= 6
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
              )}
              style={{ transitionDelay: "100ms" }}
            >
              <Button
                onClick={onClose}
                size="lg"
                className={cn(actionButtonBase, "shadow-card hover:-translate-y-0.5")}
              >
                {t("congratulationsContinue")}
              </Button>

              <Link
                href="/diary"
                onClick={onClose}
                className={cn(
                  actionButtonBase,
                  "border border-border bg-surface text-foreground shadow-card",
                  "hover:-translate-y-0.5 hover:bg-muted"
                )}
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                <span>{t("viewYourDiary")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
