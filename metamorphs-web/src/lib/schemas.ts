import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().trim().max(120).optional(),
  src_lang: z.string().trim().max(32).optional(),
  tgt_langs: z.array(z.string()).optional(),
});

export const createThreadSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().max(120).optional(),
});

export const createMessageSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]).optional(),
  meta: z.record(z.any()).optional(),
});

export const createVersionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  lines: z.array(z.string()).min(1),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
  summary: z.string().optional(),
});

export const createCompareSchema = z.object({
  projectId: z.string().uuid(),
  leftId: z.string().uuid(),
  rightId: z.string().uuid(),
  lens: z.enum(["meaning", "form", "tone", "culture"]).optional(),
  granularity: z.enum(["line", "phrase", "char"]).optional(),
  notes: z.string().optional(),
});
