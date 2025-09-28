import { openai } from "@/lib/ai/openai";
import { getTranslatorSystem } from "@/lib/ai/prompts";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";
import { parsePrismatic } from "@/lib/ai/prismaticParser";
import { isPrismaticEnabled } from "@/lib/flags/prismatic";

// Jaccard over 4-grams
function jaccard4(a: string, b: string) {
  const grams = (s: string) => {
    const toks = s.toLowerCase().replace(/\s+/g, " ").split(" ");
    const out = new Set<string>();
    for (let i = 0; i <= toks.length - 4; i++)
      out.add(toks.slice(i, i + 4).join(" "));
    return out;
  };
  const A = grams(a),
    B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

// Simple longest-common-substring ratio
function lcsRatio(a: string, b: string) {
  const s = a.replace(/\s+/g, " ").toLowerCase();
  const t = b.replace(/\s+/g, " ").toLowerCase();
  const n = Math.min(s.length, t.length);
  if (n === 0) return 0;
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    for (let j = 0, k = 0; j < t.length; j++) {
      while (i + k < s.length && j + k < t.length && s[i + k] === t[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best / n;
}

function repetitionRatio(poem: string) {
  const lines = poem
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length < 2) return 0;
  const uniq = new Set(lines).size;
  return (lines.length - uniq) / lines.length; // 0..1
}

export function echoThreshold(poem: string) {
  const tokens = poem.trim().split(/\s+/).filter(Boolean).length;
  let t = tokens <= 20 ? 0.6 : tokens <= 60 ? 0.45 : 0.35;
  // Refrain-heavy poems: small leniency
  const lines = poem
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const uniq = new Set(lines).size;
    const repetition = (lines.length - uniq) / lines.length;
    if (repetition >= 0.2) t += 0.05;
  }
  const env = process.env.ECHO_THRESHOLD;
  return env ? Number(env) : t;
}

function echoScore(src: string, out: string) {
  return Math.max(jaccard4(src, out), lcsRatio(src, out));
}

export async function translateWithAntiEcho({
  poem,
  constraints,
  temperature = 0.7,
  top_p,
  mode = "balanced",
}: {
  poem: string;
  constraints?: Record<string, unknown>;
  temperature?: number;
  top_p?: number;
  mode?: "balanced" | "creative" | "prismatic";
}) {
  const effectiveMode = isPrismaticEnabled() ? mode : "balanced";
  const user = [
    `SOURCE_POEM:\n${poem}`,
    constraints ? `CONSTRAINTS:\n${JSON.stringify(constraints)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const system = getTranslatorSystem(effectiveMode);
  const base = {
    model: TRANSLATOR_MODEL,
    temperature,
    ...(top_p ? { top_p } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ] as const,
  };

  // First pass
  const prompt_hash = buildPromptHash({
    route: "translator",
    model: TRANSLATOR_MODEL,
    system,
    user,
  });
  logLLMRequestPreview({
    route: "translator",
    model: TRANSLATOR_MODEL,
    system,
    user,
    hash: prompt_hash,
  });
  let r = await openai.responses.create(
    base as unknown as Parameters<typeof openai.responses.create>[0]
  );
  const out = (r as unknown as { output_text?: string }).output_text ?? "";
  if (!out) throw new Error("Empty translation output");

  // Echo check
  const thresh = echoThreshold(poem);
  if (echoScore(poem, out) < thresh) {
    if (effectiveMode !== "prismatic") {
      return {
        text: out,
        retries: 0,
        prompt_hash,
        mode: effectiveMode,
      } as const;
    }
    const sections = parsePrismatic(out);
    return {
      text: out,
      sections,
      retries: 0,
      prompt_hash,
      mode: effectiveMode,
    } as const;
  }

  // One retry, stronger wording + slightly higher temperature
  r = await openai.responses.create({
    ...base,
    temperature: Math.min(1.0, temperature + 0.2),
    messages: [
      {
        role: "system",
        content:
          system + "\n\nCRITICAL: Do NOT copy phrases; paraphrase all lines.",
      },
      { role: "user", content: user },
    ],
  } as unknown as Parameters<typeof openai.responses.create>[0]);
  const out2 = (r as unknown as { output_text?: string }).output_text ?? out;
  if (effectiveMode !== "prismatic") {
    return {
      text: out2,
      retries: 1,
      prompt_hash,
      mode: effectiveMode,
    } as const;
  }
  const sections2 = parsePrismatic(out2);
  return {
    text: out2,
    sections: sections2,
    retries: 1,
    prompt_hash,
    mode: effectiveMode,
  } as const;
}
