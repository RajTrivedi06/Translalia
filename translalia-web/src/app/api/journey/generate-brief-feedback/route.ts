import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { buildJourneyFeedbackPrompt } from "@/lib/ai/workshopPrompts";
import {
  getSystemPrompt,
  getLanguageInstruction,
} from "@/lib/ai/localePrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  journeyReflectionId: z.string().min(1, "journeyReflectionId is required"),
  studentReflection: z
    .string()
    .min(10, "Student reflection must be at least 10 characters"),
  completedLines: z.record(z.string()), // index => translation
  poemLines: z.array(z.string()),
  completedCount: z.number().int().min(1),
  totalCount: z.number().int().min(1),
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
  const log = (...a: any[]) =>
    console.log("[/api/journey/generate-brief-feedback]", requestId, ...a);

  try {
    // 1) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", {
        journeyReflectionId: body.journeyReflectionId,
        threadId: body.threadId,
        completedLines: body.completedCount,
        totalLines: body.totalCount,
      });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: String(e?.message ?? e),
      });
    }

    // 2) Auth
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
      return err(401, "UNAUTHENTICATED", "Please sign in to generate feedback.");
    }

    // 3) Verify journey reflection ownership
    const { data: reflection, error: reflectionErr } = await supabase
      .from("journey_reflections")
      .select("id,created_by")
      .eq("id", body.journeyReflectionId)
      .single();

    if (reflectionErr || !reflection) {
      log("reflection_not_found", reflectionErr?.message);
      return err(404, "REFLECTION_NOT_FOUND", "Journey reflection not found.");
    }

    if (reflection.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: reflection.created_by });
      return err(
        403,
        "FORBIDDEN",
        "You do not have access to this reflection."
      );
    }

    // 4) Verify thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by")
      .eq("id", body.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden_thread", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4a) Fetch user's locale preference
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      log("profile_fetch_error", profileErr?.message);
      log("proceeding with default locale");
    }
    const userLocale = profile?.locale || "en";
    log("user_locale", { locale: userLocale, hasProfile: !!profile });

    // 5) Build prompt for AI with locale-aware system prompt
    const systemPrompt = getSystemPrompt("journeyFeedback", userLocale);
    const baseUserPrompt = buildJourneyFeedbackPrompt({
      studentReflection: body.studentReflection,
      completedLines: body.completedLines,
      poemLines: body.poemLines,
      completedCount: body.completedCount,
      totalCount: body.totalCount,
    });
    const userPrompt = `${baseUserPrompt}\n\n${getLanguageInstruction(userLocale)}`;

    // 6) Call OpenAI gpt-5 (with fallback to gpt-4o-mini)
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      log("openai_key_missing");
      return err(500, "OPENAI_KEY_MISSING", "Server missing OpenAI API key.");
    }

    const openai = new OpenAI({ apiKey: key });

    let modelToUse = "gpt-5-turbo"; // Primary: gpt-5 family as specified
    let feedback: string = "";
    let usedFallback = false;

    try {
      log("openai_attempt", { model: modelToUse });

      const completion = await openai.chat.completions.create({
        model: modelToUse,
        temperature: 0.8, // Slightly higher for more natural, conversational tone
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      feedback = completion.choices?.[0]?.message?.content?.trim() || "";
    } catch (modelError: any) {
      const shouldFallback =
        modelError?.error?.code === "model_not_found" ||
        modelError?.status === 404 ||
        modelError?.status === 400;

      if (shouldFallback) {
        log("fallback_to_gpt4", {
          from: modelToUse,
          to: "gpt-4o-mini",
          reason: modelError?.error?.code || modelError?.error?.message,
        });
        usedFallback = true;
        modelToUse = "gpt-4o-mini";

        try {
          const completion = await openai.chat.completions.create({
            model: modelToUse,
            temperature: 0.8,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          feedback = completion.choices?.[0]?.message?.content?.trim() || "";
        } catch (fallbackError: any) {
          log("fallback_failed", fallbackError?.message);
          return err(502, "OPENAI_FAIL", "Feedback generation failed.", {
            upstream: String(fallbackError?.message ?? fallbackError),
          });
        }
      } else {
        log("openai_fail", modelError?.message);
        return err(502, "OPENAI_FAIL", "Feedback generation failed.", {
          upstream: String(modelError?.message ?? modelError),
        });
      }
    }

    // 7) Validate feedback length (100-150 words)
    const wordCount = feedback.split(/\s+/).filter((w) => w.length > 0).length;
    log("feedback_generated", {
      wordCount,
      length: feedback.length,
      modelUsed: modelToUse,
      fallback: usedFallback,
    });

    if (wordCount < 50) {
      log("feedback_too_short", { wordCount });
      return err(
        502,
        "FEEDBACK_LENGTH_ERROR",
        "Generated feedback was too short. Please try again."
      );
    }

    // 8) Update reflection with feedback in database
    const { data: updatedReflection, error: updateErr } = await supabase
      .from("journey_reflections")
      .update({
        ai_feedback: feedback,
        status: "with_feedback",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.journeyReflectionId)
      .select()
      .single();

    if (updateErr || !updatedReflection) {
      log("db_update_failed", updateErr?.message);
      return err(500, "DB_ERROR", "Failed to save feedback.", {
        details: String(updateErr?.message ?? updateErr),
      });
    }

    log("success", {
      reflectionId: updatedReflection.id,
      feedbackLength: feedback.length,
      ms: Date.now() - started,
    });

    return ok({
      id: updatedReflection.id,
      aiFeedback: updatedReflection.ai_feedback,
      status: updatedReflection.status,
      updatedAt: updatedReflection.updated_at,
    });
  } catch (e: any) {
    console.error("[/api/journey/generate-brief-feedback] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
