import { supabase } from "@/lib/supabaseClient";

/**
 * Accepts a username OR an email and returns an email string.
 * Reuses the same approach found in AuthSheet (profiles lookup).
 */
export async function resolveIdentifierToEmail(
  identifier: string
): Promise<string> {
  const raw = (identifier ?? "").trim();
  if (!raw) throw new Error("Please enter your username or email.");

  // If it looks like an email, return as-is (normalize casing).
  if (raw.includes("@")) return raw.toLowerCase();

  // Otherwise, treat as username and resolve to email via profiles.
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", raw)
    .single();

  if (error || !data?.email) {
    throw new Error("No account found for that username.");
  }
  return (data.email ?? "").toLowerCase();
}

/**
 * Optional utility used by sign-up page to check collisions (kept local).
 * You can ignore if your sign-up already performs a uniqueness check.
 */
export async function usernameExists(username: string): Promise<boolean> {
  const u = (username ?? "").trim();
  if (!u) return false;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", u)
    .maybeSingle();
  return !!data;
}
