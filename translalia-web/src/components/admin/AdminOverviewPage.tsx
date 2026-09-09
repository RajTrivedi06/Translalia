import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminOverview } from "./types";
import { aggregateLanguages } from "./languages";
import { formatDateTime, n, plural, ratio } from "./format";
import { StatTile } from "./StatTile";
import { Section, EmptyNote } from "./Section";
import { GrowthChart } from "./GrowthChart";
import { BarList } from "./BarList";
import { Funnel } from "./Funnel";
import { RecentTranslators } from "./RecentTranslators";

/**
 * The one admin page. Everything comes from a single admin_overview() call
 * made with the caller's own cookie session; nothing is cached, the footer
 * shows the actual generation time.
 *
 * Copy rules (docs/agent-temp/admin-dashboard-v1-scope.md): plain words, no
 * jargon, direct labels on everything, fractions under 20 items, no trend
 * line under 5 points, and an empty section says so in a sentence.
 */
export async function AdminOverviewPage({ sb }: { sb: SupabaseClient }) {
  const { data, error } = await sb.rpc("admin_overview");
  const now = Date.now();

  if (error || !data) {
    return (
      <Shell>
        <p className="text-sm text-foreground-secondary">
          The numbers could not be loaded just now. Reload the page to try again.
        </p>
      </Shell>
    );
  }

  const d = data as AdminOverview;

  // Languages: pairings only when most finished poems carry both ends,
  // otherwise source languages only. Today no target language is recorded.
  const pairMode = d.poems_finished > 0 && d.finished_with_pair / d.poems_finished >= 0.6;
  const langs = aggregateLanguages(d.languages, "poems_finished");
  const langsToShow =
    langs.languages.length > 0 ? langs : aggregateLanguages(d.languages, "poems_started");
  const langMetricIsFinished = langs.languages.length > 0;

  // "Written by hand" only when at least 10 lines carry a source stamp.
  const hand = d.hand ?? { manual: 0, classified: 0 };
  const showHand = hand.classified >= 10;

  const funnelSteps = [
    { label: "Poems started", value: d.funnel.started },
    { label: "Poems with a translation run", value: d.funnel.ran },
    { label: "Poems with a first line saved", value: d.funnel.saved_first_line },
    { label: "Poems finished", value: d.funnel.finished },
    { label: "Poems with a written reflection", value: d.funnel.reflected },
  ];

  return (
    <Shell>
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Translalia</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
          What Translalia has produced
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          value={n(d.poems_finished)}
          label="Poems translated"
          sentence={`${n(d.poems_finished)} ${plural(d.poems_finished, "poem")} finished, ${n(d.poems_in_progress)} more in progress.`}
        />
        <StatTile
          value={n(d.lines_saved)}
          label="Lines of poetry"
          sentence="Every line translated and saved by a person."
        />
        <StatTile
          value={n(langsToShow.distinct)}
          label="Languages"
          sentence={
            pairMode
              ? `Across ${n(d.pairings)} language ${plural(d.pairings, "pairing")}.`
              : "Languages people have translated from."
          }
        />
        <StatTile
          value={n(d.translators)}
          label="Translators"
          sentence={`${n(d.translators)} ${plural(d.translators, "person has", "people have")} used Translalia. ${n(d.active_30d)} ${d.active_30d === 1 ? "was" : "were"} active this month.`}
        />
        {showHand ? (
          <StatTile
            value={ratio(hand.manual, hand.classified, "lines")}
            label="Written by hand"
            sentence="Finished lines the translator wrote or rewrote themselves rather than accepting a generated one."
          />
        ) : (
          <StatTile
            value={n(d.reflections_written)}
            label="Reflections written"
            sentence={`${n(d.reflections_written)} ${plural(d.reflections_written, "poem has", "poems have")} a reflection written by the translator.`}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <Section
          title="The collection is growing"
          sentence={
            d.growth.length > 0
              ? `${n(d.lines_saved)} lines translated so far, counted by the week each line was saved.`
              : undefined
          }
        >
          {d.growth.length > 0 ? (
            <GrowthChart weeks={d.growth} />
          ) : (
            <EmptyNote>No lines have been saved yet.</EmptyNote>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section
            title={pairMode ? "Languages" : "Languages translated from"}
            sentence={
              langsToShow.languages.length === 0
                ? undefined
                : langMetricIsFinished
                  ? "Finished poems per language."
                  : "Poems started per language; none is finished yet."
            }
          >
            {langsToShow.languages.length === 0 ? (
              <EmptyNote>No languages recorded yet.</EmptyNote>
            ) : (
              <>
                <BarList
                  rows={langsToShow.languages.map((l) => ({ label: l.name, value: l.poems }))}
                  unit="poems"
                />
                {!pairMode ? (
                  <p className="mt-4 text-xs text-foreground-muted">
                    Target languages aren&apos;t recorded, so pairings can&apos;t be shown yet.
                  </p>
                ) : null}
              </>
            )}
          </Section>

          <Section
            title="How far people get"
            sentence="Each step counts poems, not people."
          >
            {d.funnel.started === 0 ? (
              <EmptyNote>No poems started yet.</EmptyNote>
            ) : (
              <Funnel steps={funnelSteps} />
            )}
          </Section>
        </div>

        <Section title="Recently active translators">
          {d.recent_translators.length === 0 ? (
            <EmptyNote>Nobody has been active yet.</EmptyNote>
          ) : (
            <RecentTranslators rows={d.recent_translators} now={now} />
          )}
        </Section>
      </div>

      <footer className="mt-8 text-xs text-foreground-muted">
        Updated {formatDateTime(d.generated_at)}. Every number is computed fresh when this page loads.
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-base">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
