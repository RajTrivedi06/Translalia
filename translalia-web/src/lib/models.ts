// NOTE(cursor): Centralized translation defaults; envs override without code changes
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";

export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";

export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";

// Keep embeddings until a v5 embeddings model is exposed
export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";

// Moderation model constant removed (unused)

// Verification models (Phase 1)
export const VERIFICATION_MODEL =
  process.env.VERIFICATION_MODEL?.trim() || "gpt-5";
export const CONTEXT_MODEL = process.env.CONTEXT_MODEL?.trim() || "gpt-5-mini";
