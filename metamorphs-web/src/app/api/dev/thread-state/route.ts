import { NextResponse } from "next/server";
import {
  getThreadState,
  patchThreadState,
  appendLedger,
} from "@/server/threadState";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Dev endpoint disabled in production", {
      status: 403,
    });
  }
  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId");
  if (!threadId)
    return NextResponse.json({ error: "threadId required" }, { status: 400 });

  const before = await getThreadState(threadId);
  await patchThreadState(threadId, { phase: "interviewing" });
  const { state: after, didHitCadence } = await appendLedger(threadId, {
    ts: new Date().toISOString(),
    kind: "demo",
    note: "smoke append",
  });
  return NextResponse.json({ before, after, didHitCadence });
}
