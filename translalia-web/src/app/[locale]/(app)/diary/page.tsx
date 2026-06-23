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
  AlertCircle,
  ArrowRight,
  FileText,
  Calendar,
  PenLine,
  Music2,
  Download,
  Printer,
} from "lucide-react";
import { JourneySummaryDisplay } from "@/components/journey/JourneySummaryDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  DiaryEntry,
  DiaryExportLabels,
  DiaryRefineRhyme,
  DiaryResponse,
  DiaryTranslationInsights,
} from "@/lib/diary/types";
import {
  exportEntryAsPdf,
  exportEntryAsTxt,
  getLineNoteEntries,
  getValidLines,
  hasJourneyContent,
  hasNotesAndReflection,
  hasRefineRhymeData,
  hasTranslationInsightsData,
} from "@/lib/diary/exportEntry";

const DIARY_SECTIONS = [
  { key: "translation", icon: BookOpen, variant: "default" as const },
  { key: "refineRhyme", icon: Music2, variant: "teal" as const },
  { key: "translationInsights", icon: Lightbulb, variant: "blue" as const },
  { key: "journeySummary", icon: Sparkles, variant: "purple" as const },
  { key: "notesAndReflection", icon: PenLine, variant: "amber" as const },
] as const;

type SectionVariant = "default" | "teal" | "blue" | "amber" | "purple";

const VARIANT_STYLES: Record<
  SectionVariant,
  { container: string; icon: string; hover: string }
> = {
  default: {
    container: "bg-muted/80 ring-1 ring-border-subtle/60",
    icon: "text-foreground-muted",
    hover: "hover:bg-muted/60",
  },
  teal: {
    container:
      "bg-gradient-to-br from-teal-50/80 to-emerald-50/50 ring-1 ring-teal-200/60",
    icon: "text-teal-700",
    hover: "hover:bg-teal-50/60",
  },
  blue: {
    container:
      "bg-gradient-to-br from-blue-50/80 to-indigo-50/50 ring-1 ring-blue-200/60",
    icon: "text-blue-700",
    hover: "hover:bg-blue-50/60",
  },
  amber: {
    container:
      "bg-gradient-to-br from-amber-50/80 to-orange-50/60 ring-1 ring-amber-200/60",
    icon: "text-warning",
    hover: "hover:bg-warning-light/40",
  },
  purple: {
    container:
      "bg-gradient-to-br from-card-purple-bg/70 to-surface/60 ring-1 ring-card-purple-border/70",
    icon: "text-accent",
    hover: "hover:bg-card-purple-bg/50",
  },
};

function DiarySection({
  id,
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  variant = "default",
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: SectionVariant;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const styles = VARIANT_STYLES[variant];

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-2xl transition-all duration-300",
        styles.container
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors",
          styles.hover
        )}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", styles.icon)} />
        <span className="flex-1 text-sm font-medium text-foreground-secondary">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180",
            styles.icon
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
          <div id={`${id}-content`} className="px-5 pb-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionNav({
  threadId,
  t,
  onJump,
}: {
  threadId: string;
  t: (key: string) => string;
  onJump: (sectionId: string) => void;
}) {
  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border-subtle pb-4"
      aria-label={t("sectionNav")}
    >
      {DIARY_SECTIONS.map(({ key }) => (
        <button
          key={key}
          type="button"
          onClick={() => onJump(`section-${key}-${threadId}`)}
          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground-secondary transition-colors hover:bg-border-subtle hover:text-foreground"
        >
          {t(key)}
        </button>
      ))}
    </nav>
  );
}

