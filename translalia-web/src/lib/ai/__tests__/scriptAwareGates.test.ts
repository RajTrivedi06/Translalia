/**
 * Phase 3: script-aware gates.
 *
 * The centrepiece is the PASS/FAIL pair — genuinely different Chinese variants
 * must pass, near-identical ones must fail. A gate that only ever passes is no
 * more useful than one that only ever fails; both halves have to hold.
 *
 * Environment note: these assert against production's configuration,
 * USE_SIMPLIFIED_PROMPTS=1. That flag moves the balanced thresholds, so tests
 * that pin numeric outcomes set it explicitly rather than inheriting whatever
 * the runner happens to have.
 *
 * See the note in src/lib/text/__tests__/segmentText.test.ts about the runner.
 */

import { describe, it, expect } from "vitest";

import { checkDistinctness, tokenize } from "../diversityGate";
import { checkFidelity } from "../fidelityGate";
import {
  openerType,
  punctuationProfile,
  lengthBucket,
  countNonPunctTokens,
  structuralSignature,
} from "../structureSignature";
import { resolveStopwordsForText } from "../stopwords";
import {
  detectSubjectForm,
  normalizeSubjectForm,
} from "@/lib/translation/method2/detectSubjectForm";
import { LATIN_FIXTURE_LINES } from "@/lib/text/__fixtures__/latinCorpus";
import { CJK_GOLDEN } from "@/lib/text/__fixtures__/cjk-segmentation-golden";

const variants = (a: string, b: string, c: string) => [
  { label: "A" as const, text: a },
  { label: "B" as const, text: b },
  { label: "C" as const, text: c },
];

/** Run `fn` with USE_SIMPLIFIED_PROMPTS pinned to production's value. */
function withProductionEnv<T>(fn: () => T): T {
  const previous = process.env.USE_SIMPLIFIED_PROMPTS;
  process.env.USE_SIMPLIFIED_PROMPTS = "1";
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.USE_SIMPLIFIED_PROMPTS;
    else process.env.USE_SIMPLIFIED_PROMPTS = previous;
  }
}

// =============================================================================
// THE PAIR — the entire point of this phase
// =============================================================================

describe("PAIR: genuinely different Chinese PASSES, near-identical FAILS", () => {
  // Built from the golden fixture lines: three different classical couplets.
  const DIFFERENT = variants(
    "床前明月光，疑是地上霜",
    "枯藤老树昏鸦，小桥流水人家",
    "孤舟蓑笠翁，独钓寒江雪"
  );

  // Same line, three trivial substitutions.
  const NEAR_IDENTICAL = variants(
    "在蝉的痛苦中",
    "在蝉的痛苦里",
    "在蝉的痛苦中央"
  );

  it("PASSES three genuinely different Chinese variants (balanced)", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(DIFFERENT, { mode: "balanced" })
    );
    expect(result.pass).toBe(true);
  });

  it("FAILS three near-identical Chinese variants (balanced)", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(NEAR_IDENTICAL, { mode: "balanced" })
    );
    expect(result.pass).toBe(false);
  });

  it("PASSES the different set in focused mode too", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(DIFFERENT, { mode: "focused" })
    );
    expect(result.pass).toBe(true);
  });

  it("does not fail the different set for a structural reason", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(DIFFERENT, { mode: "balanced" })
    );
    const reason = result.reason ?? "";
    expect(reason).not.toContain("opener_all_same");
    expect(reason).not.toContain("opener_duplicate");
    expect(reason).not.toContain("signature_match");
    expect(reason).not.toContain("opening content bigram");
  });
});

// =============================================================================
// THE REAL RUN
// =============================================================================

