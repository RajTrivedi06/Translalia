export const MODELS = {
  enhancer: process.env.ENHANCER_MODEL || "gpt-4o-mini",
  translator: process.env.TRANSLATOR_MODEL || "gpt-4o",
  embeddings: process.env.EMBEDDINGS_MODEL || "text-embedding-3-large",
} as const;
/** If ANTHROPIC_API_KEY is later provided, callers can prefer "claude-3.5-sonnet". */
