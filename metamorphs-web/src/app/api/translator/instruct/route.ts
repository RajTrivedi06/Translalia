import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { allocateDisplayLabel } from "@/server/labels/displayLabel";
import { responsesCall } from "@/lib/ai/openai";
import { getTranslatorSystem } from "@/lib/ai/prompts";
import { parseTranslatorOutput } from "@/server/translator/parse";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";
import { respondLLMError } from "@/lib/http/errors";
import { isPrismaticEnabled } from "@/lib/flags/prismatic";
import { parsePrismatic } from "@/lib/ai/prismaticParser";
import { buildTranslateBundle } from "@/server/translator/bundle";
import { looksLikeEcho } from "@/lib/text/similarity";
import { looksUntranslatedToEnglish } from "@/lib/text/langGate";

const Body = z.object({
  threadId: z.string().uuid(),
  instruction: z.string().min(1),
  citeVersionId: z.string().uuid().optional(),
  mode: z.enum(["balanced", "creative", "prismatic"]).optional(),
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
  const rawMode = (parsed.data.mode as string) || "balanced";
  const effectiveMode =
    isPrismaticEnabled() &&
    ["balanced", "creative", "prismatic"].includes(rawMode)
      ? (rawMode as "balanced" | "creative" | "prismatic")
      : "balanced";
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
    const { data: latestForThread } = await supabase
      .from("versions")
      .select("id, lines, meta, created_at")
      .eq("project_id", projectId)
      .filter("meta->>thread_id", "eq", threadId)
      .order("created_at", { ascending: false })
      .limit(1);
    parentVersionId = latestForThread?.[0]?.id ?? null;
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
  const summary = state.plain_english_summary || state.summary || "";
  const glossary = Array.isArray(state.glossary_terms)
    ? state.glossary_terms
    : [];

  const bundle = await buildTranslateBundle(threadId);

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

  // Fallback: if no explicit citeVersionId but a parentVersionId exists, cite it
  if (!citeVersionId && parentVersionId) {
    const { data: cited } = await supabase
      .from("versions")
      .select("id, lines, meta")
      .eq("id", parentVersionId)
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

  // Normalize target language for prompt display
  const enhancedObjForPrompt = (enhanced ?? {}) as Record<string, unknown>;
  const cfForPrompt = ((state.collected_fields as unknown) ?? {}) as Record<
    string,
    unknown
  >;
  const targetVarietyForPrompt = String(
    (typeof enhancedObjForPrompt["target"] === "string" &&
      (enhancedObjForPrompt["target"] as string)) ||
      (typeof cfForPrompt["target_lang_or_variety"] === "string" &&
        (cfForPrompt["target_lang_or_variety"] as string)) ||
      ""
  ).trim();
  const targetNormForPrompt = /(^|\b)english(\b|$)/i.test(
    targetVarietyForPrompt
  )
    ? "English"
    : targetVarietyForPrompt;

  const bundleUser = [
    `INSTRUCTION:\n${instruction}`,
    `SOURCE_POEM:\n${poem}`,
    Object.keys(enhanced).length
      ? `ENHANCED_REQUEST(JSON):\n${JSON.stringify(enhanced)}`
      : "",
    glossary.length ? `GLOSSARY:\n${JSON.stringify(glossary)}` : "",
    `TARGET_LANGUAGE:\n${targetNormForPrompt}`,
    summary ? `SUMMARY:\n${summary}` : "",
    bundle.journeySummaries?.length
      ? "JOURNEY (most recent → older):\n" +
        bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
      : "",
    citedText ? `CITED_VERSION_FULL_TEXT:\n${citedText}` : "",
    citedText
      ? "Evolve from the cited PRIOR_VERSION only. Make minimal, intentional changes aligned with JOURNEY; do not restart from the source."
      : "",
    // Strengthen instruction against echo
    "CRITICAL: Output MUST be a translation. Do NOT return the source text.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const prompt_hash = buildPromptHash({
      route: "translator",
      model: TRANSLATOR_MODEL,
      system: getTranslatorSystem(effectiveMode),
      user: bundleUser,
    });
    logLLMRequestPreview({
      route: "translator",
      model: TRANSLATOR_MODEL,
      system: getTranslatorSystem(effectiveMode),
      user: bundleUser,
      hash: prompt_hash,
    });
    const respUnknown: unknown = await responsesCall({
      model: TRANSLATOR_MODEL,
      system: getTranslatorSystem(effectiveMode),
      user: bundleUser,
      temperature: 0.6,
    });
    type RespLike = { output_text?: string };
    const resp = respUnknown as RespLike;
    const raw = resp.output_text ?? "";
    let parsedOut: { lines: string[]; notes?: string[] | string };
    try {
      parsedOut = parseTranslatorOutput(raw);
    } catch {
      return NextResponse.json(
        { error: "Translator output malformed", raw },
        { status: 502 }
      );
    }

    // --- Language/Echo gate + single retry (parity with preview) ---
    const enhancedObj = (enhanced ?? {}) as Record<string, unknown>;
    const cf = ((state.collected_fields as unknown) ?? {}) as Record<
      string,
      unknown
    >;
    const targetVariety = String(
      (typeof enhancedObj["target"] === "string" &&
        (enhancedObj["target"] as string)) ||
        (typeof cf["target_lang_or_variety"] === "string" &&
          (cf["target_lang_or_variety"] as string)) ||
        ""
    ).trim();
    const targetNorm = /(^|\b)english(\b|$)/i.test(targetVariety)
      ? "English"
      : targetVariety;

    const sourceLines = poem.split(/\r?\n/).filter(Boolean);
    const outLines1 = Array.isArray(parsedOut.lines) ? parsedOut.lines : [];
    const echoish1 = looksLikeEcho(sourceLines, outLines1);
    const untranslated1 = looksUntranslatedToEnglish(targetNorm, outLines1);
    // Extra guard for English target: treat Hangul-heavy output as untranslated
    const joinedOut1 = outLines1.join(" ");
    const hangulCount1 = (
      joinedOut1.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || []
    ).length;
    const hangulRatio1 = hangulCount1 / Math.max(joinedOut1.length, 1);
    const hangulUntranslated1 = targetNorm === "English" && hangulRatio1 > 0.15;

    if (echoish1 || untranslated1 || hangulUntranslated1) {
      const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language; do NOT echo or quote SOURCE_POEM lines or reproduce non-target script.`;
      const retryUser = bundleUser + hardReq;

      const respRetryUnknown: unknown = await responsesCall({
        model: TRANSLATOR_MODEL,
        system: getTranslatorSystem(effectiveMode),
        user: retryUser,
        temperature: 0.6,
      });
      const respRetry = respRetryUnknown as { output_text?: string };
      const raw2 = respRetry.output_text ?? "";

      if (!raw2) {
        await supabase
          .from("versions")
          .update({
            meta: {
              ...placeholderMeta,
              status: "failed",
              error: "INSTRUCT_RETRY_EMPTY",
            },
          })
          .eq("id", newVersionId);
        return NextResponse.json(
          { ok: false, code: "INSTRUCT_RETRY_EMPTY", retryable: true },
          { status: 502 }
        );
      }

      let parsed2: { lines: string[]; notes?: string[] | string };
      try {
        parsed2 = parseTranslatorOutput(raw2);
      } catch {
        await supabase
          .from("versions")
          .update({
            meta: {
              ...placeholderMeta,
              status: "failed",
              error: "INSTRUCT_PARSE_RETRY_FAILED",
            },
          })
          .eq("id", newVersionId);
        return NextResponse.json(
          { ok: false, code: "INSTRUCT_PARSE_RETRY_FAILED", retryable: true },
          { status: 502 }
        );
      }

      const outLines2 = Array.isArray(parsed2.lines) ? parsed2.lines : [];
      const echoish2 = looksLikeEcho(sourceLines, outLines2);
      const untranslated2 = looksUntranslatedToEnglish(targetNorm, outLines2);
      // Extra guard for English target: treat Hangul-heavy output as untranslated
      const joinedOut2 = outLines2.join(" ");
      const hangulCount2 = (
        joinedOut2.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || []
      ).length;
      const hangulRatio2 = hangulCount2 / Math.max(joinedOut2.length, 1);
      const hangulUntranslated2 =
        targetNorm === "English" && hangulRatio2 > 0.15;

      if (echoish2 || untranslated2 || hangulUntranslated2) {
        await supabase
          .from("versions")
          .update({
            meta: {
              ...placeholderMeta,
              status: "failed",
              error: "INSTRUCT_ECHO_OR_UNTRANSLATED",
            },
          })
          .eq("id", newVersionId);
        return NextResponse.json(
          { ok: false, code: "INSTRUCT_ECHO_OR_UNTRANSLATED", retryable: true },
          { status: 409 }
        );
      }

      // success after retry → adopt parsed2
      parsedOut = parsed2;
    }
    // --- end gate ---

    // --- must_keep enforcement (single retry) ---
    const rawKeeps = (
      state.collected_fields as unknown as { must_keep?: unknown }
    )?.must_keep;
    const mustKeep: string[] = Array.isArray(rawKeeps)
      ? (rawKeeps as unknown[]).map((s) => String(s))
      : typeof rawKeeps === "string"
      ? String(rawKeeps)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (mustKeep.length) {
      const joined1 = (parsedOut.lines || []).join("\n");
      const missing1 = mustKeep.filter((k) => !joined1.includes(k));
      if (missing1.length) {
        const keepReq = `\n\nREQUIREMENT: Preserve EXACT surface forms: ${missing1.join(
          ", "
        )}. Do NOT romanize or translate these tokens.`;
        const respKeepUnknown: unknown = await responsesCall({
          model: TRANSLATOR_MODEL,
          system: getTranslatorSystem(effectiveMode),
          user: bundleUser + keepReq,
          temperature: 0.6,
        });
        const respKeep = respKeepUnknown as { output_text?: string };
        const rawK = respKeep.output_text ?? "";
        let parsedK: { lines: string[]; notes?: string[] | string };
        try {
          parsedK = rawK ? parseTranslatorOutput(rawK) : parsedOut;
        } catch {
          parsedK = parsedOut;
        }
        const joinedK = (parsedK.lines || []).join("\n");
        const missing2 = mustKeep.filter((k) => !joinedK.includes(k));
        if (missing2.length) {
          await supabase
            .from("versions")
            .update({
              meta: {
                ...placeholderMeta,
                status: "failed",
                error: "REQUIRED_TOKENS_MISSING",
              },
            })
            .eq("id", newVersionId);
          return NextResponse.json(
            {
              ok: false,
              code: "REQUIRED_TOKENS_MISSING",
              retryable: true,
              missing: missing2,
            },
            { status: 409 }
          );
        }
        parsedOut = parsedK;
      }
    }
    // --- end must_keep ---

    // Debug: surface first lines and similarity decision
    try {
      console.log(
        "[INSTRUCT] Poem first line:",
        (poem.split("\n")[0] || "").slice(0, 140)
      );
      console.log(
        "[INSTRUCT] Output first line:",
        (parsedOut.lines?.[0] || "").slice(0, 140)
      );
    } catch {}

    const updatedMeta: Record<string, unknown> = {
      ...placeholderMeta,
      status: "generated" as const,
      overview: {
        lines: parsedOut.lines,
        notes: parsedOut.notes,
        line_policy: (bundle as unknown as { line_policy?: unknown })
          ?.line_policy,
      },
    };
    const { error: upErr } = await supabase
      .from("versions")
      .update({ meta: updatedMeta })
      .eq("id", newVersionId);
    if (upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 });

    const sections =
      isPrismaticEnabled() && effectiveMode === "prismatic"
        ? parsePrismatic(raw)
        : undefined;
    return NextResponse.json({
      ok: true,
      versionId: newVersionId,
      displayLabel,
      prompt_hash,
      mode: effectiveMode,
      sections,
    });
  } catch (e) {
    try {
      await supabase
        .from("versions")
        .update({
          meta: {
            ...placeholderMeta,
            status: "failed",
            error: "INSTRUCT_LLM_CALL_FAILED",
          },
        })
        .eq("id", newVersionId);
    } catch {}
    return respondLLMError(e);
  }
}
