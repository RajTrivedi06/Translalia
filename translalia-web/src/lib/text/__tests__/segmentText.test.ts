/**
 * Phase 0 regression guarantees for `segmentText` / `joinSegments`.
 *
 * The load-bearing test is GOLDEN: Latin-script behaviour must stay
 * byte-identical to `split(/\s+/).filter(Boolean)`. Everything downstream —
 * the gates, the prompt builders, the Workshop chips — currently whitespace
 * splits. If this suite goes green, adopting `segmentText` at those call sites
 * is a no-op for existing users, and that is the whole point of Phase 0.
 *
 * NOTE ON THE RUNNER: these import from `vitest`, matching the three existing
 * test files in this repo (`src/lib/workshop/runTranslationTick.test.ts` and
 * siblings). Vitest is not currently installed and there is no `test` script —
 * see `docs/04-investigations/cjk-handoff-to-cursor.md`.
 */

import { describe, it, expect } from "vitest";

import { segmentText, joinSegments } from "../segmentText";
import { detectScript } from "../script";
import { GOLDEN_LATIN_CORPUS } from "../__fixtures__/latinCorpus";
import { CJK_GOLDEN } from "../__fixtures__/cjk-segmentation-golden";

const BRIEF_LINES = [
  "那里，蝉在垂死挣扎",
  "此处，知了正濒临绝境",
  "那蝉鸣的尽头，是引擎的哀鸣",
  "风过处，翅羽翻卷于灰绿之上",
];

// =============================================================================
// GOLDEN — Latin behaviour is byte-identical to the current whitespace split
// =============================================================================

describe("GOLDEN: Latin segmentation matches split(/\\s+/) exactly", () => {
  it("covers at least 30 lines", () => {
    expect(GOLDEN_LATIN_CORPUS.length).toBeGreaterThanOrEqual(30);
  });

  for (const line of GOLDEN_LATIN_CORPUS) {
    it(`is byte-identical for ${JSON.stringify(line)}`, () => {
      const expected = line.split(/\s+/).filter(Boolean);
      const actual = segmentText(line).map((s) => s.text);
      expect(actual).toEqual(expected);
    });
  }

  it("is byte-identical across the whole corpus in one pass", () => {
    const actual = GOLDEN_LATIN_CORPUS.map((l) =>
      segmentText(l).map((s) => s.text)
    );
    const expected = GOLDEN_LATIN_CORPUS.map((l) =>
      l.split(/\s+/).filter(Boolean)
    );
    expect(actual).toEqual(expected);
  });

  it("keeps punctuation attached to Latin tokens rather than splitting it off", () => {
    // Splitting "árboles," into "árboles" + "," would break parity with
    // split(/\s+/). The wordLike flag is how consumers tell them apart, not
    // a change in tokenisation.
    const segments = segmentText("Como el viento entre los árboles, mi corazón");
    expect(segments.map((s) => s.text)).toContain("árboles,");
  });
});

// =============================================================================
// OFFSETS — start/end index back into the original string
// =============================================================================

describe("OFFSETS: text.slice(start, end) === segment text", () => {
  const allInputs = [
    ...GOLDEN_LATIN_CORPUS,
    ...CJK_GOLDEN.map((c) => c.text),
  ];

  for (const input of allInputs) {
    it(`round-trips every offset for ${JSON.stringify(input.slice(0, 40))}`, () => {
      for (const seg of segmentText(input)) {
        expect(input.slice(seg.start, seg.end)).toBe(seg.text);
      }
    });
  }

  it("returns offsets that are non-decreasing and in range", () => {
    for (const input of allInputs) {
      let previousEnd = 0;
      for (const seg of segmentText(input)) {
        expect(seg.start).toBeGreaterThanOrEqual(previousEnd);
        expect(seg.end).toBeGreaterThan(seg.start);
        expect(seg.end).toBeLessThanOrEqual(input.length);
        previousEnd = seg.end;
      }
    }
  });
});

// =============================================================================
// ROUNDTRIP — join(segment(s)) === s for space-free CJK
// =============================================================================

