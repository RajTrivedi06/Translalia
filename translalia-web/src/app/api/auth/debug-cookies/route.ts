import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const explicitlyEnabled = process.env.DEBUG_API_ENABLED === "1";
  const productionLike =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  if (productionLike && !explicitlyEnabled) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { user, response } = await requireUser();
  if (!user) return response;

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const sbCookies = allCookies.filter((c) => c.name.includes("sb-"));
  const authTokenCookie = sbCookies.find((c) => c.name.includes("auth-token"));
  let parsedToken: unknown = null;
  if (authTokenCookie) {
    try {
      parsedToken = JSON.parse(authTokenCookie.value);
    } catch {
      parsedToken = {
        error: "Failed to parse",
        raw: authTokenCookie.value.substring(0, 50),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    cookies: {
      total: allCookies.length,
      supabase: sbCookies.map((c) => ({
        name: c.name,
        length: c.value?.length || 0,
      })),
      authTokenParsed: parsedToken,
      raw: req.headers.get("cookie")?.substring(0, 200),
    },
    request: {
      url: req.url,
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
    },
  });
}
