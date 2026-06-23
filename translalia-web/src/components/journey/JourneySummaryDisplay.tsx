"use client";

import * as React from "react";
import {
  Check,
  Lightbulb,
  Target,
  AlertCircle,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export interface JourneySummaryData {
  reflection?: string | null;
  insights?: string[] | null;
  strengths?: string[] | null;
  challenges?: string[] | null;
  recommendations?: string[] | null;
}

export interface JourneySummaryLabels {
  atAGlance: string;
  overview: string;
  readMore: string;
  readLess: string;
  keyInsights: string;
  strengths: string;
  challenges: string;
  toExploreFurther: string;
}

const OVERVIEW_CLAMP_CHARS = 320;

interface JourneyCategoryConfig {
  id: string;
  titleKey: keyof Pick<
    JourneySummaryLabels,
    "keyInsights" | "strengths" | "challenges" | "toExploreFurther"
  >;
  items: string[];
  icon: React.ElementType;
  chipClass: string;
  iconClass: string;
  itemBullet: React.ReactNode;
}

function JourneyCategoryList({
  items,
  bullet,
  listId,
}: {
  items: string[];
  bullet: React.ReactNode;
  listId: string;
}) {
  return (
    <ul id={listId} className="space-y-2.5" role="list">
      {items.map((item, idx) => (
        <li
          key={idx}
          className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground-secondary"
        >
          <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
            {bullet}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function JourneySummaryDisplay({
  data,
  labels,
  className,
  emptyMessage = "No reflection text returned.",
  hideWhenEmpty = false,
  density = "comfortable",
}: {
  data: JourneySummaryData;
  labels: JourneySummaryLabels;
  className?: string;
  emptyMessage?: string;
  hideWhenEmpty?: boolean;
  /** `compact` tightens spacing for narrow sidebars (editing rail). */
  density?: "comfortable" | "compact";
}) {
  const overviewId = React.useId();
  const glanceId = React.useId();
  const [overviewExpanded, setOverviewExpanded] = React.useState(false);

  const insights = (data.insights ?? []).filter((item) => item?.trim());
  const strengths = (data.strengths ?? []).filter((item) => item?.trim());
  const challenges = (data.challenges ?? []).filter((item) => item?.trim());
  const recommendations = (data.recommendations ?? []).filter((item) =>
    item?.trim()
  );
  const reflection = data.reflection?.trim() ?? "";

  const categories: JourneyCategoryConfig[] = [
    {
      id: "insights",
      titleKey: "keyInsights",
      items: insights,
      icon: Lightbulb,
      chipClass:
        "border-accent/20 bg-accent/5 text-foreground-secondary",
      iconClass: "bg-accent/10 text-accent",
      itemBullet: <span className="text-accent font-medium">•</span>,
    },
    {
      id: "strengths",
      titleKey: "strengths",
      items: strengths,
      icon: Target,
      chipClass:
        "border-success/20 bg-success/5 text-foreground-secondary",
      iconClass: "bg-success/10 text-success",
      itemBullet: <Check className="h-3.5 w-3.5 text-success" aria-hidden />,
    },
    {
      id: "challenges",
      titleKey: "challenges",
      items: challenges,
      icon: AlertCircle,
      chipClass:
        "border-warning/25 bg-warning/5 text-foreground-secondary",
      iconClass: "bg-warning/10 text-warning",
      itemBullet: (
        <span className="text-xs font-semibold text-warning" aria-hidden>
          !
        </span>
      ),
    },
    {
      id: "recommendations",
      titleKey: "toExploreFurther",
      items: recommendations,
      icon: Sparkles,
      chipClass:
        "border-card-amber-border bg-card-amber-bg/40 text-foreground-secondary",
      iconClass: "bg-card-amber-bg text-warning",
      itemBullet: <span className="text-warning" aria-hidden>→</span>,
    },
  ];

  const activeCategories = categories.filter((cat) => cat.items.length > 0);
  const hasBullets = activeCategories.length > 0;
  const overviewIsLong = reflection.length > OVERVIEW_CLAMP_CHARS;
  const showOverviewClamp = overviewIsLong && !overviewExpanded;
  const overviewPreview = showOverviewClamp
    ? `${reflection.slice(0, OVERVIEW_CLAMP_CHARS).trim()}…`
    : reflection;

  if (!reflection && !hasBullets) {
    if (hideWhenEmpty) return null;
    return (
      <p className={cn("text-sm text-foreground-muted", className)}>
        {emptyMessage}
      </p>
    );
  }

  const isCompact = density === "compact";
  const defaultAccordionValue = activeCategories[0]?.id;

  return (
    <section
      className={cn(isCompact ? "space-y-3" : "space-y-4", className)}
      aria-labelledby={glanceId}
    >
      {hasBullets && (
        <div>
          <p
            id={glanceId}
            className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted"
          >
            {labels.atAGlance}
          </p>
          <div
            className="flex flex-wrap gap-1.5"
            role="list"
            aria-label={labels.atAGlance}
          >
            {activeCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <span
                  key={cat.id}
                  role="listitem"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    cat.chipClass
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" aria-hidden />
                  <span>{labels[cat.titleKey]}</span>
                  <span
                    className="rounded-full bg-surface/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground-muted"
                    aria-label={`${cat.items.length} items`}
                  >
                    {cat.items.length}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {reflection && (
        <div
          className={cn(
            "rounded-xl border border-border-subtle bg-surface/60",
            isCompact ? "p-3.5" : "p-4 sm:p-5"
          )}
        >
          <h4
            className={cn(
              "mb-2 font-medium text-foreground",
              isCompact ? "text-sm" : "text-sm sm:text-base"
            )}
          >
            {labels.overview}
          </h4>
          <p
            id={overviewId}
            className={cn(
              "text-sm leading-relaxed text-foreground-secondary",
              !isCompact && "sm:text-[0.9375rem] sm:leading-[1.7]",
              showOverviewClamp && "line-clamp-4"
            )}
          >
            {overviewPreview}
          </p>
          {overviewIsLong && (
            <button
              type="button"
              onClick={() => setOverviewExpanded((v) => !v)}
              aria-expanded={overviewExpanded}
              aria-controls={overviewId}
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent",
                "rounded-md transition-colors hover:text-accent-dark",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              )}
            >
              {overviewExpanded ? labels.readLess : labels.readMore}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-fast",
                  overviewExpanded && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          )}
        </div>
      )}

      {hasBullets && (
        <Accordion
          type="single"
          collapsible
          defaultValue={defaultAccordionValue}
          className="rounded-xl border border-border-subtle bg-surface/40"
        >
          {activeCategories.map((cat) => {
            const Icon = cat.icon;
            const listId = `${cat.id}-list`;
            return (
              <AccordionItem
                key={cat.id}
                value={cat.id}
                className="border-border-subtle px-1 first:rounded-t-xl last:rounded-b-xl last:border-b-0"
              >
                <AccordionTrigger
                  className={cn(
                    "gap-3 py-3 text-left text-sm hover:no-underline",
                    isCompact ? "px-3" : "px-4"
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
                        cat.iconClass
                      )}
                      aria-hidden
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 font-medium text-foreground">
                      {labels[cat.titleKey]}
                    </span>
                    <span className="ml-auto flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground-muted">
                      {cat.items.length}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className={isCompact ? "px-3" : "px-4"}>
                  <JourneyCategoryList
                    items={cat.items}
                    bullet={cat.itemBullet}
                    listId={listId}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </section>
  );
}
