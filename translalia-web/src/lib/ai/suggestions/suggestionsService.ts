import { openai } from "@/lib/ai/openai";
import {
  SuggestionsResponseSchema,
  type WordSuggestion,
  type LineSuggestionsRequest,
  type TokenSuggestionsRequest,
} from "./suggestionsSchemas";
import { buildLineSuggestionsPrompt, buildTokenSuggestionsPrompt } from "./suggestionsPromptBuilders";
import { buildAnchorTokenSet, runSuggestionsGate } from "./suggestionsGate";

const SUGGESTION_MODEL = "gpt-4o-mini";
const REPAIR_MODEL = "gpt-4o-mini";

export interface SuggestionsServiceResult {
  ok: boolean;
  suggestions?: WordSuggestion[];
  repaired?: boolean;
  reason?: string;
}

function normalizeResponse(raw: unknown): WordSuggestion[] | null {
  const validated = SuggestionsResponseSchema.safeParse(raw);
  if (!validated.success) return null;
  return validated.data.suggestions;
}

function buildRepairPrompt(targetLanguage: string, suggestions: WordSuggestion[]) {
  const system = `
You are repairing word suggestions for language correctness.
Return ONLY valid JSON with the same structure.

RULES:
- Rewrite ONLY the "word" fields into ${targetLanguage}.
- Keep "use", "fitsWith", "register", "literalness", and "reasoning" as-is.
- Keep word length at 1-3 words.
`.trim();

  const user = `
Fix the "word" fields only. Return JSON:
{
  "suggestions": ${JSON.stringify(suggestions, null, 2)}
}
`.trim();

  return { system, user };
}

async function callModel(
  system: string,
  user: string,
  model: string,
  temperature: number
) {
  const completion = await openai.chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

export async function generateLineSuggestions(params: {
  request: LineSuggestionsRequest;
  guideAnswers: unknown;
  targetLanguage: string;
  sourceLanguage: string;
}): Promise<SuggestionsServiceResult> {
  const { request, guideAnswers, targetLanguage, sourceLanguage } = params;

  const anchors = [
    request.targetLineDraft ?? "",
    request.variantFullTexts?.A ?? "",
    request.variantFullTexts?.B ?? "",
    request.variantFullTexts?.C ?? "",
  ].filter((t) => t.trim().length > 0);
  const anchorTokens = buildAnchorTokenSet(anchors);

  const { system, user } = buildLineSuggestionsPrompt({
    request,
    guideAnswers,
    targetLanguage,
    sourceLanguage,
  });

  const raw = await callModel(system, user, SUGGESTION_MODEL, 0.8);
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][line] Raw model output:", raw);
  }
  const suggestions = normalizeResponse(raw);

  if (!suggestions) {
    return { ok: false, reason: "invalid_response" };
  }

  const gate = runSuggestionsGate(suggestions, {
    targetLanguage,
    anchorTokens,
  });
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][line] Gate:", {
      ok: gate.ok,
      reason: gate.reason,
      rejected: gate.rejectedCount,
      leakedEnglish: gate.leakedEnglishCount,
      nonEnglishScript: gate.nonEnglishScriptCount,
    });
  } else if (!gate.ok) {
    console.warn("[suggestions][line] Gate failed:", {
      reason: gate.reason,
      rejected: gate.rejectedCount,
      leakedEnglish: gate.leakedEnglishCount,
      nonEnglishScript: gate.nonEnglishScriptCount,
    });
  }

  if (!gate.needsRepair) {
    return { ok: gate.ok, suggestions: gate.suggestions };
  }

  console.info("[suggestions][line] Repair attempt triggered:", gate.reason);
  const repairPrompt = buildRepairPrompt(targetLanguage, gate.suggestions);
  const repairedRaw = await callModel(
    repairPrompt.system,
    repairPrompt.user,
    REPAIR_MODEL,
    0.1
  );
  const repaired = normalizeResponse(repairedRaw);
  if (!repaired) {
    return { ok: false, reason: "repair_invalid_response" };
  }

  const repairedGate = runSuggestionsGate(repaired, {
    targetLanguage,
    anchorTokens,
  });
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][line] Repair gate:", {
      ok: repairedGate.ok,
      reason: repairedGate.reason,
      rejected: repairedGate.rejectedCount,
      leakedEnglish: repairedGate.leakedEnglishCount,
      nonEnglishScript: repairedGate.nonEnglishScriptCount,
    });
  } else if (!repairedGate.ok) {
    console.warn("[suggestions][line] Repair failed:", {
      reason: repairedGate.reason,
      rejected: repairedGate.rejectedCount,
      leakedEnglish: repairedGate.leakedEnglishCount,
      nonEnglishScript: repairedGate.nonEnglishScriptCount,
    });
  }

  if (!repairedGate.ok) {
    return { ok: false, reason: repairedGate.reason ?? "repair_failed" };
  }

  return {
    ok: true,
    suggestions: repairedGate.suggestions,
    repaired: true,
  };
}