function RefineRhymeContent({
  refineRhyme,
  t,
}: {
  refineRhyme: DiaryRefineRhyme | null;
  t: (key: string) => string;
}) {
  if (!hasRefineRhymeData(refineRhyme)) return null;

  const r = refineRhyme!;

  return (
    <div className="space-y-4">
      {r.formalFeatures && (
        <div className="space-y-3 rounded-xl bg-white/80 p-4 shadow-sm">
          {r.formalFeatures.rhymeScheme && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-teal-700 text-sm">{r.formalFeatures.rhymeScheme}</Badge>
              <span className="text-sm font-medium text-foreground-secondary">
                {t("rhymeScheme")}
              </span>
            </div>
          )}
          {r.formalFeatures.rhymeSchemeDescription && (
            <p className="border-l-2 border-teal-200 pl-3 text-sm text-foreground-muted">
              {r.formalFeatures.rhymeSchemeDescription}
            </p>
          )}
          {r.formalFeatures.summary && (
            <p className="text-sm text-foreground-secondary">
              {r.formalFeatures.summary}
            </p>
          )}
          {r.formalFeatures.otherFeatures?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                {t("otherSoundPatterns")}
              </p>
              {r.formalFeatures.otherFeatures.map((f, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border-subtle bg-white p-3 text-sm"
                >
                  <span className="font-medium text-foreground-secondary">
                    {f.name}
                  </span>
                  <p className="mt-1 text-foreground-muted">{f.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {r.adjustments?.adjustments &&
        r.adjustments.adjustments.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              {t("suggestedChanges")}
            </p>
            {r.adjustments.adjustments.map((adj, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm"
              >
                <Badge variant="outline" className="mb-2 text-xs">
                  Lines {adj.targetLines.map((n) => n + 1).join(", ")}
                </Badge>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-lg bg-muted/80 p-3">
                    <span className="text-xs text-foreground-muted">
                      {t("current")}
                    </span>
                    <p className="text-foreground-secondary">{adj.currentText}</p>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                    <span className="text-xs text-teal-700">{t("suggested")}</span>
                    <p className="font-medium text-foreground">{adj.suggestedText}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground-muted">
                  {adj.explanation}
                </p>
              </div>
            ))}
          </div>
        )}

      {r.personalize && (
        <div className="space-y-3 rounded-xl bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t("personalizedIdeas")}
          </p>
          {r.personalize.insight?.observation && (
            <p className="text-sm text-foreground-secondary">
              {r.personalize.insight.observation}
            </p>
          )}
          {r.personalize.suggestions?.map((s, idx) => (
            <div key={idx} className="border-l-2 border-rose-200 pl-3">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-sm text-foreground-muted">{s.description}</p>
            </div>
          ))}
          {r.personalize.encouragement && (
            <p className="text-sm italic text-foreground-muted">
              {r.personalize.encouragement}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TranslationInsightsContent({
  insights,
  t,
}: {
  insights: DiaryTranslationInsights | null;
  t: (key: string) => string;
}) {
  if (!hasTranslationInsightsData(insights)) return null;

  const ti = insights!;

  return (
    <div className="space-y-4">
      {ti.aims && (
        <div className="rounded-xl bg-white/80 p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
            {t("yourTranslationAims")}
          </p>
          <p className="text-sm text-foreground-secondary">{ti.aims}</p>
        </div>
      )}
      {ti.suggestions && ti.suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t("suggestions")}
          </p>
          {ti.suggestions.map((s, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
            >
              <p className="font-medium text-foreground">
                {idx + 1}. {s.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground-muted">
                {s.description}
              </p>
              {s.lineReferences && s.lineReferences.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.lineReferences.map((lineIdx) => (
                    <Badge key={lineIdx} variant="secondary" className="text-xs">
                      Line {lineIdx + 1}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesAndReflectionContent({
  entry,
  t,
}: {
  entry: DiaryEntry;
  t: (key: string) => string;
}) {
  if (!hasNotesAndReflection(entry)) return null;

  const lineNoteEntries = getLineNoteEntries(entry);

  return (
    <div className="space-y-5">
      {entry.notebook_notes?.thread_note?.trim() && (
        <div className="rounded-xl border border-border-subtle bg-white/90 p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t("threadNote")}
          </p>
          <p className="font-serif text-base leading-relaxed text-foreground-secondary">
            {entry.notebook_notes.thread_note}
          </p>
        </div>
      )}

      {lineNoteEntries.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t("lineNotes")}
          </p>
          {lineNoteEntries.map(({ lineIndex, note }) => (
            <div
              key={lineIndex}
              className="rounded-xl border border-card-amber-border bg-card-amber-bg/40 p-4 shadow-sm"
            >
              <Badge variant="outline" className="mb-2 text-xs">
                {t("lineNote")} {lineIndex + 1}
              </Badge>
              <p className="font-serif text-sm italic leading-relaxed text-foreground-secondary">
                {note}
              </p>
            </div>
          ))}
        </div>
      )}

      {entry.expressYourView?.trim() && (
        <div className="rounded-xl border border-card-amber-border bg-gradient-to-br from-card-amber-bg/60 to-surface p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning">
            {t("expressYourView")}
          </p>
          <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground-secondary">
            {entry.expressYourView}
          </p>
        </div>
      )}
    </div>
  );
}

function JourneySummaryContent({
  entry,
  t,
}: {
  entry: DiaryEntry;
  t: (key: string) => string;
}) {
  return (
    <JourneySummaryDisplay
      hideWhenEmpty
      data={{
        reflection: entry.reflection_text,
        insights: entry.insights,
        strengths: entry.strengths,
        challenges: entry.challenges,
        recommendations: entry.recommendations,
      }}
      labels={{
        atAGlance: t("journeyAtAGlance"),
        overview: t("journeyOverview"),
        readMore: t("journeyReadMore"),
        readLess: t("journeyReadLess"),
        keyInsights: t("keyInsights"),
        strengths: t("strengths"),
        challenges: t("challenges"),
        toExploreFurther: t("toExploreFurther"),
      }}
    />
  );
}

function normalizeEntry(raw: DiaryResponse["items"][number]): DiaryEntry {
  return {
    ...raw,
    workshop_lines: (raw.workshop_lines as DiaryEntry["workshop_lines"]) ?? [],
    notebook_notes: (raw.notebook_notes as DiaryEntry["notebook_notes"]) ?? null,
    translationInsights:
      (raw.translationInsights as DiaryTranslationInsights | null) ?? null,
    refineRhyme: (raw.refineRhyme as DiaryRefineRhyme | null) ?? null,
  };
}

function buildExportLabels(t: (key: string) => string): DiaryExportLabels {
  return {
    title: t("title"),
    heading: t("heading"),
    originalText: t("originalText"),
    translatedText: t("translatedText"),
    translation: t("translation"),
    notes: t("notes"),
    threadNote: t("threadNote"),
    lineNote: t("lineNote"),
    lineNotes: t("lineNotes"),
    refineRhyme: t("refineRhyme"),
    rhymeScheme: t("rhymeScheme"),
    otherSoundPatterns: t("otherSoundPatterns"),
    suggestedChanges: t("suggestedChanges"),
    current: t("current"),
    suggested: t("suggested"),
    personalizedIdeas: t("personalizedIdeas"),
    translationInsights: t("translationInsights"),
    yourTranslationAims: t("yourTranslationAims"),
    suggestions: t("suggestions"),
    journeySummary: t("journeySummary"),
    insights: t("insights"),
    strengths: t("strengths"),
    challenges: t("challenges"),
    recommendations: t("recommendations"),
    expressYourView: t("expressYourView"),
    notesAndReflection: t("notesAndReflection"),
    originalTextFull: t("originalTextFull"),
    generatedOn: t("generatedOn"),
    lineCount: t("lineCount"),
    untitledPoem: t("untitledPoem"),
  };
}

function PoemEntry({
  entry,
  t,
  exportLabels,
}: {
  entry: DiaryEntry;
  t: (key: string) => string;
  exportLabels: DiaryExportLabels;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const validLines = getValidLines(entry);
  const threadId = entry.thread_id;

  const handleJump = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-white transition-all duration-500",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
        "hover:shadow-[0_4px_20px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.04)]",
        "ring-1 ring-border-subtle/80"
      )}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 via-orange-400 to-rose-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <header className="border-b border-border-subtle px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-medium tracking-tight text-foreground md:text-2xl">
              {entry.title || t("untitledPoem")}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(entry.thread_created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {validLines.length} {t("lines")}
              </span>
              {hasJourneyContent(entry) && (
                <span className="flex items-center gap-1.5 text-warning">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("journeyReviewed")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => exportEntryAsTxt(entry, exportLabels)}
              className="rounded-full text-foreground-secondary"
              title={t("exportTxt")}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {t("exportTxt")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => exportEntryAsPdf(entry, exportLabels)}
              className="rounded-full text-foreground-secondary"
              title={t("exportPdf")}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              {t("exportPdf")}
            </Button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                expanded
                  ? "bg-accent text-white"
                  : "bg-muted text-foreground-secondary hover:bg-border-subtle"
              )}
            >
              {expanded ? t("collapse") : t("view")}
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  expanded && "rotate-90"
                )}
              />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-6 px-6 py-6 sm:px-8">
            <SectionNav threadId={threadId} t={t} onJump={handleJump} />

            <DiarySection
              id={`section-translation-${threadId}`}
              title={t("translation")}
              icon={BookOpen}
              defaultOpen
            >
              {validLines.length > 0 ? (
                <>
                  <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                      {t("originalText")}
                    </div>
                    <div className="hidden text-xs font-medium uppercase tracking-wider text-foreground-muted md:block">
                      {t("translatedText")}
                    </div>
                  </div>
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
                        <div className="relative">
                          <span className="absolute -left-2 top-0 font-mono text-xs text-stone-300">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <p className="pl-4 font-serif text-base leading-relaxed text-foreground-secondary md:text-lg">
                            {line.original}
                          </p>
                        </div>
                        <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted md:hidden">
                          {t("translatedText")}
                        </div>
                        <div className="relative md:border-l md:border-stone-200 md:pl-4">
                          <p className="font-serif text-base font-medium leading-relaxed text-foreground md:text-lg">
                            {line.translated}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </DiarySection>

            <DiarySection
              id={`section-refineRhyme-${threadId}`}
              title={t("refineRhyme")}
              icon={Music2}
              variant="teal"
            >
              <RefineRhymeContent refineRhyme={entry.refineRhyme} t={t} />
            </DiarySection>

            <DiarySection
              id={`section-translationInsights-${threadId}`}
              title={t("translationInsights")}
              icon={Lightbulb}
              variant="blue"
            >
              <TranslationInsightsContent
                insights={entry.translationInsights}
                t={t}
              />
            </DiarySection>

            <DiarySection
              id={`section-journeySummary-${threadId}`}
              title={t("journeySummary")}
              icon={Sparkles}
              variant="purple"
            >
              <JourneySummaryContent entry={entry} t={t} />
            </DiarySection>

            <DiarySection
              id={`section-notesAndReflection-${threadId}`}
              title={t("notesAndReflection")}
              icon={PenLine}
              variant="amber"
            >
              <NotesAndReflectionContent entry={entry} t={t} />
            </DiarySection>
          </div>
        </div>
      </div>

      {!expanded && validLines.length > 0 && (
        <div className="border-t border-border-subtle px-6 py-4 sm:px-8">
          <p className="truncate font-serif text-sm italic text-foreground-muted">
            &ldquo;{validLines[0].translated}&rdquo;
            {validLines.length > 1 && "…"}
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

  const exportLabels = React.useMemo(() => buildExportLabels(t), [t]);

  const { data, isLoading, error, refetch } = useQuery<DiaryResponse>({
    queryKey: ["diary-completed-poems", cursor],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const params = new URLSearchParams({ limit: "20" });
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

  React.useEffect(() => {
    if (data?.items) {
      const normalized = data.items.map(normalizeEntry);
      if (cursor === null) {
        setAllItems(normalized);
      } else {
        setAllItems((prev) => [...prev, ...normalized]);
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

  if (authLoading || (isLoading && allItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
        <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-br from-amber-200 to-orange-200" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-warning" />
            </div>
            <p className="text-sm text-foreground-muted">{t("loadingTranslations")}</p>
          </div>
        </div>
      </div>
    );
  }

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

  const countLabel = t("completedTranslationsCount", { count: allItems.length });

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-stone-50 to-orange-50/30">
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
                <p className="mt-3 text-foreground-muted">{countLabel}</p>
              )}
            </div>
            <BookOpen className="hidden h-12 w-12 text-stone-300 sm:block" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-white/50 px-6 py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <BookOpen className="h-8 w-8 text-foreground-muted" />
            </div>
            <h2 className="mb-2 font-serif text-xl font-medium text-foreground-secondary">
              {t("noCompletedTranslationsTitle")}
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
              <PoemEntry
                key={entry.thread_id}
                entry={entry}
                t={t}
                exportLabels={exportLabels}
              />
            ))}

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

      <div className="h-32 bg-gradient-to-t from-orange-50/60 to-transparent" />
    </div>
  );
}
