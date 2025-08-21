import { z } from "zod";

export const ReferenceItem = z.object({
  type: z.enum(["url", "note"]),
  value: z.string().min(1),
});

export const DecisionsItem = z.object({
  ts: z.string(), // ISO timestamp
  kind: z.string(),
  note: z.string(),
});

export const SessionStateSchema = z.object({
  phase: z
    .enum([
      "welcome",
      "interviewing",
      "await_plan_confirm",
      "translating",
      "review",
      "finalized",
    ])
    .default("welcome"),
  poem_excerpt: z.string().optional(),
  collected_fields: z
    .object({
      target_lang_or_variety: z.string().optional(),
      style_form: z
        .object({
          meter: z.string().optional(),
          rhyme: z.string().optional(),
          tone: z.string().optional(),
        })
        .partial()
        .optional(),
      translanguaging: z
        .object({
          allowed: z.boolean(),
          examples: z.string().optional(),
        })
        .partial()
        .optional(),
      must_keep: z.array(z.string()).optional(),
      must_avoid: z.array(z.string()).optional(),
      line_policy: z.enum(["line-preserving", "free"]).optional(),
      references: z.array(ReferenceItem).optional(),
    })
    .partial()
    .optional(),
  enhanced_request: z.record(z.string(), z.any()).optional(),
  plain_english_summary: z.string().optional(),
  decisions_ledger: z.array(DecisionsItem).optional(),
  summary: z.string().optional(),
  model_prefs: z
    .object({
      enhancer: z.string().optional(),
      translator: z.string().optional(),
      embeddings: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;
export type DecisionsItemType = z.infer<typeof DecisionsItem>;
