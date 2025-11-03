// app/api/guide/analyze-poem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { ENHANCER_MODEL } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  poem: z.string().min(1, "poem is required"),
  threadId: z.string().min(1, "threadId is required"),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}
function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) => console.log("[/api/guide/analyze-poem]", requestId, ...a);

  try {
    // 1) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, poemLen: body.poem?.length });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", { details: String(e?.message ?? e) });
    }

    // 2) Auth (Supabase, Node runtime is required)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (authErr || !user) {
      log("unauthenticated", authErr?.message);
      return err(401, "UNAUTHENTICATED", "Please sign in to analyze.");
    }

    // 3) Thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,state")
      .eq("id", body.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }
    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) OpenAI call (force JSON)
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      log("openai_key_missing");
      return err(500, "OPENAI_KEY_MISSING", "Server missing OpenAI API key.");
    }
    const openai = new OpenAI({ apiKey: key });

    const system = [
      "You are a poetry analysis assistant.",
      "Return STRICT JSON only, no prose.",
      "Schema: { language: string, wordCount: number, summary: string, tone: string[], dialect?: string|null, themes: string[], keyImages: string[] }",
    ].join(" ");

    const userPrompt =
      `Analyze the poem. Infer language, tone (array), dialect (if any), themes (array), key images (array), and a concise 1–2 sentence summary.` +
      ` Respond with valid JSON ONLY per the schema.\n\n--- POEM START ---\n${body.poem}\n--- POEM END ---`;

    let modelToUse = ENHANCER_MODEL;
    let completion;

    // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
    const isGpt5 = modelToUse.startsWith('gpt-5');

    try {
      log("openai_attempt", { model: modelToUse, isGpt5 });

      if (isGpt5) {
        // GPT-5: No temperature or other sampling parameters
        completion = await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        // GPT-4: Include temperature
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      }
    } catch (modelError: any) {
      // If model not found or unsupported, fallback to gpt-4o-mini
      const shouldFallback =
        modelError?.error?.code === 'model_not_found' ||
        modelError?.status === 404 ||
        modelError?.status === 400;

      if (shouldFallback) {
        log("fallback_to_gpt4", {
          from: modelToUse,
          to: "gpt-4o-mini",
          reason: modelError?.error?.code || modelError?.error?.message || 'error'
        });
        modelToUse = "gpt-4o-mini";
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        log("openai_fail", modelError?.message);
        return err(502, "OPENAI_FAIL", "Upstream analysis failed.", {
          upstream: String(modelError?.message ?? modelError),
        });
      }
    }

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const analysis = JSON.parse(content);
    analysis.wordCount = analysis.wordCount ?? body.poem.trim().split(/\s+/).length;

    // 5) Persist (don't block UI on save failure)
    const newState = { ...(thread.state ?? {}), poem_analysis: analysis };
    const { error: saveErr } = await supabase
      .from("chat_threads")
      .update({ state: newState })
      .eq("id", body.threadId);

    if (saveErr) {
      log("save_fail", saveErr.message);
      return ok({ analysis, saved: false });
    }

    log("success", { ms: Date.now() - started });
    return ok({ analysis, saved: true });
  } catch (e: any) {
    console.error("[/api/guide/analyze-poem] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
