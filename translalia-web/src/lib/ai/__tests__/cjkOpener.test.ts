/**
 * Amendment 3.1: CJK opener classification and the all-unknown skip.
 *
 * Two guarantees:
 *  (a) The closed-class lexicon classifies what it can, and says
 *      UNKNOWN_SCRIPT — not OTHER — for everything else.
 *  (b) When all three variants are UNKNOWN_SCRIPT the opener-equality check is
 *      skipped, not failed. All-unknown is not all-same.
 *
 * Plus the regression that motivated it: three variants opening 在 / 在 / 在.
 *
 * See the note in src/lib/text/__tests__/segmentText.test.ts about the runner.
 */

import { describe, it, expect } from "vitest";

import { openerType, structuralSignature } from "../structureSignature";
import { checkDistinctness } from "../diversityGate";
import { LATIN_FIXTURE_LINES } from "@/lib/text/__fixtures__/latinCorpus";

const variants = (a: string, b: string, c: string) =>
  [
    { label: "A" as const, text: a },
    { label: "B" as const, text: b },
    { label: "C" as const, text: c },
  ];

// =============================================================================
// (a) THE LEXICON
// =============================================================================

describe("CJK opener lexicon: prepositions", () => {
  const preps = ["在", "从", "向", "对", "与", "由", "于", "透过", "通过"];

  for (const word of preps) {
    it(`classifies ${word} as PREP`, () => {
      expect(openerType(`${word}那蝉鸣的尽头是引擎的哀鸣`)).toBe("PREP");
    });
  }

  it("prefers the two-character form over its first character", () => {
    // 通过 must not be read as a bare 通.
    expect(openerType("通过窗子看见月光")).toBe("PREP");
    expect(openerType("透过窗子看见月光")).toBe("PREP");
  });
});

describe("CJK opener lexicon: pronouns", () => {
  const prons = ["我", "你", "他", "她", "它", "我们", "你们", "他们"];

  for (const word of prons) {
    it(`classifies ${word} as PRON`, () => {
      expect(openerType(`${word}站在桥上看风景`)).toBe("PRON");
    });
  }

  it("prefers 我们 over 我", () => {
    // Both are PRON, but the longest-first rule must still be exercised.
    expect(openerType("我们站在桥上")).toBe("PRON");
    expect(openerType("我站在桥上")).toBe("PRON");
  });
});

describe("CJK opener lexicon: determiners", () => {
  for (const word of ["这", "那", "此"]) {
    it(`classifies ${word} as DET`, () => {
      expect(openerType(`${word}蝉鸣的尽头是引擎的哀鸣`)).toBe("DET");
    });
  }
});

describe("CJK opener lexicon: everything else is UNKNOWN_SCRIPT, not OTHER", () => {
  const unlisted = [
    "风过处翅羽翻卷于灰绿之上",
    "床前明月光疑是地上霜",
    "举头望明月低头思故乡",
    "枯藤老树昏鸦小桥流水人家",
    "卑鄙是卑鄙者的通行证",
  ];

  for (const line of unlisted) {
    it(`returns UNKNOWN_SCRIPT for ${JSON.stringify(line.slice(0, 12))}`, () => {
      expect(openerType(line)).toBe("UNKNOWN_SCRIPT");
    });
  }

  it("never returns OTHER for CJK — that would claim a judgement we cannot make", () => {
    for (const line of unlisted) {
      expect(openerType(line)).not.toBe("OTHER");
    }
  });

  it("classifies Japanese by the same rule", () => {
    expect(openerType("古池や蛙飛び込む水の音")).toBe("UNKNOWN_SCRIPT");
    // 私 is not in the lexicon — the list is closed-class Chinese only.
    expect(openerType("私は昨日東京の古い書店で詩集を買いました")).toBe(
      "UNKNOWN_SCRIPT"
    );
  });

  it("strips leading punctuation before matching", () => {
    expect(openerType("「在垂死挣扎")).toBe("PREP");
    expect(openerType("　　在垂死挣扎")).toBe("PREP");
    expect(openerType("——那蝉鸣的尽头")).toBe("DET");
  });

  it("returns OTHER for punctuation-only input, not UNKNOWN_SCRIPT", () => {
    // Documents actual behaviour rather than asserting a preference.
    // `detectScript` counts only script-bearing characters, so a string of
    // pure CJK punctuation is not classified as `han` at all — it falls to the
    // Latin path and comes back OTHER. That is defensible: a line with no
    // characters has no opener to be uncertain about, so OTHER ("we looked and
    // found nothing") is more accurate here than UNKNOWN_SCRIPT ("we have no
    // lexicon"). Degenerate input; noted so a future change is deliberate.
    expect(openerType("，。、")).toBe("OTHER");
  });
});

// =============================================================================
// LATIN IS UNTOUCHED
// =============================================================================

