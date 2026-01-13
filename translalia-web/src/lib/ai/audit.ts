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

import type { ViewpointRangeMode, RecipeCacheInfo } from "./variantRecipes";

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

  mode: ViewpointRangeMode;
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
  mode: ViewpointRangeMode;
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
 * Append audit to thread state, keeping last N audits to avoid bloat.
 * Only persists if PERSIST_METHOD2_AUDIT=1 environment variable is set.
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

    // Fetch current state
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("state")
      .eq("id", threadId)
      .single();

    if (fetchError || !thread) {
      console.warn(`[pushAuditToThreadState] Failed to fetch thread ${threadId}`);
      return;
    }

    const state = (thread.state as Record<string, unknown>) || {};
    const existingAudits = (state.method2_audit as LineAudit[]) || [];

    // Append new audit and keep last maxN
    const updatedAudits = [...existingAudits, audit].slice(-maxN);

    // Update state with JSONB patch
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...state,
          method2_audit: updatedAudits,
        },
      })
      .eq("id", threadId);

    if (updateError) {
      console.warn(
        `[pushAuditToThreadState] Failed to update thread ${threadId}:`,
        updateError
      );
    }
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
