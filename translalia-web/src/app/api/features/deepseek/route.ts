// app/api/features/deepseek/route.ts
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { isDeepSeekAllowed } from "@/lib/ai/deepseekAccess";

// Never cache: the answer is per-user and depends on server env.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/features/deepseek
 *
 * Returns whether the authenticated user may use the DeepSeek model. Backs the
 * conditional render of the picker option so the allowlist never ships to the
 * client bundle. Enforcement still happens server-side in the translate routes
 * and the background tick — this endpoint is UI convenience only.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  return NextResponse.json(
    { allowed: isDeepSeekAllowed(user.email) },
    {
      headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    }
  );
}
