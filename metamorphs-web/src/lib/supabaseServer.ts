import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServer() {
  const cookieStore = cookies() as any; // NOTE(cursor): cast to align with Next types variance

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options?: any) {
          cookieStore.set({
            name,
            value: "",
            path: options?.path ?? "/",
            httpOnly: options?.httpOnly ?? true,
            secure: process.env.NODE_ENV === "production",
            sameSite: (options?.sameSite as any) ?? "lax",
            maxAge: 0,
            expires: new Date(0),
            ...options,
          });
        },
      },
    }
  );
}
