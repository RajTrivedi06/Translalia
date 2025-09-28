"use client";

import * as React from "react";
import { useInterviewFlow } from "@/hooks/useInterviewFlow";
import { useNodes } from "@/hooks/useNodes";
import { splitStanzas, getSourceLines } from "../_utils/data";
import { useT } from "../_utils/i18n";
import { useWindowedList } from "../_utils/useWindowedList";

type Props = { projectId?: string; threadId?: string | null };

export function SourceTextCard({ projectId, threadId }: Props) {
  const [compact, setCompact] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const t = useT();

  // Hooks (read-only)
  const { peek } = useInterviewFlow(threadId ?? undefined);
  const { data: peek_data, isLoading: loadingPeek, error: errorPeek } = peek || {};

  const { data: nodes, isLoading: loadingNodes, error: errorNodes } =
    useNodes(projectId, threadId ?? undefined, { enabled: !!projectId && !!threadId });

  // Use centralized data extraction with fallbacks
  const sourceLines = getSourceLines({ flowPeek: peek_data, nodes: nodes as unknown[] });
  const hasSource = sourceLines !== null;

  const stanzas = React.useMemo(() => {
    if (!hasSource || !sourceLines) return [];
    const sourceText = sourceLines.join('\n');
    return splitStanzas(sourceText);
  }, [hasSource, sourceLines]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return stanzas;
    const q = query.toLowerCase();
    return stanzas
      .map(stanza => stanza.filter(line => line.toLowerCase().includes(q)))
      .filter(stanza => stanza.length > 0);
  }, [stanzas, query]);

  // Performance: flatten stanzas for windowing when many lines
  const flatLines = React.useMemo(() => {
    return filtered.flatMap((stanza, sIdx) =>
      stanza.map((line, lIdx) => ({
        text: line,
        stanzaIndex: sIdx,
        lineIndex: lIdx,
        globalIndex: lIdx + 1 // per-stanza numbering as before
      }))
    );
  }, [filtered]);

  const { visible: visibleLines, canLoadMore, loadMore, count, total } = useWindowedList(flatLines, 400);
  const shouldUseWindowing = total > 400;

  // States
  const loading = loadingPeek || loadingNodes;
  const error = errorPeek || errorNodes;

  return (
    <section role="region" aria-labelledby="source-title" className="m-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="source-title" className="text-sm font-semibold">{t("source")}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              className="focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 rounded-md"
            />
            {t("compactLines")}
          </label>
          <input
            aria-label={t("search")}
            className="h-8 w-32 rounded-md border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div aria-busy="true" aria-live="polite" className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("couldNotLoadSource")}</p>
      )}

      {!loading && !error && !hasSource && (
        <p className="text-sm text-neutral-500">
          {t("noSource")}
        </p>
      )}

      {!loading && !error && hasSource && (
        <>
          {shouldUseWindowing ? (
            // Windowed list for performance
            <div className="space-y-2">
              {visibleLines.map((item) => (
                <div key={`${item.stanzaIndex}:${item.lineIndex}`} data-line={item.globalIndex} className="flex gap-2">
                  <span className="w-6 shrink-0 text-xs text-neutral-500 tabular-nums">{item.globalIndex}</span>
                  <span
                    className={compact ? "truncate" : ""}
                    title={compact ? item.text : undefined}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
              {canLoadMore && (
                <button
                  onClick={loadMore}
                  className="w-full mt-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 rounded-md"
                >
                  Load more lines ({count} / {total})
                </button>
              )}
            </div>
          ) : (
            // Standard stanza view
            <ol className="space-y-3">
              {filtered.map((stanza, sIdx) => (
                <li key={sIdx} className="space-y-1">
                  {stanza.map((line, lIdx) => {
                    const lineNumber = lIdx + 1; // per-stanza numbering; switch to global if needed
                    return (
                      <div key={`${sIdx}:${lIdx}`} data-line={lineNumber} className="flex gap-2">
                        <span className="w-6 shrink-0 text-xs text-neutral-500 tabular-nums">{lineNumber}</span>
                        <span
                          className={compact ? "truncate" : ""}
                          title={compact ? line : undefined}
                        >
                          {line}
                        </span>
                      </div>
                    );
                  })}
                  <div className="my-2 h-px w-full border-t border-neutral-200 dark:border-neutral-800" />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

export default SourceTextCard;
