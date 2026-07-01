/**
 * Faithful main-gen proof for DeepSeek.
 * Replicates the EXACT request translateLineWithRecipesInternal issues on the
 * json_object main-gen path (the branch DeepSeek takes, since
 * shouldUseStrictSchema("deepseek-v4-flash") === false), using the real
 * production helpers. Proves: real line translates, 3 variants parse, no
 * reasoning_content (thinking disabled).
 *
 * Run: ./node_modules/.bin/tsx ../docs/agent-temp/deepseek-maingen-driver.ts
 *   (cwd = translalia-web)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local into process.env BEFORE importing modules that read it at import time.
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

async function main() {
const { getClientForModel, deepSeekRequestExtras } = await import(
  "@/lib/ai/openai"
);
const { buildSamplingParams } = await import("@/lib/ai/buildSamplingParams");
const { getTokenLimitParam } = await import("@/lib/ai/tokenLimitParam");
const { chatCompletionsWithRetry } = await import(
  "@/lib/ai/chatCompletionsWithRetry"
);
const { shouldUseStrictSchema } = await import(
  "@/lib/translation/method2/mainGenSchema"
);

const model = "deepseek-v4-flash";
console.log("shouldUseStrictSchema:", shouldUseStrictSchema(model), "=> path:", shouldUseStrictSchema(model) ? "json_schema" : "json_object");

// A realistic recipe-driven prismatic prompt (json_object mode relies on the
// prompt for the 3-variant contract, exactly as the pipeline does).
const systemPrompt =
  "You are a literary translator producing prismatic variants. Translate the SOURCE LINE from Spanish to English. Return ONLY a JSON object of the form {\"variants\":[{\"label\":\"A\",\"text\":\"...\"},{\"label\":\"B\",\"text\":\"...\"},{\"label\":\"C\",\"text\":\"...\"}]} with exactly 3 distinct variants. No prose, no markdown.";
const userPrompt =
  "SOURCE LINE (Spanish): \"Verde que te quiero verde.\"\nCONTEXT: opening line of Lorca's Romance Sonámbulo.\nVARIANT RECIPES:\n- A: literal, preserve the repetition of 'verde'.\n- B: musical, prioritise rhythm and incantatory feel.\n- C: interpretive, foreground longing.\nTASK: produce 3 English variants labelled A, B, C.";

const mainGenMaxOutputTokens = Math.min(
  Math.max(300, Number(process.env.MAIN_GEN_MAX_OUTPUT_TOKENS) || 4000),
  5000
);

console.log(`\n== main-gen (json_object) via getClientForModel(${model}) ==`);
const t0 = Date.now();
const completion = await chatCompletionsWithRetry(
  getClientForModel(model),
  {
    model,
    ...buildSamplingParams(model, { temperature: 0.7 }),
    response_format: { type: "json_object" },
    ...getTokenLimitParam(model, mainGenMaxOutputTokens),
    ...deepSeekRequestExtras(model),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  } as Parameters<typeof chatCompletionsWithRetry>[1],
  (text: string) => JSON.parse(text),
  undefined,
  "mainGen",
  { threadId: "probe", lineIndex: 0, stanzaIndex: 0 }
);
const ms = Date.now() - t0;

const msg = completion.choices[0].message;
console.log("latency_ms:", ms);
console.log("finish_reason:", completion.choices[0].finish_reason);
console.log("usage:", JSON.stringify(completion.usage));
console.log(
  "has reasoning_content:",
  Object.prototype.hasOwnProperty.call(msg, "reasoning_content"),
  "=>",
  (msg as { reasoning_content?: unknown }).reasoning_content ?? "(none)"
);
console.log("raw content:\n" + msg.content);

const parsed = JSON.parse(msg.content ?? "{}");
const variants = parsed.variants ?? [];
console.log("\n== validation ==");
console.log("variant count:", variants.length, variants.length === 3 ? "OK" : "FAIL");
console.log("labels:", variants.map((v: { label: string }) => v.label).join(","));
const allParse = Array.isArray(variants) && variants.length === 3 &&
  variants.every((v: { label: string; text: string }) => ["A", "B", "C"].includes(v.label) && typeof v.text === "string" && v.text.length > 0);
console.log("ALL 3 VARIANTS PARSE + WELL-FORMED:", allParse ? "PASS ✅" : "FAIL ❌");
for (const v of variants) console.log(`  ${v.label}: ${v.text}`);
}

main().catch((e) => {
  console.error("DRIVER ERROR:", e?.status, e?.code, "-", e?.message);
  process.exit(1);
});
