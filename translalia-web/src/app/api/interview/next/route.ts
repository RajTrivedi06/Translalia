import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { isSmartInterviewLLMEnabled } from "@/lib/flags/interview";
import { ROUTER_MODEL } from "@/lib/models";
import { openai } from "@/lib/ai/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSystemPrompt,
  getLanguageInstruction,
} from "@/lib/ai/localePrompts";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (!isSmartInterviewLLMEnabled())
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });

  const { gap, baseQuestion, context } = await req.json();

  // Fetch user's locale preference
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

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    console.warn("[interview] profile fetch error:", profileErr?.message);
    console.warn("[interview] proceeding with default locale");
  }
  const userLocale = profile?.locale || "en";
  console.log("[interview] user_locale:", { locale: userLocale, hasProfile: !!profile });

  const SYSTEM = getSystemPrompt("interview", userLocale);

  const baseUSER = `GAP=${gap}
BASE_QUESTION="${baseQuestion}"
CONTEXT=${JSON.stringify(context ?? {})}`;

  const USER = `${baseUSER}\n\n${getLanguageInstruction(userLocale)}`;

  // Use ROUTER_MODEL (defaults to gpt-5-nano) with fallback
  let modelToUse = ROUTER_MODEL;
  let completion;

  // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
  const isGpt5 = modelToUse.startsWith('gpt-5');

  try {
    if (isGpt5) {
      // GPT-5: No temperature or other sampling parameters
      completion = await openai.chat.completions.create({
        model: modelToUse,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    } else {
      // GPT-4: Include temperature
      completion = await openai.chat.completions.create({
        model: modelToUse,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    }
  } catch (modelError: any) {
    // If model not found or unsupported, fallback to gpt-4o
    const shouldFallback =
      modelError?.error?.code === 'model_not_found' ||
      modelError?.status === 404 ||
      modelError?.status === 400;

    if (shouldFallback) {
      console.warn(`[interview] Model ${modelToUse} fallback to gpt-4o:`, modelError?.error?.code || modelError?.error?.message || 'error');
      modelToUse = "gpt-4o";
      completion = await openai.chat.completions.create({
        model: modelToUse,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    } else {
      throw modelError;
    }
  }

  const text = completion.choices[0]?.message?.content ?? "{}";
  try {
    const obj = JSON.parse(text);
    if (!obj?.question) throw new Error("Missing question");
    return NextResponse.json({ question: String(obj.question) });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from LLM" },
      { status: 502 }
    );
  }
}