describe("REGRESSION: the real production run (Italian -> Chinese, balanced)", () => {
  // Every line of this run produced openerTypes [OTHER, OTHER, OTHER],
  // signature OTHER|short|c0d0k0s0|UNKNOWN x3, gateReason opener_all_same,
  // then a regen whose recheck failed identically. Six OpenAI calls for three
  // lines, 100% overhead, zero benefit.
  const LINE_0 = variants(
    "风儿掠过，像翅膀一样",
    "风儿轻轻掠过，仿佛有翅",
    "在风的掠影中，轻舞翱翔"
  );
  const LINE_2 = variants(
    "在蝉的痛苦中",
    "在蝉的挣扎里",
    "在绝望的鸣叫中"
  );

  it("line 0 PASSES balanced (was: opener_all_same -> regen -> salvage)", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(LINE_0, { mode: "balanced" })
    );
    expect(result.pass).toBe(true);
  });

  it("line 2 still FAILS balanced — but now for a true reason", () => {
    // Worth being precise about, because it looks like a miss and is not.
    //
    // Before: failed with opener_all_same "OTHER", because the Latin lexicon
    // could not see any of the three openers. False reason, correct-looking
    // outcome.
    //
    // After: fails with opener_all_same "PREP", because all three genuinely
    // open with 在 — they share the template 在 X 的 Y 中/里. That is a real
    // template clone and exactly what this rule exists to catch.
    //
    // The rule is script-neutral: the English rendering "In the cicada's pain
    // / In the cicada's struggle / In the desperate cry" is PREP/PREP/PREP and
    // fails identically. Whether balanced mode should be more permissive about
    // 在 specifically — it is a very high-frequency locative — is a tuning
    // question needing native-speaker input, deliberately not decided here.
    const result = withProductionEnv(() =>
      checkDistinctness(LINE_2, { mode: "balanced" })
    );
    expect(result.pass).toBe(false);
    expect(result.reason ?? "").toContain("PREP");
  });

  it("line 0 no longer collapses to three identical signatures", () => {
    const signatures = LINE_0.map((v) => structuralSignature(v.text).signature);
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it("line 0 no longer reports every opener as OTHER", () => {
    const openers = LINE_0.map((v) => openerType(v.text));
    expect(openers).not.toEqual(["OTHER", "OTHER", "OTHER"]);
    // 在风的掠影中 opens with a preposition the lexicon knows.
    expect(openers[2]).toBe("PREP");
  });

  it("line 2 recognises 在 as PREP on all three variants", () => {
    expect(LINE_2.map((v) => openerType(v.text))).toEqual([
      "PREP",
      "PREP",
      "PREP",
    ]);
  });

  it("line 2's failure is diagnosable, where before it was not", () => {
    // The point of the change is not that everything passes — it is that the
    // reason is now true. A reader of this log can act on "all three open with
    // 在"; nobody could act on "all three openers are OTHER".
    const result = withProductionEnv(() =>
      checkDistinctness(LINE_2, { mode: "balanced" })
    );
    expect(result.reason).toContain("opener_all_same");
    expect(result.reason).not.toContain("OTHER");
  });
});

// =============================================================================
// 3.1 STRUCTURE
// =============================================================================

describe("3.1 punctuationProfile counts CJK punctuation", () => {
  it("no longer reports c0d0k0s0 for a line that visibly has commas", () => {
    const profile = punctuationProfile("床前明月光，疑是地上霜");
    expect(profile.commas).toBe(1);
  });

  it("counts the enumeration comma 、", () => {
    expect(punctuationProfile("私は昨日、東京へ").commas).toBe(1);
  });

  it("counts CJK terminators separately", () => {
    expect(punctuationProfile("你在哪里？").terminators).toBe(1);
    expect(punctuationProfile("多美啊！").terminators).toBe(1);
    expect(punctuationProfile("明月光。").terminators).toBe(1);
  });

  it("does NOT count ASCII terminators, so Latin signatures are unchanged", () => {
    expect(punctuationProfile("The moon rises.").terminators).toBe(0);
    expect(punctuationProfile("Does it rise?").terminators).toBe(0);
    expect(punctuationProfile("It rises!").terminators).toBe(0);
  });

  it("leaves Latin punctuation counts exactly as before", () => {
    const p = punctuationProfile("Como el viento, entre los árboles; mi corazón");
    expect(p.commas).toBe(1);
    expect(p.semicolons).toBe(1);
    expect(p.colons).toBe(0);
  });
});

describe("3.1 lengthBucket stops being uniformly short for CJK", () => {
  it("gives real token counts for Chinese", () => {
    for (const testCase of CJK_GOLDEN.filter((c) => c.locale === "zh")) {
      expect(countNonPunctTokens(testCase.text)).toBeGreaterThan(1);
    }
  });

  it("buckets a longer Chinese line as med rather than short", () => {
    expect(lengthBucket("你站在桥上看风景，看风景的人在楼上看你")).toBe("med");
  });

  it("leaves Latin bucketing unchanged", () => {
    expect(lengthBucket("The moon rises")).toBe("short");
    expect(lengthBucket("The stars are diamonds scattered across the velvet sky")).toBe("med");
  });
});

