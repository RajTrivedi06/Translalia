"use client";
import * as React from "react";
import { useNodes } from "@/hooks/useNodes";

export function AnalysisCard({
  projectId,
  threadId,
}: {
  projectId: string;
  threadId: string | null;
}) {
  const { data: nodes } = useNodes(projectId, threadId || undefined, {
    enabled: !!projectId && !!threadId,
  });
  const meta = React.useMemo(() => {
    type Overview = { language?: string; form?: string; themes?: string[] };
    const newest = (nodes || []).slice(-1)[0];
    const overview: Overview = (newest?.overview as Overview) || {};
    return {
      language: overview.language ?? "—",
      form: overview.form ?? "—",
      themes: (overview.themes as string[] | undefined) ?? [],
    } satisfies { language: string; form: string; themes: string[] };
  }, [nodes]);
  return (
    <section
      role="region"
      aria-labelledby="analysis-card-title"
      className="rounded-lg border p-3 bg-white dark:bg-neutral-950"
    >
      <div id="analysis-card-title" className="mb-2 text-sm font-semibold">
        Analysis
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Language</dt>
          <dd>{meta.language}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Form</dt>
          <dd>{meta.form}</dd>
        </div>
        <div className="col-span-3">
          <dt className="text-xs text-neutral-500">Themes</dt>
          <dd className="flex flex-wrap gap-1">
            {(meta.themes || []).length ? (
              meta.themes.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border px-2 py-0.5 text-xs"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-neutral-500">—</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default AnalysisCard;
