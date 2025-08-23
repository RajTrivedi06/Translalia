import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { moderateText } from "@/lib/ai/moderation";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState } from "@/server/threadState";
import { TranslatorOutputSchema } from "@/types/llm";

const Body = z.object({ threadId: z.string().uuid() });

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );

  const { threadId } = parsed.data;

  const supabase = await supabaseServer();
  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const state = await getThreadState(threadId);
  if (state.phase !== "translating" && state.phase !== "review") {
    return NextResponse.json(
      { error: "Not ready to translate" },
      { status: 409 }
    );
  }

  const poem = (state.poem_excerpt ?? "").trim();
  const enhanced = state.enhanced_request ?? {};
  const summary = state.summary ?? "";
  const ledger = (state.decisions_ledger ?? []).slice(-5);

  const { data: accepted } = await supabase.rpc("get_accepted_version", {
    p_thread_id: threadId,
  });
  const acceptedLines = Array.isArray(accepted?.lines) ? accepted.lines : [];

  const pre = await moderateText([poem, JSON.stringify(enhanced)].join("\n\n"));
  if (pre.flagged) {
    return NextResponse.json(
      { error: "Content flagged by moderation; cannot translate." },
      { status: 400 }
    );
  }

  const bundle = { poem, enhanced, summary, ledger, acceptedLines };
  const key = "translate:" + stableHash(bundle);
  const cached = await cacheGet<unknown>(key);
  if (cached)
    return NextResponse.json({ ok: true, result: cached, cached: true });

  const system = [
    "You are a decolonial poetry translator.",
    "Priorities:",
    "1) Preserve core meaning and key images.",
    "2) Honor requested dialect/variety; allow translanguaging; do NOT standardize unless asked.",
    "3) Satisfy poetic constraints when specified; otherwise focus on musicality and cadence.",
    "4) Keep formatting when 'line-preserving'.",
    "Process:",
    "A) Read SOURCE_POEM and ENHANCED_REQUEST. If constraints conflict, explain trade-offs briefly.",
    "B) Output exactly:",
    "---VERSION A---",
    "<poem>",
    "---NOTES---",
    "- 2–5 bullets: key choices, risky shifts, cultural decisions.",
  ].join("\n");

  const user = [
    "SOURCE_POEM:\n" + poem,
    "ENHANCED_REQUEST (JSON):\n" + JSON.stringify(enhanced, null, 2),
    acceptedLines.length
      ? "ACCEPTED_DRAFT_LINES:\n" + acceptedLines.join("\n")
      : "",
    ledger.length
      ? "DECISIONS (last):\n" + ledger.map((l) => `- ${l.note}`).join("\n")
      : "",
    summary ? "SUMMARY:\n" + summary : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: process.env.TRANSLATOR_MODEL || "gpt-4o",
    temperature: 0.6,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const out = resp.choices[0]?.message?.content ?? "";
  const [, afterA] = out.split(/---VERSION A---/i);
  const [poemOutRaw, notesRawSection] = (afterA || "").split(/---NOTES---/i);
  const poemOut = (poemOutRaw || "").trim();
  const notesList = (notesRawSection || "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-•]\s?/, "").trim())
    .filter(Boolean)
    .slice(0, 10);

  const parsedOut = TranslatorOutputSchema.safeParse({
    versionA: poemOut,
    notes: notesList,
  });
  if (!parsedOut.success) {
    return NextResponse.json(
      { error: "Translator output invalid", raw: out },
      { status: 502 }
    );
  }

  const post = await moderateText(
    parsedOut.data.versionA + "\n" + parsedOut.data.notes.join("\n")
  );
  const blocked = post.flagged;

  const result = { ...parsedOut.data, blocked };
  await cacheSet(key, result, 3600);
  return NextResponse.json({ ok: true, result, usage: resp.usage });
}
