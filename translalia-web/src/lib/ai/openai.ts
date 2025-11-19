import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}

export type AuditContext = {
  createdBy?: string; // user.id
  projectId?: string | null;
  threadId?: string | null;
  stage?: string; // e.g., 'journey-reflection', 'workshop-options', 'ai-assist'
  provider?: string; // e.g., 'openai'
};

export type ResponsesCallOptions = {
  model: string;
  system: string;
  user: string | Array<{ role: "user" | "system"; content: string }>;
  temperature?: number;
  top_p?: number;
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: unknown };
  auditContext?: AuditContext;
};

function isNonGenerative(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes("moderation") ||
    m.includes("embedding") ||
    m.includes("audio") ||
    m.includes("tts") ||
    m.includes("transcribe") ||
    m.includes("realtime")
  );
}

// dev-only debug export removed (unused)

export async function responsesCall({
  model,
  system,
  user,
  temperature,
  top_p,
  response_format,
  auditContext,
}: ResponsesCallOptions) {
  const args: Record<string, unknown> = { model };
  const nonGen = isNonGenerative(model);
  if (!nonGen && typeof temperature === "number")
    args.temperature = temperature;
  if (!nonGen && typeof top_p === "number") args.top_p = top_p;
  if (typeof user === "string") {
    args.instructions = system;
    args.input = user;
  } else {
    args.input = [{ role: "system", content: system }, ...user];
  }
  if (!nonGen && response_format) args.response_format = response_format;

  const start = Date.now();
  try {
    const result = await openai.responses.create(
      args as unknown as Parameters<typeof openai.responses.create>[0]
    );

    // Log audit asynchronously (fire and forget)
    if (auditContext?.createdBy || auditContext?.stage) {
      logAuditAsync({
        model,
        system,
        user: typeof user === "string" ? user : user,
        result,
        duration: Date.now() - start,
        auditContext,
      }).catch(() => {
        // Swallow audit logging errors
      });
    }

    return result;
  } catch (e: unknown) {
    const err = e as { error?: { message?: string } } | { message?: string };
    const errObj = (err as { error?: { message?: string } })?.error;
    const msg = String(
      errObj?.message || (err as { message?: string })?.message || ""
    );
    const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
    if (unsupportedTemp) {
      const retryArgs: Record<string, unknown> = { ...args };
      delete (retryArgs as Record<string, unknown> & { temperature?: unknown })
        .temperature;
      delete (retryArgs as Record<string, unknown> & { top_p?: unknown }).top_p;
      delete (
        retryArgs as Record<string, unknown> & { response_format?: unknown }
      ).response_format;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[responsesCall:fallback:no-temperature]", { model });
      }
      const result = await openai.responses.create(
        retryArgs as unknown as Parameters<typeof openai.responses.create>[0]
      );

      // Log audit asynchronously (fire and forget)
      if (auditContext?.createdBy || auditContext?.stage) {
        logAuditAsync({
          model,
          system,
          user: typeof user === "string" ? user : user,
          result,
          duration: Date.now() - start,
          auditContext,
        }).catch(() => {
          // Swallow audit logging errors
        });
      }

      return result;
    }
    throw e;
  }
}

/**
 * Asynchronous audit logging (fire and forget).
 * This function runs in the background and doesn't block the response.
 */
async function logAuditAsync({
  model,
  system,
  user,
  result,
  duration,
  auditContext,
}: {
  model: string;
  system: string;
  user: string | Array<{ role: "user" | "system"; content: string }>;
  result: unknown;
  duration: number;
  auditContext: AuditContext;
}) {
  try {
    const { maskPrompts } = await import("@/server/audit/mask");
    const { insertPromptAudit } = await import(
      "@/server/audit/insertPromptAudit"
    );

    const userStr =
      typeof user === "string"
        ? user
        : user
            .map((m) => m.content)
            .join("\n");

    const { promptSystemMasked, promptUserMasked, redactions } = maskPrompts(
      system,
      userStr,
      { maxChars: 400 }
    );

    // Extract response excerpt
    let excerpt: string | null = null;
    try {
      if (typeof result === "string") {
        excerpt = result.slice(0, 400);
      } else if (result && typeof result === "object") {
        excerpt = JSON.stringify(result).slice(0, 400);
      }
    } catch {
      // Ignore excerpt extraction errors
    }

    await insertPromptAudit({
      createdBy: auditContext.createdBy || "unknown",
      projectId: auditContext.projectId ?? null,
      threadId: auditContext.threadId ?? null,
      stage: auditContext.stage || "unknown",
      provider: auditContext.provider || "openai",
      model,
      params: {
        duration_ms: duration,
      },
      promptSystemMasked,
      promptUserMasked,
      responseExcerpt: excerpt,
      redactions: redactions.map((r) => r.type),
    });
  } catch {
    // Silently swallow all errors to not impact user flows
  }
}
