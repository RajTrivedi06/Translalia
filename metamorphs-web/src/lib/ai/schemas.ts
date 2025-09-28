import { z } from "zod";

export const VERIFICATION_OUTPUT = z.object({
  scores: z.object({
    fidelity: z.number().min(0).max(1),
    dialect: z.number().min(0).max(1),
    metaphor: z.number().min(0).max(1),
    anti_echo: z.number().min(0).max(1),
    style_era: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  advice: z.string().max(280),
});
export type VerificationOutput = z.infer<typeof VERIFICATION_OUTPUT>;

export const BACKTRANSLATE_OUTPUT = z.object({
  back_translation: z.string().max(1200),
  drift: z.enum(["none", "minor", "major"]),
  notes: z.string().max(300),
});
export type BacktranslateOutput = z.infer<typeof BACKTRANSLATE_OUTPUT>;

// NOTE(cursor): the rest of schemas existed prior; keep single z import at top

/** Enhancer payload — server truth */
export const ENHANCER_PAYLOAD = z.object({
  summary: z.string(),
  enhanced_request: z.object({
    dialect: z.string(),
    style: z.string(),
    tone: z.string(),
    constraints: z.array(z.string()),
    anti_echo: z.enum(["strict", "medium", "light"]),
  }),
  glossary_terms: z.array(
    z.object({
      term: z.string(),
      origin: z.string().optional(),
      dialect_marker: z.string().optional(),
      source: z.string().optional(),
    })
  ),
  warnings: z.array(z.string()),
});
export type EnhancerPayload = z.infer<typeof ENHANCER_PAYLOAD>;

/** Router outputs — accept either intent or route shape (back-compat) */
export const ROUTER_INTENT = z.object({
  intent: z.enum([
    "poem_input",
    "interview_answer",
    "looks_good",
    "help",
    "status",
    "restart",
    "out_of_scope",
  ]),
  confidence: z.number().min(0).max(1),
});
export const ROUTER_ROUTE = z.object({
  route: z.enum(["translator", "enhancer", "router"]),
  confidence: z.number().min(0).max(1),
});
export const ROUTER_OUTPUT = z.union([ROUTER_INTENT, ROUTER_ROUTE]);
export type RouterOutput = z.infer<typeof ROUTER_OUTPUT>;
