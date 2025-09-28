import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState } from "@/server/threadState";

export type TranslateBundle = {
  poem: string;
  enhanced: Record<string, unknown>;
  glossary?: Array<{
    term: string;
    origin?: string;
    dialect_marker?: string;
    source?: string;
  }>;
  line_policy: "line-preserving" | "free";
  acceptedLines: string[];
  ledgerNotes: string[]; // last 3–5
  journeySummaries: string[]; // last 5
  summary: string;
  debug: {
    poemChars: number;
    acceptedCount: number;
    ledgerCount: number;
    summaryChars: number;
  };
};

export async function buildTranslateBundle(
  threadId: string
): Promise<TranslateBundle> {
  const supabase = await supabaseServer();
  const state = await getThreadState(threadId);

  const poem = (state.poem_excerpt ?? "").trim();
  const enhanced = (state.enhanced_request ?? {}) as Record<string, unknown>;
  const glossaryRaw = (state as unknown as { glossary_terms?: unknown })
    .glossary_terms;
  const glossary = Array.isArray(glossaryRaw)
    ? (glossaryRaw as Array<{
        term: string;
        origin?: string;
        dialect_marker?: string;
        source?: string;
      }>)
    : undefined;
  const line_policy = (state.collected_fields?.line_policy ??
    "line-preserving") as "line-preserving" | "free";
  const summary = state.summary ?? "";
  const ledger = (state.decisions_ledger ?? []).slice(-5);
  const ledgerNotes = ledger.map((l) => l.note);

  const { data: accepted } = await supabase.rpc("get_accepted_version", {
    p_thread_id: threadId,
  });
  const acceptedLines: string[] = Array.isArray(accepted?.lines)
    ? accepted.lines
    : [];

  // Fetch recent journey items scoped to this thread
  // TODO-VERIFY: when/if a real 'thread_id' column exists, switch to .eq("thread_id", threadId)
  const { data: jrows } = await supabase
    .from("journey_items")
    .select("id, kind, summary, created_at, meta")
    .filter("meta->>thread_id", "eq", threadId)
    .order("created_at", { ascending: false })
    .limit(5);

  const journeySummaries = (jrows || []).map(
    (r: {
      kind?: string;
      summary?: unknown;
      meta?: { selections?: unknown };
    }) => {
      const s = String(r.summary || "")
        .replace(/\s+/g, " ")
        .slice(0, 200);
      const maybeLen = (
        r.meta as unknown as { selections?: { length?: number } }
      )?.selections?.length;
      const linesCount =
        typeof maybeLen === "number" ? ` (lines: ${maybeLen})` : "";
      return `${r.kind || "activity"}: ${s}${linesCount}`;
    }
  );

  const debug = {
    poemChars: poem.length,
    acceptedCount: acceptedLines.length,
    ledgerCount: ledgerNotes.length,
    summaryChars: summary.length,
  };

  return {
    poem,
    enhanced,
    glossary,
    line_policy,
    acceptedLines,
    ledgerNotes,
    journeySummaries,
    summary,
    debug,
  };
}

// NOTE (Phase 4): Whole-version citation is currently assembled inside
// /api/translator/instruct by reading meta.overview.lines (preferred) or lines[]
// for a cited version. If you later centralize prompt assembly here, add a
// helper like `getVersionFullText(versionId)` and include it in the bundle.
