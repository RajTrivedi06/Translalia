export type Intent =
  | "poem_input"
  | "interview_answer"
  | "looks_good"
  | "help"
  | "status"
  | "restart"
  | "out_of_scope";

export function routeIntent(
  msg: string,
  phase: string
): { intent: Intent; confidence: "high" | "low" } {
  const t = (msg || "").trim();
  const low = { intent: "out_of_scope" as const, confidence: "low" as const };

  if (!t) return low;

  const lc = t.toLowerCase();

  // Always-on meta
  if (/^(help|\?|what can i do)/i.test(lc))
    return { intent: "help", confidence: "high" };
  if (/^(status|where am i|what next)/i.test(lc))
    return { intent: "status", confidence: "high" };
  if (/^(restart|reset|start over)/i.test(lc))
    return { intent: "restart", confidence: "high" };
  if (/^looks good[.!]?$/i.test(lc))
    return { intent: "looks_good", confidence: "high" };

  // Welcome → look for poem-like text (multiple lines / punctuation cadence)
  if (phase === "welcome") {
    const hasMultiLines = t.includes("\n") || t.split(/\s+/).length > 15;
    if (hasMultiLines) return { intent: "poem_input", confidence: "high" };
    if (t.length > 10) return { intent: "poem_input", confidence: "low" };
  }

  // Interviewing → assume answers unless obviously meta
  if (phase === "interviewing") {
    return { intent: "interview_answer", confidence: "high" };
  }

  // Plan gate shortcuts
  if (
    phase === "await_plan_confirm" &&
    /^(ok|sounds good|go ahead|proceed)/i.test(lc)
  ) {
    return { intent: "looks_good", confidence: "high" };
  }

  return low;
}
