/**
 * Phase 1 proof: the DeepSeek cost gate rejects non-allowlisted accounts with a
 * 403 and lets allowlisted accounts through, whether DeepSeek arrives via
 * `state.guide_answers.translationModel` or the request `modelOverride`.
 * Non-DeepSeek requests are unaffected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { POST } from "./route";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";

vi.mock("@/lib/auth/requireUser");
vi.mock("@/lib/supabaseServer");
vi.mock("@/lib/ratelimit/redis");
vi.mock("@/lib/translation/method2/translateLineWithRecipesInternal");

const ALLOWED = "allowed@example.com";
const NOT_ALLOWED = "stranger@example.com";
const THREAD_ID = "11111111-1111-1111-1111-111111111111";

function mockThread(translationModel: string | null) {
  return {
    id: THREAD_ID,
    state: { guide_answers: { translationModel } },
    project_id: null,
    translation_model: null,
    translation_method: "method-2",
    translation_intent: null,
    translation_zone: null,
    source_language_variety: null,
    raw_poem: "una línea de prueba",
  };
}

function wireSupabase(translationModel: string | null) {
  const single = vi
    .fn()
    .mockResolvedValue({ data: mockThread(translationModel), error: null });
  const eq2 = vi.fn(() => ({ single }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(supabaseServer).mockResolvedValue({ from } as never);
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/workshop/translate-line-with-recipes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  threadId: THREAD_ID,
  lineIndex: 0,
  lineText: "una línea de prueba",
  fullPoem: "una línea de prueba",
};

describe("translate-line-with-recipes DeepSeek gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_ALLOWED_EMAILS = `  ${ALLOWED}  `; // padded to prove trim
    vi.mocked(checkDailyLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      max: 10,
    } as never);
    vi.mocked(translateLineWithRecipesInternal).mockResolvedValue({
      variants: [
        { label: "A", text: "a test line" },
        { label: "B", text: "a trial line" },
        { label: "C", text: "a sample line" },
      ],
    } as never);
  });

  it("rejects a non-allowlisted user forcing DeepSeek (via guide_answers) with 403", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u1", email: NOT_ALLOWED },
      response: null,
    } as never);
    wireSupabase("deepseek-v4-flash");

    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "You are not authorized to use the DeepSeek model.",
    });
    // Cost protection: the expensive pipeline must never run.
    expect(translateLineWithRecipesInternal).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted user forcing DeepSeek via modelOverride with 403", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u1", email: NOT_ALLOWED },
      response: null,
    } as never);
    wireSupabase(null); // no model in state; override supplies deepseek

    const res = await POST(
      makeRequest({ ...baseBody, modelOverride: "deepseek-v4-flash" })
    );

    expect(res.status).toBe(403);
    expect(translateLineWithRecipesInternal).not.toHaveBeenCalled();
  });

  it("allows an allowlisted user (case-insensitive) to use DeepSeek", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u2", email: ALLOWED.toUpperCase() }, // uppercase to prove case-insensitivity
      response: null,
    } as never);
    wireSupabase("deepseek-v4-flash");

    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(200);
    expect(translateLineWithRecipesInternal).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(translateLineWithRecipesInternal).mock.calls[0][0].guideAnswers
        .translationModel
    ).toBe("deepseek-v4-flash");
  });

  it("leaves non-DeepSeek requests unaffected for a non-allowlisted user", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u3", email: NOT_ALLOWED },
      response: null,
    } as never);
    wireSupabase("gpt-4o");

    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(200);
    expect(translateLineWithRecipesInternal).toHaveBeenCalledTimes(1);
  });
});
