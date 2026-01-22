/**
 * Phase 4: Structured Audit Logging for Method 2 (Recipe-driven Prismatic Pipeline)
 *
 * Provides compact audit types and helpers to track:
 * - Recipe cache hits
 * - Phase 1/2 validation failures
 * - Diversity gate metrics
 * - Regeneration outcomes
 *
 * Enables fast debugging: "Why was this line paraphrase-y?"
 */

import type { TranslationRangeMode, RecipeCacheInfo } from "./variantRecipes";

// =============================================================================
// Types
// =============================================================================

// Re-export RecipeCacheInfo for convenience
export type { RecipeCacheInfo };

/**
 * Compact audit record for a single line translation.
 * Keep small and stable to avoid DB bloat.
 */
export interface LineAudit {
  ts: string; // ISO timestamp
  threadId: string;
  lineIndex?: number;
  stanzaIndex?: number;

  mode: TranslationRangeMode;
  model: string; // model used for generation (and regen if different)

  recipe: {
    cacheHit: "memory" | "db" | "miss";
    schemaVersion: string; // e.g. "v5"
    bundleKey?: string; // short hash if available
  };

  phase1?: {
    pass: boolean;
    failed?: string[]; // e.g. ["stance_mismatch","b_summary_invalid","anchors_missing_realization"]
  };

  gate: {
    pass: boolean;
    reason?: string; // stable reason string
    failedConstraints?: string[]; // e.g. ["signature","opener","overlap"]
    similarity?: {
      ab?: number;
      ac?: number;
      bc?: number;
      avgPairwise?: number;
    };
    openerTypes?: { a?: string; b?: string; c?: string };
    signatures?: { a?: string; b?: string; c?: string };
    contentTokenCounts?: { a?: number; b?: number; c?: number };
  };

  regen?: {
    performed: boolean;
    worstIndex?: 0 | 1 | 2;
    variantLabel?: "A" | "B" | "C";
    reason?: string; // gate.reason or phase1 reason
    strategy?: "single" | "salvage";
    sampleCount?: number; // 1 or K (e.g., 6)
    hardPassCount?: number; // salvage only (how many candidates survived hard checks)
  };
}

/**
 * Phase 1 validation result
 */
export interface Phase1Result {
  pass: boolean;
  failed?: string[]; // List of failed constraint names
  reason?: string; // Human-readable reason
}

/**
 * Regeneration info for audit
 */
export interface RegenInfo {
  performed: boolean;
  worstIndex?: number;
  variantLabel?: "A" | "B" | "C";
  reason?: string;
  strategy?: "single" | "salvage";
  sampleCount?: number;
  hardPassCount?: number;
}

// =============================================================================
// Audit Builders
// =============================================================================

/**
 * Create base audit record with core fields
 */
export function makeLineAuditBase(params: {
  threadId: string;
  lineIndex?: number;
  stanzaIndex?: number;
  mode: TranslationRangeMode;
  model: string;
  recipeCache: RecipeCacheInfo;
}): LineAudit {
  return {
    ts: new Date().toISOString(),
    threadId: params.threadId,
    lineIndex: params.lineIndex,
    stanzaIndex: params.stanzaIndex,
    mode: params.mode,
    model: params.model,
    recipe: {
      cacheHit: params.recipeCache.cacheHit,
      schemaVersion: params.recipeCache.schemaVersion,
      bundleKey: params.recipeCache.bundleKey,
    },
    gate: {
      pass: true, // Will be updated by attachGateMetrics
    },
  };
}

/**
 * Attach Phase 1 validation results to audit
 */
export function attachPhase1Metrics(
  audit: LineAudit,
  phase1Result: Phase1Result
): void {
  audit.phase1 = {
    pass: phase1Result.pass,
    failed: phase1Result.failed,
  };
}

/**
 * Attach diversity gate metrics to audit
 */
export function attachGateMetrics(
  audit: LineAudit,
  gateResult: {
    pass: boolean;
    reason?: string;
    worstIndex: number | null;
    details?: {
      jaccardScores?: number[];
      maxOverlap?: number;
      openerTypes?: string[];
      signatures?: string[];
      contentTokenCounts?: number[];
    };
  }
): void {
  // Extract pairwise similarities (ab, ac, bc)
  const similarities =
    gateResult.details?.jaccardScores && gateResult.details.jaccardScores.length === 3
      ? {
          ab: gateResult.details.jaccardScores[0],
          ac: gateResult.details.jaccardScores[1],
          bc: gateResult.details.jaccardScores[2],
          avgPairwise:
            gateResult.details.jaccardScores.reduce((sum, s) => sum + s, 0) / 3,
        }
      : undefined;

  // Extract opener types
  const openerTypes = gateResult.details?.openerTypes
    ? {
        a: gateResult.details.openerTypes[0],
        b: gateResult.details.openerTypes[1],
        c: gateResult.details.openerTypes[2],
      }
    : undefined;

  // Extract signatures
  const signatures = gateResult.details?.signatures
    ? {
        a: gateResult.details.signatures[0],
        b: gateResult.details.signatures[1],
        c: gateResult.details.signatures[2],
      }
    : undefined;

  // Extract content token counts
  const contentTokenCounts = gateResult.details?.contentTokenCounts
    ? {
        a: gateResult.details.contentTokenCounts[0],
        b: gateResult.details.contentTokenCounts[1],
        c: gateResult.details.contentTokenCounts[2],
      }
    : undefined;

  // Determine failed constraints from reason
  const failedConstraints: string[] = [];
  if (!gateResult.pass && gateResult.reason) {
    if (gateResult.reason.includes("signature")) failedConstraints.push("signature");
    if (gateResult.reason.includes("opener")) failedConstraints.push("opener");
    if (gateResult.reason.includes("overlap") || gateResult.reason.includes("Variants"))
      failedConstraints.push("overlap");
  }

  audit.gate = {
    pass: gateResult.pass,
    reason: gateResult.reason,
    failedConstraints: failedConstraints.length > 0 ? failedConstraints : undefined,
    similarity: similarities,
    openerTypes,
    signatures,
    contentTokenCounts,
  };
}

