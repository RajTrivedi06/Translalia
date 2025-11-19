import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const intlMiddleware = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const res = intlMiddleware(req);

  // const supabase = createServerClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   {
  //     cookies: {
  //       getAll() {
  //         return req.cookies.getAll();
  //       },
  //       setAll(cookiesToSet) {
  //         cookiesToSet.forEach(({ name, value, options }) =>
  //           res.cookies.set(name, value, options)
  //         );
  //       },
  //     },
  //   }
  // );

  // await supabase.auth.getUser();

  // const { pathname, origin } = req.nextUrl;
  
  // // Check if we are on a protected route
  // // Note: pathname will include the locale prefix (e.g. /en/workspaces)
  // // We need to strip it or check for it
  // const isProtectedRoute = 
  //   pathname.includes("/workspaces") ||
  //   pathname.includes("/api/threads") ||
  //   pathname.includes("/api/flow") ||
  //   pathname.includes("/api/versions");

  // const hasSupabaseCookies = Array.from(req.cookies.getAll()).some(
  //   (c) => c.name.startsWith("sb-") || c.name.includes("supabase")
  // );

  // if (isProtectedRoute && !hasSupabaseCookies) {
  //   // Redirect to sign-in, preserving locale if present
  //   // This logic might need refinement to handle locale prefixes correctly
  //   // For now, we rely on next-intl to handle the locale part
  //   // But if we redirect to /auth/sign-in, we should probably respect the current locale
    
  //   // Simple approach: let next-intl handle the redirect if we just return the response
  //   // But here we need to force a redirect to sign-in
    
  //   // Extract locale from pathname
  //   const locale = pathname.split('/')[1];
  //   const validLocale = routing.locales.includes(locale as any) ? locale : routing.defaultLocale;
    
  //   const url = new URL(`/${validLocale}/auth/sign-in`, origin);
  //   url.searchParams.set("redirect", pathname + req.nextUrl.search);
  //   return NextResponse.redirect(url);
  // }

  return res;
}

export const config = {
  // Match only internationalized pathnames
  // Skip internal paths: _next, api, static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
