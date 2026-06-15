"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LineInfo, PipelineStats, PresetOption } from "./mockData";
import {
  focusRing,
  pillToggle,
  pillToggleActive,
  pillToggleContainer,
  pillToggleInactive,
} from "./uiClasses";

interface TranslationTuningLayoutProps {
  /** Locale-relative href back to the workshop thread. */
  backHref: string;
  poemTitle: string;
  lineInfo: LineInfo;
  stats: PipelineStats;
  presets: PresetOption[];
  children: React.ReactNode;
  /** Pinned to the bottom of the layout (e.g. the playback scrubber). */
  footer?: React.ReactNode;
}

export function TranslationTuningLayout({
  backHref,
  poemTitle,
  lineInfo,
  stats,
  presets,
  children,
  footer,
}: TranslationTuningLayoutProps) {
  const [preset, setPreset] = React.useState(presets[0]?.id ?? "");
  const [reasoningOn, setReasoningOn] = React.useState(false);

  // Coordinated entry: the three regions fade + rise together with a tight
  // 75ms cascade (header → context bar → main), settling within ~375ms. The
  // small upward translate makes it read as content arriving, not blinking on.
  // Under reduced motion the delays/transform drop out and it snaps in.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const entry = (delay: string) =>
    cn(
      "transition-[opacity,transform] duration-300 ease-smooth motion-reduce:transition-none motion-reduce:delay-0",
      delay,
      ready ? "opacity-100 translate-y-0" : "translate-y-1.5 opacity-0",
    );

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Header bar */}
      <header
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-surface px-6 py-3",
          entry("delay-0"),
        )}
      >
        <Link
          href={backHref}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent transition-colors duration-fast hover:underline",
            focusRing,
          )}
        >
          <ChevronLeft size={16} />
          Back to Workshop
        </Link>

        <span className="h-4 w-px bg-border-subtle" />

        <h1 className="text-base font-semibold text-foreground">
          Translation Tuning
        </h1>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          BETA
        </span>
        <span className="text-sm text-foreground-muted">Pipeline v2.1</span>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-foreground-muted">
              Preset
            </span>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="h-9 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            className={cn(
              "rounded-sm text-sm font-medium text-accent transition-colors duration-fast hover:underline",
              focusRing,
            )}
          >
            Save preset
          </button>

          <div className={pillToggleContainer}>
            <button
              type="button"
              onClick={() => setReasoningOn(true)}
              className={cn(
                pillToggle,
                reasoningOn ? pillToggleActive : pillToggleInactive,
              )}
            >
              Reasoning
            </button>
            <button
              type="button"
              onClick={() => setReasoningOn(false)}
              className={cn(
                pillToggle,
                !reasoningOn ? pillToggleActive : pillToggleInactive,
              )}
            >
              Off
            </button>
          </div>
        </div>
      </header>

      {/* Context / stats bar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border-subtle bg-surface px-6 py-3",
          entry("delay-75"),
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-foreground-muted">
            Translating
          </span>
          <span className="font-serif italic text-foreground">{poemTitle}</span>
          <span className="text-foreground-disabled">·</span>
          <span className="text-sm text-foreground-muted">
            Line {lineInfo.lineNumber} of {lineInfo.totalLines}
          </span>
          <span className="text-foreground-disabled">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
              {lineInfo.sourceLang}
            </span>
            <ChevronRight size={12} className="text-foreground-muted" />
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
              {lineInfo.targetLang}
            </span>
          </span>
          <span className="text-foreground-disabled">·</span>
          <span className="text-sm text-foreground-muted">
            Preset <span className="text-foreground">{lineInfo.preset}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <Stat label="Tokens" value={stats.totalTokens.toLocaleString()} />
          <Stat label="Cost" value={`~$${stats.estimatedCost.toFixed(2)}`} />
          <Stat label="Time" value={`${stats.timeSeconds}s`} />
          <Stat label="Model" value={stats.model} />
        </div>
      </div>

      {/* Main content area */}
      <main
        className={cn("flex-1 overflow-y-auto px-6 pb-16", entry("delay-150"))}
      >
        {children}
      </main>

      {/* Pinned footer (playback scrubber) */}
      {footer}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className="text-sm font-mono text-foreground">{value}</span>
    </div>
  );
}
