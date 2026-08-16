/**
 * Phase 1: the offset-carrying token contract.
 *
 * The point of this suite is the equivalence test — for a Latin line where the
 * client's token index and its character offsets describe the same span, both
 * paths must mark the same word. That is what makes the offset field safe to
 * roll out additively: existing clients keep the index path, new clients get
 * offsets, and neither changes what the model sees.
 *
 * See the note in src/lib/text/__tests__/segmentText.test.ts about the vitest
 * runner not currently being installed.
 */

import { describe, it, expect } from "vitest";

import { markTokenInText } from "../suggestionsPromptBuilders";
import { segmentText } from "@/lib/text/segmentText";
import { GOLDEN_LATIN_CORPUS } from "@/lib/text/__fixtures__/latinCorpus";

const LATIN_LINE = "The moon rises like a silver coin";

describe("EQUIVALENCE: both paths mark the same span on Latin input", () => {
  // For a Latin line, segmentText offsets and whitespace token indices refer
  // to the same tokens by construction (the golden test proves the texts are
  // byte-identical). So marking by index and marking by offset must agree.
  // Compare on single-spaced input only. The index path rejoins with a single
  // space, so it cannot reproduce leading/trailing/repeated whitespace; the
  // offset path preserves it. That divergence is real and intended — it is
  // asserted separately under "offset path" — so it must not be smuggled into
  // the equivalence claim.
  const linesWithTokens = GOLDEN_LATIN_CORPUS.map((line) => line.trim()).filter(
    (line) => line.length > 0 && !/\s\s|\t|\n/.test(line)
  );

  it("has lines to test", () => {
    expect(linesWithTokens.length).toBeGreaterThanOrEqual(25);
  });

  for (const line of linesWithTokens) {
    it(`agrees on every token of ${JSON.stringify(line.slice(0, 40))}`, () => {
      const segments = segmentText(line);
      segments.forEach((seg, index) => {
        const byIndex = markTokenInText(line, index);
        const byOffset = markTokenInText(line, null, seg.start, seg.end);
        expect(byOffset).toBe(byIndex);
      });
    });
  }
});

describe("offset path", () => {
  it("marks the span identified by start/end", () => {
    expect(markTokenInText(LATIN_LINE, null, 4, 8)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("takes precedence over position when both are supplied", () => {
    // position 0 would mark "The"; the offsets point at "moon" and win.
    expect(markTokenInText(LATIN_LINE, 0, 4, 8)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("preserves original spacing exactly", () => {
    const spaced = "The  moon   rises";
    expect(markTokenInText(spaced, null, 5, 9)).toBe("The  [[moon]]   rises");
  });

  it("marks a multi-character CJK span with no surrounding whitespace", () => {
    // The case the index path cannot express: no whitespace to split on.
    const line = "那里，蝉在垂死挣扎";
    expect(markTokenInText(line, null, 5, 7)).toBe("那里，蝉在[[垂死]]挣扎");
  });

  it("marks every CJK segment correctly using segmentText offsets", () => {
    const line = "那蝉鸣的尽头，是引擎的哀鸣";
    for (const seg of segmentText(line)) {
      const marked = markTokenInText(line, null, seg.start, seg.end);
      expect(marked).toContain(`[[${seg.text}]]`);
      expect(marked.replace("[[", "").replace("]]", "")).toBe(line);
    }
  });

  it("marks the first span", () => {
    expect(markTokenInText(LATIN_LINE, null, 0, 3)).toBe(
      "[[The]] moon rises like a silver coin"
    );
  });

  it("marks the last span", () => {
    const start = LATIN_LINE.length - 4;
    expect(markTokenInText(LATIN_LINE, null, start, LATIN_LINE.length)).toBe(
      "The moon rises like a silver [[coin]]"
    );
  });
});

describe("index path is unchanged", () => {
  it("marks by whitespace token index when no offsets are given", () => {
    expect(markTokenInText(LATIN_LINE, 1)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("returns text untouched for a null position", () => {
    expect(markTokenInText(LATIN_LINE, null)).toBe(LATIN_LINE);
    expect(markTokenInText(LATIN_LINE, undefined)).toBe(LATIN_LINE);
  });

  it("returns text untouched for an out-of-range position", () => {
    expect(markTokenInText(LATIN_LINE, 99)).toBe(LATIN_LINE);
    expect(markTokenInText(LATIN_LINE, -1)).toBe(LATIN_LINE);
  });

  it("returns empty text untouched", () => {
    expect(markTokenInText("", 0)).toBe("");
  });
});

describe("out-of-bounds offsets fall back to the index path", () => {
  it("falls back when end exceeds the text length", () => {
    expect(markTokenInText(LATIN_LINE, 1, 4, 9999)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("falls back when start is negative", () => {
    expect(markTokenInText(LATIN_LINE, 1, -5, 8)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("falls back when end is not greater than start", () => {
    expect(markTokenInText(LATIN_LINE, 1, 8, 8)).toBe(
      "The [[moon]] rises like a silver coin"
    );
  });

  it("returns text unchanged when offsets are bad and position is absent", () => {
    expect(markTokenInText(LATIN_LINE, null, 4, 9999)).toBe(LATIN_LINE);
  });

  it("does not throw on any malformed offset combination", () => {
    const inputs: Array<[number | null, number | null]> = [
      [null, 5],
      [5, null],
      [-1, -1],
      [9999, 10000],
      [0, 0],
    ];
    for (const [start, end] of inputs) {
      expect(() => markTokenInText(LATIN_LINE, 1, start, end)).not.toThrow();
    }
  });
});
