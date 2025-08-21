/** Per-user/minute rate for preview endpoints (wire later). */
export const PREVIEW_RATE_PER_MIN = 30;
/** Soft daily budget per project in USD (wire later). */
export const DAILY_BUDGET_PROJECT_USD = 2;
/** Cache TTL for identical preview requests (seconds). */
export const PREVIEW_CACHE_TTL_SEC = 3600;
/** Ledger cap & summary cadence (used in state updates later). */
export const LEDGER_MAX_ITEMS = 7;
export const SUMMARY_EVERY_N_CHANGES = 5;
/** Moderation stance: enforce on persist, not on preview. */
export const MODERATE_ON_PERSIST_ONLY = true;