// =============================================================================
// 3.2 LATIN FREEZE
// =============================================================================

describe("3.2 REGRESSION: Latin tokenization and gate outcomes unchanged", () => {
  it("tokenize matches the previous punctuation-fold + whitespace split", () => {
    for (const line of LATIN_FIXTURE_LINES) {
      const before = new Set(
        line
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .trim()
          .split(/\s+/)
          .filter((t) => t.length > 0)
      );
      expect([...tokenize(line)].sort()).toEqual([...before].sort());
    }
  });

  it("passes three genuinely different Latin variants", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(
        variants(
          "The stars are diamonds scattered across the velvet sky",
          "Time flows like a river with no return",
          "We float on currents we cannot control"
        ),
        { mode: "balanced", targetLanguage: "English" }
      )
    );
    expect(result.pass).toBe(true);
  });

  it("still fails three near-identical Latin variants", () => {
    const result = withProductionEnv(() =>
      checkDistinctness(
        variants(
          "The moon rises like a silver coin",
          "The moon rises like a silver disc",
          "The moon rises like a silver ring"
        ),
        { mode: "balanced", targetLanguage: "English" }
      )
    );
    expect(result.pass).toBe(false);
  });
});

// =============================================================================
// 3.3 FIDELITY
// =============================================================================

describe("3.3 fidelity: CJK numerals", () => {
  it("accepts 一九二三 for a source 1923", () => {
    const result = checkFidelity("Nel 1923 il vento", [
      { label: "A", text: "一九二三年的风" },
      { label: "B", text: "一九二三年的风" },
      { label: "C", text: "一九二三年的风" },
    ]);
    expect(result.checks.numbers.pass).toBe(true);
    expect(result.pass).toBe(true);
  });

  it("accepts full-width digits", () => {
    const result = checkFidelity("In 1923", [
      { label: "A", text: "１９２３年" },
      { label: "B", text: "１９２３年" },
      { label: "C", text: "１９２３年" },
    ]);
    expect(result.checks.numbers.pass).toBe(true);
  });

  it("accepts 三十 for a source 30", () => {
    const result = checkFidelity("thirty 30 years", [
      { label: "A", text: "三十年" },
      { label: "B", text: "三十年" },
      { label: "C", text: "三十年" },
    ]);
    expect(result.checks.numbers.pass).toBe(true);
  });

  it("still reports a genuinely missing number", () => {
    const result = checkFidelity("In 1923 the wind", [
      { label: "A", text: "风起时" },
      { label: "B", text: "风起时" },
      { label: "C", text: "风起时" },
    ]);
    expect(result.checks.numbers.pass).toBe(false);
  });
});

describe("3.3 fidelity: CJK negation", () => {
  it("accepts 不 as preserving a negated source", () => {
    const result = checkFidelity("I do not walk", [
      { label: "A", text: "我不走" },
      { label: "B", text: "我不走" },
      { label: "C", text: "我不走" },
    ]);
    expect(result.checks.negation.pass).toBe(true);
  });

  it("accepts 没有", () => {
    const result = checkFidelity("There is nothing here", [
      { label: "A", text: "这里没有东西" },
      { label: "B", text: "这里没有东西" },
      { label: "C", text: "这里没有东西" },
    ]);
    expect(result.checks.negation.pass).toBe(true);
  });

  it("accepts 未 无 非 别 莫", () => {
    for (const marker of ["未", "无", "非", "别", "莫"]) {
      const result = checkFidelity("never", [
        { label: "A", text: `${marker}见` },
        { label: "B", text: `${marker}见` },
        { label: "C", text: `${marker}见` },
      ]);
      expect(result.checks.negation.pass).toBe(true);
    }
  });

  it("still flags a negated source rendered without any negation", () => {
    const result = checkFidelity("I do not walk", [
      { label: "A", text: "我走" },
      { label: "B", text: "我走" },
      { label: "C", text: "我走" },
    ]);
    expect(result.checks.negation.pass).toBe(false);
  });
});

describe("3.3 fidelity: proper nouns skipped for non-latin variants", () => {
  it("accepts Paris -> 巴黎 instead of demanding the Latin string", () => {
    const result = checkFidelity("We walked through Paris slowly", [
      { label: "A", text: "我们慢慢走过巴黎" },
      { label: "B", text: "我们慢慢走过巴黎" },
      { label: "C", text: "我们慢慢走过巴黎" },
    ]);
    expect(result.checks.properNouns.pass).toBe(true);
    expect(result.pass).toBe(true);
  });

  it("still enforces proper nouns when the variant IS Latin", () => {
    const result = checkFidelity("We walked through Paris slowly", [
      { label: "A", text: "Caminamos por Madrid despacio" },
      { label: "B", text: "Caminamos por Madrid despacio" },
      { label: "C", text: "Caminamos por Madrid despacio" },
    ]);
    expect(result.checks.properNouns.pass).toBe(false);
  });
});

