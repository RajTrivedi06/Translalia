import crypto from "node:crypto";

export function stableHash(obj: unknown) {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export function buildPromptHash(args: {
  route: string;
  model: string;
  system: string;
  user: string;
  schema?: string;
}) {
  const { route, model, system, user, schema } = args;
  return stableHash({ route, model, system, user, schema });
}

/** Dev-only, redacted logging */
export function logLLMRequestPreview(args: {
  route: string;
  model: string;
  system: string;
  user: string;
  hash: string;
}) {
  const DEBUG =
    process.env.DEBUG_PROMPTS === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
  if (!DEBUG) return;
  const squeeze = (s: string, n = 240) =>
    (s || "").replace(/\s+/g, " ").slice(0, n);
  // Avoid printing full poem/user content in logs
  console.info("[LLM]", {
    route: args.route,
    model: args.model,
    hash: args.hash,
    systemPreview: squeeze(args.system),
    userPreview: squeeze(args.user, 300),
  });
}
