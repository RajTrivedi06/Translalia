import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  isBacktranslateEnabled,
  BACKTRANSLATE_DAILY_LIMIT,
} from "@/lib/flags/verify";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import { runBacktranslate } from "@/lib/ai/verify";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (!isBacktranslateEnabled())
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });

  const body = await req.json();
  const { projectId, threadId, candidate } = body || {};
  if (!projectId || !threadId || !candidate)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const rl = await checkDailyLimit(
    user.id,
    "backtranslate",
    BACKTRANSLATE_DAILY_LIMIT
  );
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Daily back-translation limit reached" },
      { status: 429 }
    );

  const r = await runBacktranslate({ candidate });
  if (!r.ok)
    return NextResponse.json(
      { error: r.error, prompt_hash: r.prompt_hash },
      { status: 502 }
    );
  return NextResponse.json({ data: r.data, prompt_hash: r.prompt_hash });
}
