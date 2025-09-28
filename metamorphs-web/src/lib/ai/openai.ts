import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}

export type ResponsesCallOptions = {
  model: string;
  system: string;
  user: string | Array<{ role: "user" | "system"; content: string }>;
  temperature?: number;
  top_p?: number;
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: unknown };
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

// Exported only for dev logging at route layer
export const __isNonGenerativeForDebug = isNonGenerative;

export async function responsesCall({
  model,
  system,
  user,
  temperature,
  top_p,
  response_format,
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
  try {
    return await openai.responses.create(
      args as unknown as Parameters<typeof openai.responses.create>[0]
    );
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
      return await openai.responses.create(
        retryArgs as unknown as Parameters<typeof openai.responses.create>[0]
      );
    }
    throw e;
  }
}
