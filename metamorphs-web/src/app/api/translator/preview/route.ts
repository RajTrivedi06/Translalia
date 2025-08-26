import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { TRANSLATOR_SYSTEM } from "@/lib/ai/prompts";
import { moderateText } from "@/lib/ai/moderation";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { rateLimit } from "@/lib/ai/ratelimit";
import { buildTranslateBundle } from "@/server/translator/bundle";
import { parseTranslatorOutput } from "@/server/translator/parse";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { allocateDisplayLabel } from "@/server/labels/displayLabel";

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

  let sb: SupabaseClient = await supabaseServer();
  let me = (await sb.auth.getUser()).data;
  if (!me?.user) {
    const authH = req.headers.get("authorization") || "";
    const token = authH.toLowerCase().startsWith("bearer ")
      ? authH.slice(7)
      : null;
    if (
      token &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      sb = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      me = (await sb.auth.getUser()).data;
    }
    if (!me?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { displayLabel, projectId } = await allocateDisplayLabel(threadId);

  // Create placeholder node
  const placeholderMeta = {
    thread_id: threadId,
    display_label: displayLabel,
    status: "placeholder" as const,
    parent_version_id: null as string | null,
  };
  const { data: inserted, error: insErr } = await sb
    .from("versions")
    .insert({
      project_id: projectId,
      title: displayLabel,
      lines: [],
      meta: placeholderMeta,
      tags: ["translation"],
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message || "Failed to create placeholder" },
      { status: 500 }
    );
  }
  const placeholderId = inserted.id as string;

  const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
  const cached = await cacheGet<unknown>(key);
  if (cached) {
    // Also flip placeholder to generated from cached value
    const cachedPrev = cached as {
      lines?: string[];
      notes?: string[] | string;
    };
    const updatedMeta: Record<string, unknown> = {
      ...placeholderMeta,
      status: "generated" as const,
      overview: {
        lines: cachedPrev?.lines ?? [],
        notes: cachedPrev?.notes ?? [],
        line_policy: bundle.line_policy,
      },
    };
    await sb
      .from("versions")
      .update({ meta: updatedMeta })
      .eq("id", placeholderId);
    const { data: latestAfterCache, error: selErrCached } = await sb
      .from("versions")
      .select("id, meta")
      .eq("id", placeholderId)
      .single();
    if (selErrCached || !(latestAfterCache as any)?.meta?.overview) {
      return NextResponse.json(
        { ok: false, error: "NO_OVERVIEW_PERSISTED", placeholderId },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      preview: cached,
      cached: true,
      debug: bundle.debug,
      versionId: placeholderId,
      displayLabel,
    });
  }

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
    // Update node meta with overview + flip status
    const updatedMeta: Record<string, unknown> = {
      ...placeholderMeta,
      status: "generated" as const,
      overview: {
        lines: parsedOut.lines,
        notes: parsedOut.notes,
      },
    };
    const { error: upErr2 } = await sb
      .from("versions")
      .update({ meta: updatedMeta })
      .eq("id", placeholderId);
    if (upErr2) {
      return NextResponse.json(
        {
          ok: false,
          error: "UPDATE_FAILED_RLS",
          details: upErr2.message,
          placeholderId,
        },
        { status: 500 }
      );
    }
    const { data: latest, error: selErr } = await sb
      .from("versions")
      .select("id, meta")
      .eq("id", placeholderId)
      .single();
    if (selErr || !(latest as any)?.meta?.overview) {
      return NextResponse.json(
        { ok: false, error: "NO_OVERVIEW_PERSISTED", placeholderId },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      preview,
      debug: bundle.debug,
      versionId: placeholderId,
      displayLabel,
    });
  } catch {
    return NextResponse.json(
      { error: "Translator output malformed", raw },
      { status: 502 }
    );
  }
}
