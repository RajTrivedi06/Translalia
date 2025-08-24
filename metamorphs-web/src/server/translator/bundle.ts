import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState } from "@/server/threadState";

export type TranslateBundle = {
  poem: string;
  enhanced: Record<string, unknown>;
  line_policy: "line-preserving" | "free";
  acceptedLines: string[];
  ledgerNotes: string[]; // last 3–5
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

  const debug = {
    poemChars: poem.length,
    acceptedCount: acceptedLines.length,
    ledgerCount: ledgerNotes.length,
    summaryChars: summary.length,
  };

  return {
    poem,
    enhanced,
    line_policy,
    acceptedLines,
    ledgerNotes,
    summary,
    debug,
  };
}