describe("REGRESSION: Latin opener classification is unchanged", () => {
  it("still classifies English pronouns, prepositions and determiners", () => {
    expect(openerType("I walk in the rain", "English")).toBe("PRON");
    expect(openerType("On the bus, silence", "English")).toBe("PREP");
    expect(openerType("The moon rises", "English")).toBe("NOUN_PHRASE");
    expect(openerType("Walking through the rain", "English")).toBe("GERUND");
  });

  it("still returns OTHER — not UNKNOWN_SCRIPT — for unclassified Latin", () => {
    expect(openerType("Silence fell across the valley", "English")).toBe("OTHER");
  });

  it("never returns UNKNOWN_SCRIPT for any line in the Latin corpus", () => {
    for (const line of LATIN_FIXTURE_LINES) {
      expect(openerType(line, "English")).not.toBe("UNKNOWN_SCRIPT");
    }
  });

  it("keeps Latin determiners as NOUN_PHRASE, not the new DET", () => {
    // DET is CJK-only by design; Latin determiners keep their existing label
    // so no Latin signature changes.
    expect(openerType("The cat sat", "English")).toBe("NOUN_PHRASE");
    expect(openerType("El gato se sentó", "Spanish")).toBe("NOUN_PHRASE");
  });
});

// =============================================================================
// (b) ALL-UNKNOWN SKIPS THE OPENER CHECK
// =============================================================================

describe("(b) all-UNKNOWN_SCRIPT skips the opener-equality check", () => {
  // Three genuinely different unlisted openers. Under the old code all three
  // scored OTHER and the gate called them identical.
  const A = "床前明月光，疑是地上霜";
  const B = "枯藤老树昏鸦，小桥流水人家";
  const C = "白日依山尽，黄河入海流";

  it("confirms the premise: all three are UNKNOWN_SCRIPT", () => {
    for (const text of [A, B, C]) {
      expect(openerType(text)).toBe("UNKNOWN_SCRIPT");
    }
  });

  it("does not fail balanced mode with opener_all_same", () => {
    const result = checkDistinctness(variants(A, B, C), { mode: "balanced" });
    expect(result.reason ?? "").not.toContain("opener_all_same");
  });

  it("does not fail adventurous mode with opener_duplicate", () => {
    const result = checkDistinctness(variants(A, B, C), {
      mode: "adventurous",
    });
    expect(result.reason ?? "").not.toContain("opener_duplicate");
  });
});

describe("the 在/在/在 regression from the production log", () => {
  // Three variants that really do share an opener. Now that 在 is classified,
  // the check has real signal and SHOULD fire — this is the case where being
  // silent would be wrong.
  const A = "在垂死挣扎的蝉鸣里";
  const B = "在引擎的哀鸣中沉没";
  const C = "在灰绿之上翻卷的翅羽";

  it("classifies all three as PREP rather than OTHER", () => {
    for (const text of [A, B, C]) {
      expect(openerType(text)).toBe("PREP");
    }
  });

  it("is not treated as no-signal, because the openers are now known", () => {
    const result = checkDistinctness(variants(A, B, C), { mode: "balanced" });
    // Real shared opener -> the check is allowed to fire.
    expect(result.pass).toBe(false);
  });

  it("still passes when the three openers genuinely differ", () => {
    const result = checkDistinctness(
      variants("在垂死挣扎的蝉鸣里", "我们听见引擎的哀鸣", "这翅羽翻卷于灰绿之上"),
      { mode: "balanced" }
    );
    expect(result.reason ?? "").not.toContain("opener_all_same");
  });
});

describe("mixed known/unknown openers still enforce the check", () => {
  // Only skip when ALL THREE are unknown. Two knowns plus one unknown still
  // carries signal.
  it("does not skip when one variant has a known opener", () => {
    const A = "在垂死挣扎的蝉鸣里";
    const B = "在引擎的哀鸣中沉没";
    const C = "床前明月光疑是地上霜"; // UNKNOWN_SCRIPT

    expect(openerType(A)).toBe("PREP");
    expect(openerType(B)).toBe("PREP");
    expect(openerType(C)).toBe("UNKNOWN_SCRIPT");

    // A and B share PREP, so adventurous mode must still object.
    const result = checkDistinctness(variants(A, B, C), {
      mode: "adventurous",
    });
    expect(result.pass).toBe(false);
  });
});

// =============================================================================
// SIGNATURE KNOCK-ON
// =============================================================================

describe("structuralSignature reflects the new opener types", () => {
  it("distinguishes a 在-opener from an unlisted opener", () => {
    const withPrep = structuralSignature("在垂死挣扎的蝉鸣里").signature;
    const unknown = structuralSignature("床前明月光疑是地上霜").signature;
    expect(withPrep).not.toBe(unknown);
    expect(withPrep.startsWith("PREP|")).toBe(true);
    expect(unknown.startsWith("UNKNOWN_SCRIPT|")).toBe(true);
  });

  it("leaves Latin signatures on their existing opener labels", () => {
    expect(structuralSignature("The moon rises", "English").signature).toContain(
      "NOUN_PHRASE|"
    );
    expect(structuralSignature("I walk in the rain", "English").signature).toContain(
      "PRON|"
    );
  });
});