describe("ROUNDTRIP: joinSegments(segmentText(s), detectScript(s)) === s", () => {
  const spaceFreeCjk = CJK_GOLDEN.map((c) => c.text).filter(
    (t) => !/\s/.test(t)
  );

  it("has space-free CJK inputs to test", () => {
    expect(spaceFreeCjk.length).toBeGreaterThan(0);
  });

  for (const line of spaceFreeCjk) {
    it(`round-trips ${JSON.stringify(line)}`, () => {
      expect(joinSegments(segmentText(line), detectScript(line))).toBe(line);
    });
  }

  it("round-trips single-spaced Latin input too", () => {
    const line = "The moon rises like a silver coin";
    expect(joinSegments(segmentText(line), detectScript(line))).toBe(line);
  });

  it("accepts plain strings as well as Segments", () => {
    expect(joinSegments(["那里", "蝉"], "han")).toBe("那里蝉");
    expect(joinSegments(["the", "moon"], "latin")).toBe("the moon");
  });
});

// =============================================================================
// CJK — the four brief lines produce more than one segment
// =============================================================================

describe("CJK: brief lines segment into more than one token", () => {
  for (const line of BRIEF_LINES) {
    it(`produces >1 segment for ${JSON.stringify(line)}`, () => {
      const segments = segmentText(line);
      expect(segments.length).toBeGreaterThan(1);
      // And more than one *word*, not just word + punctuation.
      expect(segments.filter((s) => s.wordLike).length).toBeGreaterThan(1);
    });
  }

  it("never returns the whole line as a single segment", () => {
    for (const line of BRIEF_LINES) {
      expect(segmentText(line).map((s) => s.text)).not.toEqual([line]);
    }
  });
});

// =============================================================================
// FROZEN FIXTURE — exact segmenter baseline
// =============================================================================

describe("FIXTURE: segmentation matches the frozen ICU baseline", () => {
  // A failure here means the segmenter changed under you. Read the diff before
  // touching the fixture. See the header of __fixtures__/cjk-segmentation-golden.ts.
  for (const testCase of CJK_GOLDEN) {
    it(`matches baseline for ${testCase.id}`, () => {
      expect(segmentText(testCase.text)).toEqual(testCase.segments);
    });
  }

  it("retains CJK punctuation as its own non-wordLike segment", () => {
    const segments = segmentText("那里，蝉在垂死挣扎");
    const punctuation = segments.filter((s) => !s.wordLike);
    expect(punctuation.map((s) => s.text)).toEqual(["，"]);
  });

  it("flags every non-punctuation CJK segment as wordLike", () => {
    for (const testCase of CJK_GOLDEN) {
      for (const seg of segmentText(testCase.text)) {
        const isPunctuation = !/[\p{L}\p{N}]/u.test(seg.text);
        expect(seg.wordLike).toBe(!isPunctuation);
      }
    }
  });
});

// =============================================================================
// KNOWN LIMITATION — astral-plane offsets are UTF-16 code units
// =============================================================================

describe("KNOWN LIMITATION: offsets are UTF-16 code units, not code points", () => {
  // Deliberate. `String.length` is the basis used by metadata.characterCount
  // everywhere in this codebase, so offsets share it rather than introducing a
  // second, incompatible basis. This test documents the consequence; it is not
  // a bug report. Do not "fix" it without changing characterCount too.
  const astral = "𠀋𠀍𠀐"; // CJK Extension B, 3 chars / 6 UTF-16 code units

  it("counts astral-plane Han as 2 code units per character", () => {
    expect(astral.length).toBe(6);
    expect([...astral].length).toBe(3);
  });

  it("still round-trips slice(start, end) despite the surrogate pairs", () => {
    for (const seg of segmentText(astral)) {
      expect(astral.slice(seg.start, seg.end)).toBe(seg.text);
    }
  });

  it("classifies astral-plane Han as han, not other", () => {
    expect(detectScript(astral)).toBe("han");
  });
});

// =============================================================================
// EMPTY / DEGENERATE INPUT
// =============================================================================

describe("degenerate input", () => {
  it("returns [] for the empty string", () => {
    expect(segmentText("")).toEqual([]);
  });

  it("returns [] for whitespace-only input", () => {
    expect(segmentText("   \t\n ")).toEqual([]);
  });

  it("joins [] to the empty string", () => {
    expect(joinSegments([], "han")).toBe("");
    expect(joinSegments([], "latin")).toBe("");
  });
});
