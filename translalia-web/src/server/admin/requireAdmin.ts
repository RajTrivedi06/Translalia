/**
 * Admin gate for the /admin page.
 *
 * Server-only by construction: it imports next/headers via supabaseServer,
 * which cannot run in a client component.
 *
 * getAdmin() returns null for signed-out visitors and non-admins so the caller
 * can fall through to the exact same notFound() an unknown route produces.
 * Never a 403 and never a redirect: the page's existence is not disclosed.
 *
 * Wrapped in React cache() so repeated calls within one request share a
 * single lookup.
 */
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

export interface AdminContext {
  userId: string;
  sb: SupabaseClient;
}

export const getAdmin = cache(async (): Promise<AdminContext | null> => {
  const sb = (await supabaseServer()) as unknown as SupabaseClient;
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data: isAdmin, error } = await sb.rpc("is_admin");
  if (error || isAdmin !== true) return null;

  return { userId: user.id, sb };
});

export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
