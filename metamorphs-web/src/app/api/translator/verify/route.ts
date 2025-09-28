import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { isVerifyEnabled, VERIFY_DAILY_LIMIT } from "@/lib/flags/verify";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import { runVerification } from "@/lib/ai/verify";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (!isVerifyEnabled())
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });

  const body = await req.json();
  const { projectId, threadId, source, candidate } = body || {};
  if (!projectId || !threadId || !source || !candidate)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Daily verification limit reached" }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "Retry-After": String(Math.max(1, (rl as any).retryAfterSec ?? 60)),
        },
      }
    );
  }

  const r = await runVerification({ source, candidate });
  if (!r.ok)
    return NextResponse.json(
      { error: r.error, prompt_hash: r.prompt_hash },
      { status: 502 }
    );
  return NextResponse.json({ data: r.data, prompt_hash: r.prompt_hash });
}