describe("3.3 fidelity: full-width terminal intent", () => {
  it("treats ？ as a question", () => {
    const result = checkFidelity("Where are you?", [
      { label: "A", text: "你在哪里？" },
      { label: "B", text: "你在哪里？" },
      { label: "C", text: "你在哪里？" },
    ]);
    expect(result.checks.terminalIntent.pass).toBe(true);
  });

  it("treats ！ as an exclamation", () => {
    const result = checkFidelity("How beautiful!", [
      { label: "A", text: "多美啊！" },
      { label: "B", text: "多美啊！" },
      { label: "C", text: "多美啊！" },
    ]);
    expect(result.checks.terminalIntent.pass).toBe(true);
  });

  it("still flags a question rendered as a statement", () => {
    const result = checkFidelity("Where are you?", [
      { label: "A", text: "你在这里。" },
      { label: "B", text: "你在这里。" },
      { label: "C", text: "你在这里。" },
    ]);
    expect(result.checks.terminalIntent.pass).toBe(false);
  });
});

describe("3.3 REGRESSION: Latin fidelity unchanged", () => {
  it("passes a clean Latin translation", () => {
    const result = checkFidelity("In 1923 Paris was not silent!", [
      { label: "A", text: "En 1923 Paris no estaba en silencio!" },
      { label: "B", text: "En 1923 Paris no estaba en silencio!" },
      { label: "C", text: "En 1923 Paris no estaba en silencio!" },
    ]);
    expect(result.pass).toBe(true);
  });

  it("still catches a dropped number in Latin", () => {
    const result = checkFidelity("In 1923 the wind", [
      { label: "A", text: "El viento soplaba" },
      { label: "B", text: "El viento soplaba" },
      { label: "C", text: "El viento soplaba" },
    ]);
    expect(result.checks.numbers.pass).toBe(false);
  });
});

// =============================================================================
// 3.4 SUBJECT FORM
// =============================================================================

describe("3.4 detectSubjectForm reports unsupported_script for CJK", () => {
  it("returns unsupported_script rather than null", () => {
    expect(detectSubjectForm("我们站在桥上看风景")).toBe("unsupported_script");
    expect(detectSubjectForm("床前明月光")).toBe("unsupported_script");
  });

  it("normalizes unsupported_script back to null for the validator", () => {
    // The validator only accepts we/i/you/third_person/impersonal, so this
    // must not leak through as a literal subject form.
    expect(normalizeSubjectForm("unsupported_script")).toBe(null);
  });

  it("leaves Latin detection unchanged", () => {
    expect(detectSubjectForm("We walked through the rain")).toBe("we");
    expect(detectSubjectForm("I walk alone")).toBe("I");
    expect(detectSubjectForm("You are the wind")).toBe("you");
    expect(detectSubjectForm("The silence fell")).toBe(null);
  });
});

// =============================================================================
// 3.6 STOPWORDS
// =============================================================================

describe("3.6 stopwords resolve explicitly rather than defaulting to English", () => {
  it("reports known: false for CJK under the placeholder hint", () => {
    const resolved = resolveStopwordsForText(
      "床前明月光，疑是地上霜",
      "the target language"
    );
    expect(resolved.known).toBe(false);
    expect(resolved.stopwords.size).toBe(0);
    expect(resolved.language).toBe("unknown");
  });

  it("still returns English for Latin under the placeholder hint", () => {
    // Production sends this placeholder for EVERY thread. Changing the Latin
    // answer here would shift content-token counts and therefore gate
    // outcomes for all existing users.
    const resolved = resolveStopwordsForText(
      "The moon rises like a silver coin",
      "the target language"
    );
    expect(resolved.known).toBe(true);
    expect(resolved.stopwords.has("the")).toBe(true);
  });

  it("honours a real hint when one is supplied", () => {
    const resolved = resolveStopwordsForText("El sol se pone", "Spanish");
    expect(resolved.known).toBe(true);
    expect(resolved.language).toBe("Spanish");
  });
});
