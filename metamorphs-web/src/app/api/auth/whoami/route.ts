import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  return NextResponse.json({ ok: true, userId: guard.user.id });
}
