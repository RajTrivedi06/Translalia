/**
 * Admin dashboard guard + payload checks. Run against a dev server:
 *
 *   BASE_URL=http://localhost:3000 npx tsx scripts/admin/verify-admin.ts
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (it creates and deletes two
 * throwaway users and a temporary admin_emails row; nothing else is touched).
 *
 * Asserts:
 *   1. Signed out, GET /en/admin is byte-identical to GET /en/<unknown>.
 *   2. Signed in as a non-admin, same.
 *   3. Signed in as an admin, /en/admin is 200.
 *   4. admin_overview() raises for the non-admin and returns data for the admin.
 *   5. The admin_overview() payload contains no poem text, translated lines,
 *      notes or reflections sampled from real threads (sentinel check).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envFile = path.join(process.cwd(), ".env.local");
const env: Record<string, string> = Object.fromEntries(
  fs
    .readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
if (!URL_ || !ANON || !SERVICE) throw new Error("Missing Supabase env in .env.local");

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const adminEmail = `admin-check+${stamp}@example.com`;
const userEmail = `user-check+${stamp}@example.com`;

let failures = 0;
function dumpOnMismatch(name: string, a: string, b: string) {
  if (a === b || !process.env.DUMP_DIR) return;
  const safe = name.replace(/[^a-z0-9]+/gi, "_");
  fs.writeFileSync(path.join(process.env.DUMP_DIR, `${safe}.a.txt`), a);
  fs.writeFileSync(path.join(process.env.DUMP_DIR, `${safe}.b.txt`), b);
}

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function sessionFor(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const v = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (v.error || !v.data.session) throw v.error ?? new Error("no session");
  return { client: anon, session: v.data.session };
}

async function cookiesFor(session: { access_token: string; refresh_token: string } | null) {
  if (!session) return "";
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "SIGNED_IN", session }),
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function get(pathname: string, cookie: string) {
  const res = await fetch(`${BASE}${pathname}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = await res.text();
  // Strip per-request nonces / dev ids so identical pages compare equal.
  // Normalise what legitimately differs between any two URLs: the requested
  // path (in the canonical URL and the [...rest] param) and dev cache-busters.
  // React streams flight rows in nondeterministic order and chunking, so
  // gather every row from every push() chunk and compare them sorted.
  const stripped = body
    .replace(/\?v=\d+/g, "")
    // dev-only: Next embeds the server stack for notFound(); frames vary with event-loop timing
    .replace(/ data-next-error-stack="[\s\S]*?"/g, "")
    .replace(/\\"c\\":\[\\"\\",\\"en\\",\\"[^\\]*\\"\]/g, '\\"c\\":[\\"\\",\\"en\\",\\"X\\"]')
    .replace(/\\"rest\\",\\"[^\\]*\\"/g, '\\"rest\\",\\"X\\"');
  const rows: string[] = [];
  const shell = stripped.replace(
    /<script>self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/g,
    (_m, payload: string) => {
      rows.push(...payload.split("\\n"));
      return "<flight/>";
    }
  );
  const norm = shell.replace(/(<flight\/>)+/g, "<flight/>") + "\n" + rows.filter(Boolean).sort().join("\n");
  return { status: res.status, body: norm };
}

async function main() {
const created: string[] = [];
try {
  for (const email of [adminEmail, userEmail]) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    created.push(data.user.id);
  }
  const ins = await admin.from("admin_emails").insert({ email: adminEmail, note: "verify-admin.ts (temporary)" });
  if (ins.error) throw ins.error;

  const unknown = `/en/definitely-not-a-route-${stamp}`;

  // 1) signed out
  const out404 = await get(unknown, "");
  const outAdmin = await get("/en/admin", "");
  check("signed out: /en/admin is 404", outAdmin.status === 404, `status ${outAdmin.status}`);
  dumpOnMismatch("signed-out", outAdmin.body, out404.body);
  check("signed out: body identical to unknown route", outAdmin.body === out404.body);

  // 2) non-admin
  const user = await sessionFor(userEmail);
  const userCookie = await cookiesFor(user.session);
  const u404 = await get(unknown, userCookie);
  const uAdmin = await get("/en/admin", userCookie);
  check("non-admin: /en/admin is 404", uAdmin.status === 404, `status ${uAdmin.status}`);
  dumpOnMismatch("non-admin", uAdmin.body, u404.body);
  check("non-admin: body identical to unknown route", uAdmin.body === u404.body);
  const uRpc = await user.client.rpc("admin_overview");
  check("non-admin: admin_overview() refuses", !!uRpc.error, uRpc.error?.message ?? "returned data");
  const uIs = await user.client.rpc("is_admin");
  check("non-admin: is_admin() false", uIs.data === false);

  // 3) admin
  const adm = await sessionFor(adminEmail);
  const admCookie = await cookiesFor(adm.session);
  const aAdmin = await get("/en/admin", admCookie);
  check("admin: /en/admin is 200", aAdmin.status === 200, `status ${aAdmin.status}`);
  const aIs = await adm.client.rpc("is_admin");
  check("admin: is_admin() true", aIs.data === true);

  // 4 + 5) payload
  const aRpc = await adm.client.rpc("admin_overview");
  check("admin: admin_overview() returns data", !aRpc.error && !!aRpc.data, aRpc.error?.message ?? "");
  if (aRpc.data) {
    const payload = JSON.stringify(aRpc.data);
    const { data: threads } = await admin
      .from("chat_threads")
      .select("raw_poem, state")
      .order("created_at", { ascending: false })
      .limit(40);
    const sentinels: string[] = [];
    for (const t of threads ?? []) {
      const s = (t.state ?? {}) as Record<string, any>;
      if (t.raw_poem) sentinels.push(String(t.raw_poem).slice(0, 40));
      const lines = Array.isArray(s.workshop_lines) ? s.workshop_lines : [];
      for (const l of lines) if (l?.translated) sentinels.push(String(l.translated).slice(0, 40));
      if (s.notebook_notes?.thread_note) sentinels.push(String(s.notebook_notes.thread_note).slice(0, 40));
      if (s.express_your_view) sentinels.push(String(s.express_your_view).slice(0, 40));
    }
    const leaked = sentinels.filter((x) => x.trim().length >= 12 && payload.includes(x));
    check("admin: payload carries no poem/line/note text", leaked.length === 0, `${sentinels.length} sentinels checked`);
    check("admin: payload has no state blob", !payload.includes("workshop_lines") && !payload.includes("translation_job"));
    check("admin: payload under 64 KB", payload.length < 65536, `${payload.length} bytes`);
  }
} finally {
  await admin.from("admin_emails").delete().eq("email", adminEmail);
  for (const id of created) await admin.auth.admin.deleteUser(id);
}
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
