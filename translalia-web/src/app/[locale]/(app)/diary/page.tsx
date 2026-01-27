"use client";

import * as React from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import {
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Target,
  AlertCircle,
  ArrowRight,
  FileText,
  StickyNote,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DiaryEntry = {
  thread_id: string;
  title: string;
  thread_created_at: string;
  raw_poem: string | null;
  workshop_lines: Array<{
    original: string;
    translated: string;
    completedAt?: string;
  } | null>;
  notebook_notes: {
    thread_note?: string | null;
    line_notes?: Record<number, string>;
  } | null;
  journey_summary_created_at: string | null;
  reflection_text: string | null;
  insights: string[] | null;
  strengths: string[] | null;
  challenges: string[] | null;
  recommendations: string[] | null;
};

type DiaryResponse = {
  ok: boolean;
  items: DiaryEntry[];
  nextCursor?: {
    beforeCreatedAt: string;
    beforeId: string;
  };
};

// Expandable section component
function ExpandableSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  variant = "default",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "highlight";
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl transition-all duration-300",
        variant === "highlight"
          ? "bg-gradient-to-br from-amber-50/80 to-orange-50/60 ring-1 ring-amber-200/60"
          : "bg-muted/80 ring-1 ring-border-subtle/60"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors",
          variant === "highlight"
            ? "hover:bg-warning-light/40"
            : "hover:bg-muted/60"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 flex-shrink-0",
            variant === "highlight" ? "text-warning" : "text-foreground-muted"
          )}
        />
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            variant === "highlight" ? "text-foreground" : "text-foreground-secondary"
          )}
        >
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180",
            variant === "highlight" ? "text-warning" : "text-foreground-muted"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Individual poem entry card
