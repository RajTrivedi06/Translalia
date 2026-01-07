/**
 * Server-side helper to insert masked prompt audits into the prompt_audits table.
 * RLS-safe: created_by is set from the authenticated user session.
 * Errors are swallowed to avoid breaking user flows.
 */

import { getServerClient } from "@/lib/supabaseServer";

// Allowed values per prompt_audits_stage_check constraint
const ALLOWED_STAGES = [
  "workshop-options",
  "ai-assist",
  "prismatic",
  "journey-reflection",
  "poem-analysis",
  "interview",
] as const;

type AllowedStage = (typeof ALLOWED_STAGES)[number];

/**
 * Map non-standard stages to allowed values to satisfy DB constraint.
 * Falls back to 'workshop-options' for any workshop-related stage.
 */
function normalizeStage(stage: string): AllowedStage {
  if (ALLOWED_STAGES.includes(stage as AllowedStage)) {
    return stage as AllowedStage;
  }
  // Map workshop-related stages to 'workshop-options'
  if (stage.startsWith("workshop")) {
    return "workshop-options";
  }
  // Default fallback
  return "workshop-options";
}

export type InsertPromptAuditArgs = {
  createdBy: string; // required for RLS; typically user.id
  projectId?: string | null;
  threadId?: string | null;
  stage: string; // will be normalized to allowed values
  provider?: string; // e.g., 'openai'
  model: string;
  params: Record<string, unknown>;
  promptSystemMasked: string;
  promptUserMasked: string | Record<string, unknown>;
  responseExcerpt?: string | null;
  redactions?: string[];
};

/**
 * Insert a single masked prompt audit row.
 * Returns the inserted ID on success, null on failure (swallowed).
 */
export async function insertPromptAudit(
  args: InsertPromptAuditArgs
): Promise<string | null> {
  try {
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from("prompt_audits")
      .insert({
        created_by: args.createdBy,
        project_id: args.projectId ?? null,
        thread_id: args.threadId ?? null,
        stage: normalizeStage(args.stage),
        model: args.model,
        params: args.params,
        prompt_system: args.promptSystemMasked,
        // Table expects jsonb for prompt_user — store masked string under {masked: "..."}
        prompt_user:
          typeof args.promptUserMasked === "string"
            ? { masked: args.promptUserMasked }
            : args.promptUserMasked,
        response_excerpt: args.responseExcerpt ?? null,
        redactions: args.redactions ?? [],
      })
      .select("id")
      .single();

    if (error) {
      // Swallow audit failures to avoid breaking user flows
      if (process.env.NODE_ENV !== "production") {
        console.warn("[insertPromptAudit] failed", {
          error: error.message,
          code: error.code,
        });
      }
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    // Swallow all errors
    if (process.env.NODE_ENV !== "production") {
      console.warn("[insertPromptAudit] unexpected error", err);
    }
    return null;
  }
}
