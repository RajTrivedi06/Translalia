import { openai } from "@/lib/ai/openai";
import { VERIFIER_SYSTEM, BACKTRANSLATE_SYSTEM } from "@/lib/ai/prompts";
import { ROUTER_MODEL, ENHANCER_MODEL } from "@/lib/models";
import {
  VERIFICATION_OUTPUT,
  BACKTRANSLATE_OUTPUT,
  type VerificationOutput,
  type BacktranslateOutput,
} from "@/lib/ai/schemas";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";

const VERIFIER_MODEL = process.env.VERIFIER_MODEL?.trim() || ROUTER_MODEL;
const BACKTRANSLATE_MODEL =
  process.env.BACKTRANSLATE_MODEL?.trim() || ENHANCER_MODEL;

export async function runVerification({
  source,
  candidate,
}: {
  source: string;
  candidate: string;
}): Promise<
  | { ok: true; data: VerificationOutput; prompt_hash: string }
  | { ok: false; error: string; prompt_hash?: string }
> {
  const user = `SOURCE:\n${source}\n\nCANDIDATE:\n${candidate}`;
  const prompt_hash = buildPromptHash({
    route: "verify",
    model: VERIFIER_MODEL,
    system: VERIFIER_SYSTEM,
    user,
  });
  logLLMRequestPreview({
    route: "verify",
    model: VERIFIER_MODEL,
    system: VERIFIER_SYSTEM,
    user,
    hash: prompt_hash,
  });
  const r = await openai.responses.create({
    model: VERIFIER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VERIFIER_SYSTEM },
      { role: "user", content: user },
    ],
  } as any);
  const text = (r as any).output_text ?? (r as any).content?.[0]?.text ?? "";
  try {
    return {
      ok: true,
      data: VERIFICATION_OUTPUT.parse(JSON.parse(text)),
      prompt_hash,
    };
  } catch {
    return { ok: false, error: "Verifier JSON invalid", prompt_hash };
  }
}

export async function runBacktranslate({
  candidate,
}: {
  candidate: string;
}): Promise<
  | { ok: true; data: BacktranslateOutput; prompt_hash: string }
  | { ok: false; error: string; prompt_hash?: string }
> {
  const user = `CANDIDATE:\n${candidate}`;
  const prompt_hash = buildPromptHash({
    route: "backtranslate",
    model: BACKTRANSLATE_MODEL,
    system: BACKTRANSLATE_SYSTEM,
    user,
  });
  logLLMRequestPreview({
    route: "backtranslate",
    model: BACKTRANSLATE_MODEL,
    system: BACKTRANSLATE_SYSTEM,
    user,
    hash: prompt_hash,
  });
  const r = await openai.responses.create({
    model: BACKTRANSLATE_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: BACKTRANSLATE_SYSTEM },
      { role: "user", content: user },
    ],
  } as any);
  const text = (r as any).output_text ?? (r as any).content?.[0]?.text ?? "";
  try {
    return {
      ok: true,
      data: BACKTRANSLATE_OUTPUT.parse(JSON.parse(text)),
      prompt_hash,
    };
  } catch {
    return { ok: false, error: "Back-translation JSON invalid", prompt_hash };
  }
}
