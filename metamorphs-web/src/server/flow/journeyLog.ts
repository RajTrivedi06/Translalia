import { supabaseServer } from "@/lib/supabaseServer";

export async function bestEffortJourneyInsert(payload: {
  project_id: string;
  kind: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = await supabaseServer();

  // Try (project_id, kind, summary, meta)
  const { error } = await supabase.from("journey_items").insert({
    project_id: payload.project_id,
    kind: payload.kind,
    summary: payload.summary,
    meta: payload.meta ?? {},
  });

  // Swallow errors to keep flow resilient across schema variants
  if (error) {
    // console.warn("journey_items insert skipped:", error.message);
  }
}
