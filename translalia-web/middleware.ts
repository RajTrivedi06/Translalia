import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  const { pathname, origin } = req.nextUrl;
  const needsAuth =
    pathname.startsWith("/workspaces") ||
    pathname.startsWith("/api/threads") ||
    pathname.startsWith("/api/flow") ||
    pathname.startsWith("/api/versions");

  const hasSupabaseCookies = Array.from(req.cookies.getAll()).some(
    (c) => c.name.startsWith("sb-") || c.name.includes("supabase")
  );

  if (needsAuth && !hasSupabaseCookies) {
    const url = new URL("/auth/sign-in", origin);
    url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico)$).*)",
  ],
};
