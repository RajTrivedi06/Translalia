import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const intlMiddleware = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const res = intlMiddleware(req);

  // Check if user has a locale preference and redirect if needed
  try {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Get user's locale preference from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", user.id)
        .single();

      if (profile?.locale && routing.locales.includes(profile.locale as any)) {
        const { pathname } = req.nextUrl;
        // Extract current locale from pathname (e.g., /en/workspaces -> en)
        const pathSegments = pathname.split("/").filter(Boolean);
        const currentLocale = pathSegments[0] || routing.defaultLocale;

        // If user's preferred locale differs from current locale, redirect
        if (profile.locale !== currentLocale) {
          // Replace the locale in the pathname
          const newPath =
            pathSegments.length > 1
              ? `/${profile.locale}/${pathSegments.slice(1).join("/")}`
              : `/${profile.locale}`;

          const url = new URL(newPath, req.nextUrl.origin);
          url.search = req.nextUrl.search; // Preserve query params
          return NextResponse.redirect(url);
        }
      }
    }
  } catch (error) {
    // If there's an error (e.g., database connection), just continue with default behavior
    console.error("[middleware] Error checking user locale:", error);
  }

  return res;
}

export const config = {
  // Match only internationalized pathnames
  // Skip internal paths: _next, api, static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
