// Diagnose why the DeepSeek background gate throws for this thread.
// Compares profiles.email vs auth email vs the allowlist. Read-only.
import { readFileSync } from "node:fs";
import { createClient } from "./../../translalia-web/node_modules/@supabase/supabase-js/dist/main/index.js";

const env = Object.fromEntries(
  readFileSync(new URL("../../translalia-web/.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);

const THREAD_ID = "3050ec72-0182-4cda-a965-d9455767454c";
const allow = (env.DEEPSEEK_ALLOWED_EMAILS ?? "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
console.log("allowlist:", allow);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: thread } = await sb
  .from("chat_threads")
  .select("created_by, translation_model, state")
  .eq("id", THREAD_ID)
  .single();

if (!thread) { console.log("thread not found"); process.exit(0); }
const ownerId = thread.created_by;
const stateModel = thread.state?.guide_answers?.translationModel ?? null;
console.log("owner id:", ownerId);
console.log("thread.translation_model column:", thread.translation_model);
console.log("state.guide_answers.translationModel:", stateModel);

const { data: profile } = await sb.from("profiles").select("email").eq("id", ownerId).single();
console.log("\nprofiles.email:", JSON.stringify(profile?.email));

const { data: authUser } = await sb.auth.admin.getUserById(ownerId);
console.log("auth email:    ", JSON.stringify(authUser?.user?.email));

const chk = (e) => (e ? allow.includes(e.trim().toLowerCase()) : false);
console.log("\nallowlisted by profiles.email?", chk(profile?.email));
console.log("allowlisted by auth email?    ", chk(authUser?.user?.email));
console.log("\n=> gate throws when the model is deepseek AND profiles.email is not allowlisted.");
