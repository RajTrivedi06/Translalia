import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";

// NOTE(cursor): Stubbed admin eval runner
export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response;
  return NextResponse.json(
    { ok: true, message: "Eval runner stub — wire to golden set in Phase 5.x" },
    { status: 202 }
  );
}
