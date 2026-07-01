// Temp probe: validate DeepSeek model id + credit + thinking-disable.
// Reads DEEPSEEK_API_KEY from translalia-web/.env.local. Run: node docs/agent-temp/deepseek-probe.mjs
import { readFileSync } from "node:fs";
import OpenAI from "./../../translalia-web/node_modules/openai/index.mjs";

const env = readFileSync(new URL("../../translalia-web/.env.local", import.meta.url), "utf8");
const key = env.split("\n").find((l) => l.startsWith("DEEPSEEK_API_KEY="))?.slice("DEEPSEEK_API_KEY=".length).trim();
if (!key) throw new Error("no DEEPSEEK_API_KEY");

const client = new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });

console.log("== listing models ==");
try {
  const models = await client.models.list();
  console.log("served ids:", models.data.map((m) => m.id));
} catch (e) {
  console.log("models.list error:", e?.status, e?.message);
}

for (const model of ["deepseek-v4-flash", "deepseek-chat"]) {
  console.log(`\n== chat completion: model=${model} (thinking disabled) ==`);
  try {
    const res = await client.chat.completions.create({
      model,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON." },
        { role: "user", content: 'Reply with {"ok":true}.' },
      ],
    });
    const msg = res.choices[0].message;
    console.log("content:", msg.content);
    console.log("has reasoning_content:", Object.prototype.hasOwnProperty.call(msg, "reasoning_content"), "=>", msg.reasoning_content ?? "(none)");
  } catch (e) {
    console.log("ERROR:", e?.status, e?.code, "-", e?.message);
  }
}
