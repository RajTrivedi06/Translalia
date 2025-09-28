import { NextResponse } from "next/server";
import { z } from "zod";
import {
  responsesCall,
  type ResponsesCallOptions,
  __isNonGenerativeForDebug,
} from "@/lib/ai/openai";
import { getTranslatorSystem } from "@/lib/ai/prompts";
import { moderateText } from "@/lib/ai/moderation";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { rateLimit } from "@/lib/ai/ratelimit";
import { buildTranslateBundle } from "@/server/translator/bundle";
import { parseTranslatorOutput } from "@/server/translator/parse";
import { supabaseServer } from "@/lib/supabaseServer";
import { type SupabaseClient } from "@supabase/supabase-js";
import { allocateDisplayLabel } from "@/server/labels/displayLabel";
import { looksLikeEcho } from "@/lib/text/similarity";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";
import { requireUser } from "@/lib/auth/requireUser";
import { respondLLMError, jsonError } from "@/lib/http/errors";
import { isPrismaticEnabled } from "@/lib/flags/prismatic";
import { parsePrismatic } from "@/lib/ai/prismaticParser";
import { getThreadState } from "@/server/threadState";
import { looksUntranslatedToEnglish } from "@/lib/text/langGate";

const Body = z.object({
  threadId: z.string().uuid(),
  forceTranslate: z.boolean().optional(),
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
  const { threadId, forceTranslate } = parsed.data;
  const rawMode = (parsed.data.mode as string) || "balanced";
  const effectiveMode =
    isPrismaticEnabled() &&
    ["balanced", "creative", "prismatic"].includes(rawMode)
      ? (rawMode as "balanced" | "creative" | "prismatic")
      : "balanced";

  const { user: currentUser, response } = await requireUser();
  if (!currentUser) return response;

  const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
  if (!rl.ok) {
    const retryAfterSec = rl.retryAfterSec ?? 60;
    return jsonError(429, "Too Many Requests", { retryAfterSec });
  }

  // Normalize target variety inputs from request or server state
  const fromBundle = (body?.bundle?.collected_fields?.targetVariety ??
    body?.bundle?.collected_fields?.target_lang_or_variety ??
    "") as unknown;
  const fromInterview = (body?.interview?.answers?.targetVariety ??
    body?.interview?.answers?.target_lang_or_variety ??
    "") as unknown;

  const state = await getThreadState(threadId);
  const fields = (state.collected_fields as Record<string, unknown>) || {};
  const fromState = (function () {
    const candidates = [
      fields["target_lang_or_variety"],
      fields["target_language"],
      fields["language"],
      fields["TARGET_LANGUAGE"],
    ];
    return candidates.find((v) => typeof v === "string" && v.trim());
  })();

  const targetVariety = String(
    (typeof fromBundle === "string" && fromBundle) ||
      (typeof fromInterview === "string" && fromInterview) ||
      (typeof fromState === "string" && fromState) ||
      ""
  ).trim();

  const targetNorm = /(^|\b)english(\b|$)/i.test(targetVariety)
    ? "English"
    : targetVariety;

  if (process.env.NODE_ENV !== "production") {
    console.log("[preview:payload:keys]", {
      hasBundleTarget: Boolean(fromBundle && String(fromBundle).trim()),
      hasInterviewTarget: Boolean(
        fromInterview && String(fromInterview).trim()
      ),
      hasStateTarget: Boolean(fromState && String(fromState).trim()),
      final: targetVariety,
    });
  }

  const bundle = await buildTranslateBundle(threadId);
  if (!bundle.poem)
    return NextResponse.json(
      { error: "No poem found in state" },
      { status: 409 }
    );
  // Enforce target variety collected via Interview (normalized)
  const hasTarget = Boolean(targetVariety);
  if (!hasTarget) {
    return NextResponse.json(
      { error: "MISSING_TARGET_VARIETY", code: "MISSING_TARGET_VARIETY" },
      { status: 422 }
    );
  }

  const pre = await moderateText(
    bundle.poem + "\n" + JSON.stringify(bundle.enhanced).slice(0, 4000)
  );
  if (pre.flagged)
    return NextResponse.json(
      { error: "Content flagged by moderation; cannot preview." },
      { status: 400 }
    );

  const sb: SupabaseClient = await supabaseServer();
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
      {
        error: insErr?.message || "Failed to create placeholder",
        code: "INSERT_FAILED_RLS",
      },
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
    if (
      selErrCached ||
      !(latestAfterCache as unknown as { meta?: { overview?: unknown } })?.meta
        ?.overview
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_OVERVIEW_PERSISTED",
          code: "NO_OVERVIEW_PERSISTED",
          placeholderId,
        },
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

  const force = forceTranslate
    ? "\n\nHARD REQUIREMENT: Output must be in the target language; do NOT echo the source lines verbatim or near-verbatim.\n"
    : "";
  const userPrompt =
    [
      `SOURCE_POEM (line_policy=${bundle.line_policy}):\n${bundle.poem}`,
      `ENHANCED_REQUEST (JSON):\n${JSON.stringify(bundle.enhanced)}`,
      bundle.glossary?.length
        ? `GLOSSARY:\n${JSON.stringify(bundle.glossary)}`
        : "",
      bundle.acceptedLines.length
        ? `ACCEPTED_DRAFT_LINES:\n${bundle.acceptedLines.join("\n")}`
        : "",
      bundle.ledgerNotes.length
        ? `DECISIONS (last):\n${bundle.ledgerNotes
            .map((n) => `- ${n}`)
            .join("\n")}`
        : "",
      `TARGET_LANGUAGE:\n${targetNorm}`,
      bundle.summary ? `SUMMARY:\n${bundle.summary}` : "",
      bundle.journeySummaries?.length
        ? "JOURNEY (most recent → older):\n" +
          bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n") + force;

  try {
    const prompt_hash = buildPromptHash({
      route: "translator",
      model: TRANSLATOR_MODEL,
      system: getTranslatorSystem(effectiveMode),
      user: userPrompt,
    });
    logLLMRequestPreview({
      route: "translator",
      model: TRANSLATOR_MODEL,
      system: getTranslatorSystem(effectiveMode),
      user: userPrompt,
      hash: prompt_hash,
    });
    const model = TRANSLATOR_MODEL;
    const ml = model.toLowerCase();
    if (ml.includes("moderation") || ml.includes("embedding")) {
      console.warn("[translator:bad-model]", { model });
      return NextResponse.json(
        {
          error: "Bad configuration: TRANSLATOR_MODEL must be a text model",
        },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      const nonGen = __isNonGenerativeForDebug?.(model) ?? false;
      console.log("[preview:model/args]", {
        model,
        passingTemperature: !nonGen,
      });
    }
    const respUnknown: unknown = await responsesCall({
      model,
      system: getTranslatorSystem(effectiveMode),
      user: userPrompt,
      temperature: 0.6,
    } as ResponsesCallOptions);
    type RespLike = { output_text?: string; usage?: unknown };
    const resp = respUnknown as RespLike;
    const raw = resp.output_text ?? "";
    if (!raw) {
      return NextResponse.json(
        { error: "LLM returned empty output" },
        { status: 502 }
      );
    }
    try {
      const parsedOut = parseTranslatorOutput(raw);
      const preview = {
        ...parsedOut,
        modelUsage: resp.usage,
        line_policy: bundle.line_policy,
      };
      const sections =
        isPrismaticEnabled() && effectiveMode === "prismatic"
          ? parsePrismatic(raw)
          : undefined;
      // Server-side anti-echo + language gate; one-shot retry with stronger directive
      const sourceLines = String(bundle.poem).split(/\r?\n/).filter(Boolean);
      const outLines = Array.isArray(parsedOut.lines) ? parsedOut.lines : [];

      const echoish = looksLikeEcho(sourceLines, outLines);
      const untranslated = looksUntranslatedToEnglish(targetNorm, outLines);

      if (!forceTranslate && (echoish || untranslated)) {
        const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language (English if requested).\nDo NOT echo or quote SOURCE_POEM lines or reproduce Urdu/Arabic script.\nPreserve the ghazal mechanics (radif/qaafiya) by transliterating refrains (e.g., "hai — hai?") if needed.`;

        const retryUser = userPrompt + hardReq;

        if (process.env.NODE_ENV !== "production") {
          console.warn("[preview:auto-retry:force-translate]", {
            threadId,
            reason: { echoish, untranslated },
          });
        }

        const respRetryUnknown: unknown = await responsesCall({
          model,
          system: getTranslatorSystem(effectiveMode),
          user: retryUser,
          temperature: 0.6,
        } as ResponsesCallOptions);

        const respRetry = respRetryUnknown as {
          output_text?: string;
          usage?: unknown;
        };
        const raw2 = respRetry.output_text ?? "";
        if (!raw2) {
          return NextResponse.json(
            {
              ok: false,
              code: "RETRY_EMPTY",
              error: "LLM returned empty output on retry.",
            },
            { status: 502 }
          );
        }

        const parsed2 = parseTranslatorOutput(raw2);
        const out2 = Array.isArray(parsed2.lines) ? parsed2.lines : [];
        const echoish2 = looksLikeEcho(sourceLines, out2);
        const untranslated2 = looksUntranslatedToEnglish(targetNorm, out2);

        if (echoish2 || untranslated2) {
          // Mark placeholder failed before returning 409
          try {
            const failMeta: Record<string, unknown> = {
              ...placeholderMeta,
              status: "failed" as const,
              error: "PREVIEW_ECHOED_SOURCE",
            };
            await sb
              .from("versions")
              .update({ meta: failMeta })
              .eq("id", placeholderId);
          } catch {}
          return NextResponse.json(
            {
              ok: false,
              code: "PREVIEW_ECHOED_SOURCE",
              error: "Model echoed/left source language after retry.",
              retryable: true,
            },
            { status: 409 }
          );
        }

        // Success after retry: update preview output and usage
        preview.lines = parsed2.lines;
        preview.notes = parsed2.notes;
        preview.modelUsage = respRetry.usage;
      }
      // --- must_keep enforcement (single retry) ---
      const enhancedObj = (bundle?.enhanced ?? {}) as Record<string, unknown>;
      const cfObj = ((state?.collected_fields as unknown) ?? {}) as Record<
        string,
        unknown
      >;
      const rawKeeps = (enhancedObj["must_keep"] ?? cfObj["must_keep"]) as
        | unknown[]
        | string
        | undefined;
      const mustKeep: string[] = Array.isArray(rawKeeps)
        ? (rawKeeps as unknown[]).map(String)
        : typeof rawKeeps === "string"
        ? String(rawKeeps)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (mustKeep.length) {
        const joined1 = (preview.lines || parsedOut.lines || []).join("\n");
        const missing1 = mustKeep.filter((k) => !joined1.includes(k));
        if (missing1.length) {
          const keepReq = `\n\nREQUIREMENT: Preserve EXACT surface forms: ${missing1.join(
            ", "
          )}. Do NOT romanize or translate these tokens.`;
          const respKeepUnknown: unknown = await responsesCall({
            model: TRANSLATOR_MODEL,
            system: getTranslatorSystem(effectiveMode),
            user: userPrompt + keepReq,
            temperature: 0.6,
          } as ResponsesCallOptions);
          const respKeep = respKeepUnknown as { output_text?: string };
          const rawK = respKeep.output_text ?? "";
          const parsedK = rawK ? parseTranslatorOutput(rawK) : parsedOut;
          const joinedK = (parsedK.lines || []).join("\n");
          const stillMissing = mustKeep.filter((k) => !joinedK.includes(k));
          if (stillMissing.length) {
            try {
              await sb
                .from("versions")
                .update({
                  meta: {
                    ...placeholderMeta,
                    status: "failed",
                    error: "REQUIRED_TOKENS_MISSING",
                  },
                })
                .eq("id", placeholderId);
            } catch {}
            return NextResponse.json(
              {
                ok: false,
                code: "REQUIRED_TOKENS_MISSING",
                retryable: true,
                missing: stillMissing,
                versionId: placeholderId,
              },
              { status: 409 }
            );
          }
          // adopt retried lines/notes
          preview.lines = parsedK.lines;
          preview.notes = parsedK.notes;
        }
      }
      // --- end must_keep ---

      await cacheSet(key, preview, 3600);
      // Update node meta with overview + flip status
      const updatedMeta: Record<string, unknown> = {
        ...placeholderMeta,
        status: "generated" as const,
        overview: {
          lines: preview.lines,
          notes: preview.notes,
          line_policy: bundle.line_policy,
        },
      };
      // Debug: compare first-pass vs final preview and what will be written
      try {
        const echoDetected = Boolean(
          (typeof echoish !== "undefined" && echoish) ||
            (typeof untranslated !== "undefined" && untranslated)
        );
        console.log(
          "[DEBUG] First pass lines:",
          (parsedOut.lines || []).slice(0, 2)
        );
        console.log(
          "[DEBUG] Final preview lines:",
          (preview.lines || []).slice(0, 2)
        );
        console.log("[DEBUG] Echo detected:", echoDetected);
        console.log(
          "[DEBUG] Writing to DB:",
          (
            (updatedMeta.overview as { lines?: string[] } | undefined)?.lines ||
            []
          ).slice(0, 2)
        );
      } catch {}
      const { error: upErr2 } = await sb
        .from("versions")
        .update({ meta: updatedMeta })
        .eq("id", placeholderId);
      if (upErr2) {
        return NextResponse.json(
          {
            ok: false,
            error: "UPDATE_FAILED_RLS",
            code: "UPDATE_FAILED_RLS",
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
      if (
        selErr ||
        !(latest as unknown as { meta?: { overview?: unknown } })?.meta
          ?.overview
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "NO_OVERVIEW_PERSISTED",
            code: "NO_OVERVIEW_PERSISTED",
            placeholderId,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        preview,
        mode: effectiveMode,
        sections,
        debug: bundle.debug,
        versionId: placeholderId,
        displayLabel,
        prompt_hash,
      });
    } catch {
      return NextResponse.json(
        { error: "Translator output malformed", raw },
        { status: 502 }
      );
    }
  } catch (e) {
    // Best-effort: flip placeholder to failed so UI shows a clear state
    try {
      if (placeholderId) {
        const failMeta: Record<string, unknown> = {
          ...placeholderMeta,
          status: "failed" as const,
          error: "LLM_CALL_FAILED",
        };
        await sb
          .from("versions")
          .update({ meta: failMeta })
          .eq("id", placeholderId);
      }
    } catch {}
    return respondLLMError(e);
  }
}