/**
 * Attach regeneration metrics to audit
 */
export function attachRegenMetrics(audit: LineAudit, regenInfo: RegenInfo): void {
  audit.regen = {
    performed: regenInfo.performed,
    worstIndex:
      regenInfo.worstIndex !== undefined
        ? (regenInfo.worstIndex as 0 | 1 | 2)
        : undefined,
    variantLabel: regenInfo.variantLabel,
    reason: regenInfo.reason,
    strategy: regenInfo.strategy,
    sampleCount: regenInfo.sampleCount,
    hardPassCount: regenInfo.hardPassCount,
  };
}

/**
 * Convert audit to compact JSON log line
 */
export function auditToLogLine(audit: LineAudit): string {
  return JSON.stringify(audit);
}

// =============================================================================
// Optional Persistence (if PERSIST_METHOD2_AUDIT=1)
// =============================================================================

/**
 * Append audit to thread state using ATOMIC SQL append.
 * Only persists if PERSIST_METHOD2_AUDIT=1 environment variable is set.
 *
 * ✅ CRITICAL FIX: Uses atomic JSONB array append to avoid clobbering translation_job.
 * Previous implementation did read-modify-write on the entire state, which could
 * overwrite concurrent writes from runTranslationTick/mutateTranslationJob.
 */
export async function pushAuditToThreadState(
  threadId: string,
  audit: LineAudit,
  maxN: number = 50
): Promise<void> {
  // Only persist if explicitly enabled
  if (process.env.PERSIST_METHOD2_AUDIT !== "1") {
    return;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { supabaseServer } = await import("@/lib/supabaseServer");
    const supabase = await supabaseServer();

    // ✅ LOG: Direct table insert (migrated from RPC)
    console.log(
      `[AUDIT] writer=pushAuditToThreadState threadId=${threadId} ` +
      `inserting=translation_audits table`
    );

    // ✅ MIGRATION: Insert directly to translation_audits table instead of RPC
    // Parse timestamp from audit.ts (ISO string) or use current time
    const createdAt = audit.ts ? new Date(audit.ts).toISOString() : new Date().toISOString();

    const { error: insertError } = await supabase
      .from("translation_audits")
      .insert({
        thread_id: threadId,
        line_index: audit.lineIndex ?? null,
        stanza_index: audit.stanzaIndex ?? null,
        mode: audit.mode,
        model: audit.model,
        recipe_cache_hit: audit.recipe.cacheHit ?? null,
        recipe_schema_version: audit.recipe.schemaVersion ?? null,
        recipe_bundle_key: audit.recipe.bundleKey ?? null,
        phase1_pass: audit.phase1?.pass ?? null,
        phase1_failed: audit.phase1?.failed ?? null,
        gate_pass: audit.gate.pass,
        gate_reason: audit.gate.reason ?? null,
        gate_failed_constraints: audit.gate.failedConstraints ?? null,
        gate_similarity: audit.gate.similarity ?? null,
        regen_performed: audit.regen?.performed ?? false,
        regen_worst_index: audit.regen?.worstIndex ?? null,
        regen_variant_label: audit.regen?.variantLabel ?? null,
        regen_reason: audit.regen?.reason ?? null,
        regen_strategy: audit.regen?.strategy ?? null,
        regen_sample_count: audit.regen?.sampleCount ?? null,
        regen_hard_pass_count: audit.regen?.hardPassCount ?? null,
        created_at: createdAt,
      });

    if (insertError) {
      const errorMsg =
        `[pushAuditToThreadState] Failed to insert audit for thread ${threadId}: ` +
        `${insertError.message} (code: ${insertError.code || "unknown"})`;
      console.error(errorMsg, insertError);
      throw new Error(errorMsg);
    }

    console.log(
      `[pushAuditToThreadState] ✅ Successfully inserted audit for thread ${threadId}`
    );
  } catch (error) {
    console.warn("[pushAuditToThreadState] Error:", error);
  }
}

// =============================================================================
// Stable Reason Strings (Phase 1-3)
// =============================================================================

/**
 * Standardized reason strings for Phase 1-3 failures.
 * These MUST be used consistently across validation and gate checks
 * to enable aggregation in scorecards and debugging.
 */
export const AUDIT_REASONS = {
  // Phase 1: Semantic Anchors + Self-Report
  ANCHORS_INVALID: "anchors_invalid",
  ANCHORS_MISSING_REALIZATION: "anchors_missing_realization",
  B_SUMMARY_INVALID: "b_summary_invalid",
  C_METADATA_MISSING: "c_metadata_missing",
  C_SUBJECT_FORBIDDEN: "c_subject_forbidden",
  STANCE_MISMATCH: "stance_mismatch",

  // Phase 2: Structural Checks
  SIGNATURE_MATCH_C: "signature_match_c",
  OPENER_DUPLICATE_C: "opener_duplicate_c",
  OPENER_DUPLICATE_B: "opener_duplicate_b",
  OPENER_ALL_SAME: "opener_all_same",
  OVERLAP_HIGH: "overlap_high",

  // Phase 3: Regeneration
  REGEN_SALVAGE_NO_HARD_PASS: "regen_salvage_no_hard_pass",
  REGEN_SELECTED_BEST_EFFORT: "regen_selected_best_effort",
} as const;

export type AuditReason = (typeof AUDIT_REASONS)[keyof typeof AUDIT_REASONS];
