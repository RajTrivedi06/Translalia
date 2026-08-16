/**
 * Phase 0 tests for `detectScript`.
 *
 * See the note in segmentText.test.ts about the vitest runner.
 */

import { describe, it, expect } from "vitest";

import { detectScript, localeForScript, UNSPACED_SCRIPTS } from "../script";
import {
  LATIN_FIXTURE_LINES,
  LATIN_PROMPT_EXAMPLE_LINES,
  NON_LATIN_SPACED_LINES,
} from "../__fixtures__/latinCorpus";
import { CJK_GOLDEN } from "../__fixtures__/cjk-segmentation-golden";

describe("detectScript: Latin", () => {
  for (const line of [...LATIN_FIXTURE_LINES, ...LATIN_PROMPT_EXAMPLE_LINES]) {
    it(`classifies as latin: ${JSON.stringify(line.slice(0, 40))}`, () => {
      expect(detectScript(line)).toBe("latin");
    });
  }

  it("handles accented Latin", () => {
    expect(detectScript("El sol se pone detrás de las montañas")).toBe("latin");
    expect(detectScript("Je marche dans la pluie comme une pensée")).toBe("latin");
  });
});

describe("detectScript: other (whitespace-delimited non-Latin)", () => {
  // Devanagari and Arabic are whitespace-delimited, so they must route down
  // the same path as Latin — "other", not a CJK class.
  for (const line of NON_LATIN_SPACED_LINES) {
    it(`classifies as other: ${JSON.stringify(line.slice(0, 30))}`, () => {
      expect(detectScript(line)).toBe("other");
    });
  }

  it("does not treat 'other' as unspaced", () => {
    expect(UNSPACED_SCRIPTS.has("other")).toBe(false);
    expect(UNSPACED_SCRIPTS.has("latin")).toBe(false);
  });
});

describe("detectScript: han", () => {
  const chinese = CJK_GOLDEN.filter((c) => c.locale === "zh");

  for (const testCase of chinese) {
    it(`classifies as han: ${testCase.id}`, () => {
      expect(detectScript(testCase.text)).toBe("han");
    });
  }

  it("classifies Han with CJK punctuation as han", () => {
    expect(detectScript("床前明月光，疑是地上霜")).toBe("han");
  });
});

describe("detectScript: kana wins over han", () => {
  const japanese = CJK_GOLDEN.filter((c) => c.locale === "ja");

  for (const testCase of japanese) {
    it(`classifies as kana: ${testCase.id}`, () => {
      expect(detectScript(testCase.text)).toBe("kana");
    });
  }

  it("returns kana even when Han outnumbers kana", () => {
    // 東京書店詩集 (6 Han) vs の (1 kana). Japanese prose is Han-heavy with
    // sparse kana particles, so a majority test would call this han.
    expect(detectScript("東京書店詩集の")).toBe("kana");
  });

  it("returns kana for a single kana character among Han", () => {
    expect(detectScript("古池や蛙飛込水音")).toBe("kana");
  });

  it("returns han when there is no kana at all", () => {
    expect(detectScript("東京書店詩集")).toBe("han");
  });
});

describe("detectScript: mixed Latin + CJK resolves by majority", () => {
  it("returns latin when Latin letters outnumber CJK", () => {
    // Guards against a stray CJK char flipping an English line onto the
    // unspaced path, where it would then be joined without spaces.
    expect(detectScript("The moon rises like a silver coin 月")).toBe("latin");
  });

  it("returns han when CJK outnumbers Latin", () => {
    expect(detectScript("床前明月光，疑是地上霜 moon")).toBe("han");
  });

  it("returns latin for a mostly-English line containing one kana", () => {
    expect(detectScript("we translated the word の in this line")).toBe("latin");
  });

  it("ignores punctuation and digits when counting the majority", () => {
    // 2 Latin vs 2 Han, with the tie going to CJK — punctuation and the
    // digits must not tip it.
    expect(detectScript("ab 1923!!! 明月")).toBe("han");
  });
});

describe("detectScript: degenerate input", () => {
  it("returns other for the empty string", () => {
    expect(detectScript("")).toBe("other");
  });

  it("returns other for whitespace only", () => {
    expect(detectScript("   \n\t")).toBe("other");
  });

  it("returns other for punctuation and digits only", () => {
    expect(detectScript("1923 50% $100 ...")).toBe("other");
  });
});

describe("localeForScript", () => {
  it("maps script classes to BCP-47 tags", () => {
    expect(localeForScript("han")).toBe("zh");
    expect(localeForScript("kana")).toBe("ja");
    expect(localeForScript("thai")).toBe("th");
    expect(localeForScript("latin")).toBe("en");
    expect(localeForScript("other")).toBe("en");
  });
});
