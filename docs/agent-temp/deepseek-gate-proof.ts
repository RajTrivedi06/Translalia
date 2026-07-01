/**
 * Live proof of the centralized DeepSeek gate. Imports the REAL helper that
 * every enforcement point (8 routes + runTranslationTick) calls, and mirrors the
 * exact route branch: `isDeepSeekBlocked(model, email)` -> 403, else honor.
 * Run from translalia-web/: ../docs/... via tsx (see command).
 */
import { isDeepSeekAllowed, isDeepSeekBlocked, isDeepSeekModel } from "@/lib/ai/deepseekAccess";

async function main() {
  const ALLOWED = "allowed@example.com";
  const NOT_ALLOWED = "stranger@example.com";
  // Padded + mixed case to prove trim + case-insensitive matching.
  process.env.DEEPSEEK_ALLOWED_EMAILS = `  ${ALLOWED} , second@Example.com `;

  // Mirrors the identical route branch: return 403 when blocked, else 200.
  const statusFor = (model: string | null, email: string) =>
    isDeepSeekBlocked(model, email) ? 403 : 200;

  const cases: Array<[string, number, number]> = [
    // [description, actual, expected]
    ["deepseek + non-allowlisted        -> 403", statusFor("deepseek-v4-flash", NOT_ALLOWED), 403],
    ["deepseek + allowlisted            -> 200", statusFor("deepseek-v4-flash", ALLOWED), 200],
    ["deepseek + allowlisted UPPERCASE  -> 200", statusFor("deepseek-v4-flash", "ALLOWED@EXAMPLE.COM"), 200],
    ["deepseek + 2nd allowlisted (trim) -> 200", statusFor("deepseek-v4-flash", "second@example.com"), 200],
    ["gpt-4o   + non-allowlisted        -> 200", statusFor("gpt-4o", NOT_ALLOWED), 200],
    ["gpt-4o   + allowlisted            -> 200", statusFor("gpt-4o", ALLOWED), 200],
    ["deepseek + empty email            -> 403", statusFor("deepseek-v4-flash", ""), 403],
  ];

  let pass = 0;
  for (const [desc, actual, expected] of cases) {
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"}  ${desc}   (got ${actual})`);
    if (ok) pass++;
  }

  // Sanity on the primitives.
  console.log("\nprimitive checks:");
  console.log("  isDeepSeekModel('deepseek-v4-flash') =", isDeepSeekModel("deepseek-v4-flash"), "(exp true)");
  console.log("  isDeepSeekModel('gpt-4o')            =", isDeepSeekModel("gpt-4o"), "(exp false)");
  console.log("  isDeepSeekAllowed(undefined)         =", isDeepSeekAllowed(undefined), "(exp false)");

  console.log(`\n${pass}/${cases.length} gate cases passed`);
  if (pass !== cases.length) process.exit(1);
}

main();
