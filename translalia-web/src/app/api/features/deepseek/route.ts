// app/api/features/deepseek/route.ts
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import {
  isDeepSeekAllowed,
  getAllowedDeepSeekEmails,
} from "@/lib/ai/deepseekAccess";

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
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const allowed = isDeepSeekAllowed(user.email);

  // Temporary, safe diagnostic (?diag=1): returns only the caller's OWN email
  // and the allowlist size/presence — never the allowlist contents. Remove once
  // the deployment env is confirmed.
  const wantsDiag = new URL(req.url).searchParams.get("diag") === "1";
  const diagnostic = wantsDiag
    ? {
        callerEmail: user.email ?? null,
        allowlistEnvPresent: process.env.DEEPSEEK_ALLOWED_EMAILS !== undefined,
        allowlistSize: getAllowedDeepSeekEmails().length,
      }
    : undefined;

  return NextResponse.json(
    diagnostic ? { allowed, diagnostic } : { allowed },
    {
      headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    }
  );
}
