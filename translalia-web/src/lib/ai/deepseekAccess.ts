/**
 * Central access gate for DeepSeek.
 *
 * DeepSeek is a cost-gated provider: only accounts whose email appears in the
 * `DEEPSEEK_ALLOWED_EMAILS` env var (comma-separated) may use it. Every
 * enforcement point — interactive translate routes and the background
 * translation tick — MUST route through these helpers so the rule is byte-for-
 * byte identical everywhere. Non-allowlisted DeepSeek requests are rejected
 * (403 / thrown), never silently downgraded.
 */

/** Parsed, normalized allowlist from `DEEPSEEK_ALLOWED_EMAILS`. */
export function getAllowedDeepSeekEmails(): string[] {
  return (process.env.DEEPSEEK_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the model id targets DeepSeek. Matches the same `deepseek*` prefix
 * routing key used by `getClientForModel` in `@/lib/ai/openai`.
 */
export function isDeepSeekModel(model: string | null | undefined): boolean {
  return typeof model === "string" && model.startsWith("deepseek");
}

/** Case-insensitive, trimmed membership test against the allowlist. */
export function isDeepSeekAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return getAllowedDeepSeekEmails().includes(normalized);
}

/**
 * True when a request must be blocked: a DeepSeek model requested by a
 * non-allowlisted user. Interactive routes translate this into a 403; the
 * background tick throws.
 */
export function isDeepSeekBlocked(
  model: string | null | undefined,
  email: string | null | undefined
): boolean {
  return isDeepSeekModel(model) && !isDeepSeekAllowed(email);
}
