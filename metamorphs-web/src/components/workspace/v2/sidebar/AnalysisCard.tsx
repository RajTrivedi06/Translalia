"use client";
import * as React from "react";
import { useInterviewFlow } from "@/hooks/useInterviewFlow";
import { useNodes } from "@/hooks/useNodes";
import { getAnalysisSnapshot } from "../_utils/data";
import { useT } from "../_utils/i18n";

export function AnalysisCard({ projectId, threadId }: { projectId?: string; threadId?: string | null }) {
  const t = useT();
  const { peek } = useInterviewFlow(threadId ?? undefined);
  const { data: peek_data, isLoading: lp } = peek || {};
  const { data: nodes, isLoading: ln } =
    useNodes(projectId, threadId ?? undefined, { enabled: !!projectId && !!threadId });

  const latestNodeMeta = Array.isArray(nodes) ? (nodes.at(-1) as Record<string, unknown> | undefined)?.meta : undefined;
  const snap = getAnalysisSnapshot({ flowPeek: peek_data, nodeMeta: latestNodeMeta });
  const loading = lp || ln;

  const Row = ({ label, value }: { label: string; value?: string | string[] }) => (
    <div className="grid grid-cols-[120px_1fr] items-start gap-2 py-1">
      <dt className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className="text-sm">
        {Array.isArray(value) ? (value.length ? value.join(", ") : "—") : (value || "—")}
      </dd>
    </div>
  );

  return (
    <section role="region" aria-labelledby="analysis-title" className="m-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-2">
      <h2 id="analysis-title" className="mb-2 text-sm font-semibold">{t("analysis")}</h2>

      {loading && (
        <div aria-busy="true" className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      )}

      {!loading && (
        <dl>
          <Row label={t("language")} value={snap.language} />
          <Row label={t("form")} value={snap.form} />
          <Row label={t("themes")} value={snap.themes ?? []} />
          <Row label={t("audienceTone")} value={snap.audienceOrTone} />
          {!snap.language && !snap.form && !snap.themes?.length && !snap.audienceOrTone && (
            <p className="mt-2 text-xs text-neutral-500">{t("setDuringInterview")}</p>
          )}
        </dl>
      )}
    </section>
  );
}

export default AnalysisCard;