export async function generateTokenSuggestions(params: {
  request: TokenSuggestionsRequest;
  guideAnswers: unknown;
  targetLanguage: string;
  sourceLanguage: string;
}): Promise<SuggestionsServiceResult> {
  const { request, guideAnswers, targetLanguage, sourceLanguage } = params;

  const anchors = [
    request.targetLineDraft ?? "",
    request.variantFullTexts?.A ?? "",
    request.variantFullTexts?.B ?? "",
    request.variantFullTexts?.C ?? "",
  ].filter((t) => t.trim().length > 0);
  const anchorTokens = buildAnchorTokenSet(anchors);

  const { system, user } = buildTokenSuggestionsPrompt({
    request,
    guideAnswers,
    targetLanguage,
    sourceLanguage,
  });

  const raw = await callModel(system, user, SUGGESTION_MODEL, 0.8);
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][token] Raw model output:", raw);
  }
  const suggestions = normalizeResponse(raw);

  if (!suggestions) {
    return { ok: false, reason: "invalid_response" };
  }

  const gate = runSuggestionsGate(suggestions, {
    targetLanguage,
    anchorTokens,
  });
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][token] Gate:", {
      ok: gate.ok,
      reason: gate.reason,
      rejected: gate.rejectedCount,
      leakedEnglish: gate.leakedEnglishCount,
      nonEnglishScript: gate.nonEnglishScriptCount,
    });
  } else if (!gate.ok) {
    console.warn("[suggestions][token] Gate failed:", {
      reason: gate.reason,
      rejected: gate.rejectedCount,
      leakedEnglish: gate.leakedEnglishCount,
      nonEnglishScript: gate.nonEnglishScriptCount,
    });
  }

  if (!gate.needsRepair) {
    return { ok: gate.ok, suggestions: gate.suggestions };
  }

  console.info("[suggestions][token] Repair attempt triggered:", gate.reason);
  const repairPrompt = buildRepairPrompt(targetLanguage, gate.suggestions);
  const repairedRaw = await callModel(
    repairPrompt.system,
    repairPrompt.user,
    REPAIR_MODEL,
    0.1
  );
  const repaired = normalizeResponse(repairedRaw);
  if (!repaired) {
    return { ok: false, reason: "repair_invalid_response" };
  }

  const repairedGate = runSuggestionsGate(repaired, {
    targetLanguage,
    anchorTokens,
  });
  if (process.env.DEBUG_SUGGESTIONS === "1") {
    console.log("[suggestions][token] Repair gate:", {
      ok: repairedGate.ok,
      reason: repairedGate.reason,
      rejected: repairedGate.rejectedCount,
      leakedEnglish: repairedGate.leakedEnglishCount,
      nonEnglishScript: repairedGate.nonEnglishScriptCount,
    });
  } else if (!repairedGate.ok) {
    console.warn("[suggestions][token] Repair failed:", {
      reason: repairedGate.reason,
      rejected: repairedGate.rejectedCount,
      leakedEnglish: repairedGate.leakedEnglishCount,
      nonEnglishScript: repairedGate.nonEnglishScriptCount,
    });
  }

  if (!repairedGate.ok) {
    return { ok: false, reason: repairedGate.reason ?? "repair_failed" };
  }

  return {
    ok: true,
    suggestions: repairedGate.suggestions,
    repaired: true,
  };
}
