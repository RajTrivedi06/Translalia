import {
  SessionState,
  SessionStateSchema,
  DecisionsItemType,
} from "@/types/sessionState";
import { LEDGER_MAX_ITEMS, SUMMARY_EVERY_N_CHANGES } from "@/lib/policy";
import { supabaseServer } from "@/lib/supabaseServer";

/** Shallow-for-objects deep merge (arrays replace, not merge). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T>
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    const baseValue = (base as Record<string, unknown>)[key];
    if (isPlainObject(value) && isPlainObject(baseValue)) {
      out[key] = deepMerge(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value as unknown;
    }
  }
  return out as T;
}

/** Load thread.state as SessionState (schema-validated, with defaults). */
export async function getThreadState(threadId: string): Promise<SessionState> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("state")
    .eq("id", threadId)
    .single();
  if (error) throw error;
  const raw = (data?.state ?? {}) as unknown;
  const parsed = SessionStateSchema.safeParse(raw);
  if (!parsed.success) return SessionStateSchema.parse({}); // start clean if invalid
  return parsed.data;
}

/** Deep-merge patch into thread.state (server-side), return updated state. */
export async function patchThreadState(
  threadId: string,
  patch: Partial<SessionState>
): Promise<SessionState> {
  const supabase = await supabaseServer();
  const current = await getThreadState(threadId);
  const merged = deepMerge(
    current as Record<string, unknown>,
    patch as Partial<Record<string, unknown>>
  );
  const { data, error } = await supabase
    .from("chat_threads")
    .update({ state: merged })
    .eq("id", threadId)
    .select("state")
    .single();
  if (error) throw error;
  return SessionStateSchema.parse(data?.state ?? {});
}

/** Append one ledger item, cap to LEDGER_MAX_ITEMS, and report cadence. */
export async function appendLedger(
  threadId: string,
  item: DecisionsItemType
): Promise<{ state: SessionState; didHitCadence: boolean }> {
  const state = await getThreadState(threadId);
  const existing = state.decisions_ledger ?? [];
  const next = [...existing, item];
  const capped = next.slice(Math.max(0, next.length - LEDGER_MAX_ITEMS));
  const didHitCadence = (existing.length + 1) % SUMMARY_EVERY_N_CHANGES === 0;

  const updated = await patchThreadState(threadId, {
    decisions_ledger: capped,
  });
  return { state: updated, didHitCadence };
}
