import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { allocateDisplayLabel } from "@/server/labels/displayLabel";
import { getOpenAI } from "@/lib/ai/openai";
import { TRANSLATOR_SYSTEM } from "@/lib/ai/prompts";
import { parseTranslatorOutput } from "@/server/translator/parse";

const Body = z.object({
  threadId: z.string().uuid(),
  instruction: z.string().min(1),
  citeVersionId: z.string().uuid().optional(),
});

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

  const { threadId, instruction, citeVersionId } = parsed.data;
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id, state")
    .eq("id", threadId)
    .single();
  if (thErr || !th)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const { displayLabel, projectId } = await allocateDisplayLabel(threadId);

  let parentVersionId: string | null = null;
  if (citeVersionId) {
    parentVersionId = citeVersionId;
  } else {
    const { data: latest } = await supabase
      .from("versions")
      .select("id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (latest?.length) {
      const forThread = latest.find((r: { meta?: unknown }) => {
        const meta = (r.meta ?? null) as { thread_id?: string } | null;
        return (
          !!meta &&
          typeof meta.thread_id === "string" &&
          meta.thread_id === threadId
        );
      }) as { id?: string } | undefined;
      parentVersionId = (forThread?.id as string) || null;
    }
  }

  const placeholderMeta = {
    thread_id: threadId,
    display_label: displayLabel,
    status: "placeholder" as const,
    parent_version_id: parentVersionId,
  };

  const { data: inserted, error: insErr } = await supabase
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
  if (insErr || !inserted)
    return NextResponse.json(
      { error: insErr?.message || "Failed to create placeholder" },
      { status: 500 }
    );
  const newVersionId = inserted.id as string;

  const state = (th.state as Record<string, unknown>) || {};
  const poem = String(state.poem_excerpt || "").trim();
  const enhanced = state.enhanced_request || {};
  const summary = state.plain_english_summary || state.summary || "";

  let citedText = "";
  if (citeVersionId) {
    const { data: cited } = await supabase
      .from("versions")
      .select("id, lines, meta")
      .eq("id", citeVersionId)
      .single();
    if (cited) {
      const m = ((cited.meta ?? null) as Record<string, unknown>) || {};
      const ov = (m["overview"] as { lines?: string[] } | null) || null;
      const ovLines: string[] = Array.isArray(ov?.lines)
        ? (ov!.lines as string[])
        : [];
      const lnLines: string[] = Array.isArray(cited.lines)
        ? (cited.lines as string[])
        : [];
      const arr = ovLines.length ? ovLines : lnLines;
      citedText = arr.join("\n");
    }
  }

  const bundleUser = [
    `INSTRUCTION:\n${instruction}`,
    `SOURCE_POEM:\n${poem}`,
    Object.keys(enhanced).length
      ? `ENHANCED_REQUEST(JSON):\n${JSON.stringify(enhanced)}`
      : "",
    summary ? `SUMMARY:\n${summary}` : "",
    citedText ? `CITED_VERSION_FULL_TEXT:\n${citedText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = getOpenAI();
  const resp = await client.chat.completions.create({
    model: process.env.TRANSLATOR_MODEL || "gpt-4o",
    temperature: 0.6,
    messages: [
      { role: "system", content: TRANSLATOR_SYSTEM },
      { role: "user", content: bundleUser },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content || "";
  let parsedOut: { lines: string[]; notes?: string[] | string };
  try {
    parsedOut = parseTranslatorOutput(raw);
  } catch {
    return NextResponse.json(
      { error: "Translator output malformed", raw },
      { status: 502 }
    );
  }

  const updatedMeta: Record<string, unknown> = {
    ...placeholderMeta,
    status: "generated" as const,
    overview: {
      lines: parsedOut.lines,
      notes: parsedOut.notes,
    },
  };
  const { error: upErr } = await supabase
    .from("versions")
    .update({ meta: updatedMeta })
    .eq("id", newVersionId);
  if (upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    versionId: newVersionId,
    displayLabel,
  });
}
