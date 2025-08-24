import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { TRANSLATOR_SYSTEM } from "@/lib/ai/prompts";
import { moderateText } from "@/lib/ai/moderation";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { rateLimit } from "@/lib/ai/ratelimit";
import { buildTranslateBundle } from "@/server/translator/bundle";
import { parseTranslatorOutput } from "@/server/translator/parse";

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

  const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
  if (!rl.ok)
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const bundle = await buildTranslateBundle(threadId);
  if (!bundle.poem)
    return NextResponse.json(
      { error: "No poem found in state" },
      { status: 409 }
    );

  const pre = await moderateText(
    bundle.poem + "\n" + JSON.stringify(bundle.enhanced).slice(0, 4000)
  );
  if (pre.flagged)
    return NextResponse.json(
      { error: "Content flagged by moderation; cannot preview." },
      { status: 400 }
    );

  const key = "translator_preview:" + stableHash(bundle);
  const cached = await cacheGet<unknown>(key);
  if (cached)
    return NextResponse.json({
      ok: true,
      preview: cached,
      cached: true,
      debug: bundle.debug,
    });

  const user = [
    `SOURCE_POEM (line_policy=${bundle.line_policy}):\n${bundle.poem}`,
    `ENHANCED_REQUEST (JSON):\n${JSON.stringify(bundle.enhanced)}`,
    bundle.acceptedLines.length
      ? `ACCEPTED_DRAFT_LINES:\n${bundle.acceptedLines.join("\n")}`
      : "",
    bundle.ledgerNotes.length
      ? `DECISIONS (last):\n${bundle.ledgerNotes
          .map((n) => `- ${n}`)
          .join("\n")}`
      : "",
    bundle.summary ? `SUMMARY:\n${bundle.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: process.env.TRANSLATOR_MODEL || "gpt-4o",
    temperature: 0.6,
    messages: [
      { role: "system", content: TRANSLATOR_SYSTEM },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  try {
    const parsedOut = parseTranslatorOutput(raw);
    const preview = {
      ...parsedOut,
      modelUsage: resp.usage,
      line_policy: bundle.line_policy,
    };
    await cacheSet(key, preview, 3600);
    return NextResponse.json({ ok: true, preview, debug: bundle.debug });
  } catch {
    return NextResponse.json(
      { error: "Translator output malformed", raw },
      { status: 502 }
    );
  }
}