function PoemEntry({ entry, t }: { entry: DiaryEntry; t: (key: string) => string }) {
  const [expanded, setExpanded] = React.useState(false);
  const validLines = entry.workshop_lines?.filter(
    (line): line is NonNullable<typeof line> => line !== null
  ) || [];

  const hasNotes =
    entry.notebook_notes?.thread_note ||
    (entry.notebook_notes?.line_notes &&
      Object.keys(entry.notebook_notes.line_notes).length > 0);

  const hasJourney = entry.journey_summary_created_at;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-white transition-all duration-500",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
        "hover:shadow-[0_4px_20px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.04)]",
        "ring-1 ring-border-subtle/80"
      )}
    >
      {/* Decorative accent */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 via-orange-400 to-rose-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <header className="border-b border-border-subtle px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-medium tracking-tight text-foreground md:text-2xl">
              {entry.title || "Untitled Poem"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(entry.thread_created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {validLines.length} lines
              </span>
              {hasJourney && (
                <span className="flex items-center gap-1.5 text-warning">
                  <Sparkles className="h-3.5 w-3.5" />
                  Journey reviewed
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              expanded
                ? "bg-accent text-white"
                : "bg-muted text-foreground-secondary hover:bg-border-subtle"
            )}
          >
            {expanded ? "Collapse" : "View"}
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          </button>
        </div>
      </header>

      {/* Expanded content */}
      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-6 px-8 py-6">
            {/* Side-by-side translation view */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-foreground-muted" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
                  Translation
                </h3>
              </div>

              {/* Column headers */}
              <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  {t("originalText")}
                </div>
                <div className="hidden text-xs font-medium uppercase tracking-wider text-foreground-muted md:block">
                  {t("translatedText")}
                </div>
              </div>

              {/* Lines - side by side */}
              <div className="space-y-3">
                {validLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "group/line grid grid-cols-1 gap-4 rounded-xl p-4 transition-colors md:grid-cols-2",
                      "bg-gradient-to-r from-stone-50/80 to-transparent",
                      "hover:from-amber-50/60 hover:to-orange-50/30"
                    )}
                  >
                    {/* Original */}
                    <div className="relative">
                      <span className="absolute -left-2 top-0 font-mono text-xs text-stone-300">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="pl-4 font-serif text-base leading-relaxed text-foreground-secondary md:text-lg">
                        {line.original}
                      </p>
                    </div>

                    {/* Mobile label for translated */}
                    <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted md:hidden">
                      {t("translatedText")}
                    </div>

                    {/* Translated */}
                    <div className="relative md:border-l md:border-stone-200 md:pl-4">
                      <p className="font-serif text-base font-medium leading-relaxed text-foreground md:text-lg">
                        {line.translated}
                      </p>
                    </div>

                    {/* Line note indicator */}
                    {entry.notebook_notes?.line_notes?.[idx] && (
                      <div className="col-span-full mt-2 flex items-start gap-2 rounded-lg bg-amber-50/80 p-3 text-sm text-amber-800">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
                        <span className="italic">
                          {entry.notebook_notes.line_notes[idx]}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Notes section */}
            {hasNotes && (
              <ExpandableSection
                title={t("notes")}
                icon={StickyNote}
                defaultOpen={false}
              >
                {entry.notebook_notes?.thread_note && (
                  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-border-subtle/60">
                    <p className="font-serif text-base leading-relaxed text-foreground-secondary">
                      {entry.notebook_notes.thread_note}
                    </p>
                  </div>
                )}
              </ExpandableSection>
            )}

            {/* Journey Summary */}
            {hasJourney && (
              <ExpandableSection
                title={t("journeySummary")}
                icon={Sparkles}
                variant="highlight"
                defaultOpen={true}
              >
                <div className="space-y-4">
                  {/* Reflection */}
                  {entry.reflection_text && (
                    <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                      <p className="font-serif text-base leading-relaxed text-foreground-secondary">
                        {entry.reflection_text}
                      </p>
                    </div>
                  )}

                  {/* Insights grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {entry.insights && entry.insights.length > 0 && (
                      <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-700">
                          <Lightbulb className="h-4 w-4" />
                          {t("insights")}
                        </div>
                        <ul className="space-y-2">
                          {entry.insights.map((insight, idx) => (
                            <li
                              key={idx}
                              className="flex gap-2 text-sm text-foreground-secondary"
                            >
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.strengths && entry.strengths.length > 0 && (
                      <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
                          <Target className="h-4 w-4" />
                          {t("strengths")}
                        </div>
                        <ul className="space-y-2">
                          {entry.strengths.map((strength, idx) => (
                            <li
                              key={idx}
                              className="flex gap-2 text-sm text-foreground-secondary"
                            >
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.challenges && entry.challenges.length > 0 && (
                      <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-rose-700">
                          <AlertCircle className="h-4 w-4" />
                          {t("challenges")}
                        </div>
                        <ul className="space-y-2">
                          {entry.challenges.map((challenge, idx) => (
                            <li
                              key={idx}
                              className="flex gap-2 text-sm text-foreground-secondary"
                            >
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                              {challenge}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.recommendations && entry.recommendations.length > 0 && (
                      <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-700">
                          <Sparkles className="h-4 w-4" />
                          {t("recommendations")}
                        </div>
                        <ul className="space-y-2">
                          {entry.recommendations.map((rec, idx) => (
                            <li
                              key={idx}
                              className="flex gap-2 text-sm text-foreground-secondary"
                            >
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </ExpandableSection>
            )}

            {/* Original poem (collapsible) */}
            {entry.raw_poem && (
              <ExpandableSection
                title={`${t("originalText")} (Full)`}
                icon={FileText}
              >
                <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground-secondary">
                  {entry.raw_poem}
                </pre>
              </ExpandableSection>
            )}
          </div>
        </div>
      </div>

      {/* Preview when collapsed */}
      {!expanded && validLines.length > 0 && (
        <div className="border-t border-border-subtle px-8 py-4">
          <p className="truncate font-serif text-sm italic text-foreground-muted">
            "{validLines[0].translated}"
            {validLines.length > 1 && "..."}
          </p>
        </div>
      )}
    </article>
  );
}

export default function DiaryPage() {
  const t = useTranslations("Diary");
  const tCommon = useTranslations("Common");
  const tNav = useTranslations("Navigation");
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseUser();
  const [cursor, setCursor] = React.useState<{
    beforeCreatedAt: string;
    beforeId: string;
  } | null>(null);
  const [allItems, setAllItems] = React.useState<DiaryEntry[]>([]);

  const { data, isLoading, error, refetch } = useQuery<DiaryResponse>({
    queryKey: ["diary-completed-poems", cursor],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const params = new URLSearchParams({
        limit: "20",
      });
      if (cursor) {
        params.set("beforeCreatedAt", cursor.beforeCreatedAt);
        params.set("beforeId", cursor.beforeId);
      }
      const res = await fetch(`/api/diary/completed-poems?${params}`, {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to fetch completed poems");
      }
      return res.json();
    },
  });

  // Accumulate items when new data arrives
  React.useEffect(() => {
    if (data?.items) {
      if (cursor === null) {
        setAllItems(data.items);
      } else {
        setAllItems((prev) => [...prev, ...data.items]);
      }
    }
  }, [data, cursor]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/sign-in?redirect=/diary");
    }
  }, [authLoading, user, router]);

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const hasMore = !!data?.nextCursor;

  // Loading state
  if (authLoading || (isLoading && allItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
        <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-br from-amber-200 to-orange-200" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-warning" />
            </div>
            <p className="text-sm text-foreground-muted">Loading your translations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
        <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-6 px-4">
          <div className="rounded-2xl bg-rose-50 p-6 text-center ring-1 ring-rose-200">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
            <p className="mb-4 text-rose-700">
              {(error as Error).message || tCommon("error")}
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-100"
            >
              {tCommon("retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-stone-50 to-orange-50/30">
      {/* Hero header */}
      <header className="relative overflow-hidden border-b border-stone-200/60 bg-white/60 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-warning">
                {t("title")}
              </p>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-5xl">
                {t("heading")}
              </h1>
              {allItems.length > 0 && (
                <p className="mt-3 text-foreground-muted">
                  {allItems.length} completed translation{allItems.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <BookOpen className="hidden h-12 w-12 text-stone-300 sm:block" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-white/50 px-6 py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <BookOpen className="h-8 w-8 text-foreground-muted" />
            </div>
            <h2 className="mb-2 font-serif text-xl font-medium text-foreground-secondary">
              No completed translations yet
            </h2>
            <p className="mb-6 max-w-sm text-sm text-foreground-muted">
              {t("noCompletedPoems")}
            </p>
            <Button
              onClick={() => router.push("/workspaces")}
              className="bg-accent text-white hover:bg-stone-800"
            >
              {tNav("workspaces")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {allItems.map((entry) => (
              <PoemEntry key={entry.thread_id} entry={entry} t={t} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="rounded-full border-stone-300 px-8 text-foreground-secondary hover:bg-muted"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tCommon("loading")}
                    </>
                  ) : (
                    <>
                      {t("loadMore")}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer accent */}
      <div className="h-32 bg-gradient-to-t from-orange-50/60 to-transparent" />
    </div>
  );
}