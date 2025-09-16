import { NextResponse } from "next/server";
import { z } from "zod";
import { responsesCall } from "@/lib/ai/openai";
import { moderateText } from "@/lib/ai/moderation";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState } from "@/server/threadState";
import { TranslatorOutputSchema } from "@/types/llm";
import { TRANSLATOR_SYSTEM } from "@/lib/ai/prompts";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { respondLLMError } from "@/lib/http/errors";

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
  // Enforce target variety collected via Interview
  const hasTarget = Boolean(
    (enhanced as { target?: unknown } | undefined)?.target ||
      (
        state.collected_fields as
          | { target_lang_or_variety?: unknown }
          | undefined
      )?.target_lang_or_variety
  );
  if (!hasTarget) {
    return NextResponse.json(
      { error: "MISSING_TARGET_VARIETY", code: "MISSING_TARGET_VARIETY" },
      { status: 422 }
    );
  }
  const summary = state.summary ?? "";
  const glossaryRaw = (state as unknown as { glossary_terms?: unknown })
    .glossary_terms;
  const glossary = Array.isArray(glossaryRaw)
    ? (glossaryRaw as Array<{
        term: string;
        origin?: string;
        dialect_marker?: string;
        source?: string;
      }>)
    : [];
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

  const bundle = { poem, enhanced, summary, ledger, acceptedLines, glossary };
  const key = "translate:" + stableHash(bundle);
  const cached = await cacheGet<unknown>(key);
  if (cached)
    return NextResponse.json({ ok: true, result: cached, cached: true });

  const system = TRANSLATOR_SYSTEM;

  const user = [
    "SOURCE_POEM:\n" + poem,
    "ENHANCED_REQUEST (JSON):\n" + JSON.stringify(enhanced, null, 2),
    glossary.length ? "GLOSSARY:\n" + JSON.stringify(glossary) : "",
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

  try {
    const respUnknown: unknown = await responsesCall({
      model: TRANSLATOR_MODEL,
      system,
      user,
      temperature: 0.6,
    });
    type RespLike = { output_text?: string; usage?: unknown };
    const resp = respUnknown as RespLike;
    const out = resp.output_text ?? "";
    const [, afterA] = out.split(/---VERSION A---/i);
    const [poemOutRaw, notesRawSection] = (afterA || "").split(/---NOTES---/i);
    const poemOut = (poemOutRaw || "").trim();
    const notesList = (notesRawSection || "")
      .split("\n")
      .map((l: string) => l.replace(/^\s*[-•]\s?/, "").trim())
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
    return NextResponse.json({
      ok: true,
      result,
      usage: resp.usage,
    });
  } catch (e) {
    return respondLLMError(e);
  }
}
