/**
 * Phase 2a regression guarantees for the variant chip path.
 *
 * The load-bearing claims, in order of how much damage getting them wrong
 * would do:
 *
 *  1. Latin threads are untouched. `buildVariantTokens` on a Method 2 Latin
 *     variant must produce exactly what `fullText.split(/\s+/)` produced.
 *  2. Method 1 threads (populated `words[]`) are untouched.
 *  3. Chinese produces multiple tokens with punctuation flagged non-wordLike.
 *  4. Keys and dnd ids stay unique when a token repeats in one line.
 *  5. Offsets handed to the suggestions API are valid for the string the
 *     server will apply them to, or absent.
 *
 * See the note in src/lib/text/__tests__/segmentText.test.ts about the runner.
 */

import { describe, it, expect } from "vitest";

import { buildVariantTokens, offsetsForTarget } from "../WordGrid";
import { markTokenInText } from "@/lib/ai/suggestions/suggestionsPromptBuilders";
import { joinSegments, separatorForScript } from "@/lib/text/segmentText";
import { detectScript } from "@/lib/text/script";
import { LATIN_FIXTURE_LINES } from "@/lib/text/__fixtures__/latinCorpus";
import { CJK_GOLDEN } from "@/lib/text/__fixtures__/cjk-segmentation-golden";

/** A Method 2 variant: `words` always empty. */
const method2 = (fullText: string) => ({ words: [], fullText });

/** A Method 1 variant: model-supplied alignment. */
const method1 = (
  words: Array<{
    original: string;
    translation: string;
    partOfSpeech: string;
    position: number;
  }>,
  fullText: string
) => ({ words, fullText });

// =============================================================================
// 1. LATIN THREADS UNCHANGED
// =============================================================================

describe("REGRESSION: Latin Method 2 variants tokenise exactly as before", () => {
  for (const line of LATIN_FIXTURE_LINES) {
    it(`matches the old split(/\\s+/) fallback for ${JSON.stringify(line.slice(0, 40))}`, () => {
      // This is the literal code that was replaced.
      const before = line
        .split(/\s+/)
        .filter(Boolean)
        .map((word, idx) => ({
          original: word,
          translation: word,
          partOfSpeech: "neutral",
          position: idx,
        }));

      const after = buildVariantTokens(method2(line));

      expect(after.map((t) => t.text)).toEqual(before.map((t) => t.translation));
      expect(after.map((t) => t.original)).toEqual(before.map((t) => t.original));
      expect(after.map((t) => t.position)).toEqual(before.map((t) => t.position));
      expect(after.map((t) => t.partOfSpeech)).toEqual(
        before.map((t) => t.partOfSpeech)
      );
    });
  }

  it("marks every Latin token draggable — no chip silently becomes inline text", () => {
    for (const line of LATIN_FIXTURE_LINES) {
      for (const token of buildVariantTokens(method2(line))) {
        expect(token.wordLike).toBe(true);
      }
    }
  });

  it("still joins Latin tokens with a single space", () => {
    const line = "The moon rises like a silver coin";
    const tokens = buildVariantTokens(method2(line));
    expect(joinSegments(tokens.map((t) => t.text), detectScript(line))).toBe(line);
  });

  it("keeps the Latin append separator as a space", () => {
    expect(separatorForScript(detectScript("The moon rises"))).toBe(" ");
  });
});

// =============================================================================
// 2. METHOD 1 THREADS UNCHANGED
// =============================================================================

describe("REGRESSION: Method 1 variants pass through untouched", () => {
  const words = [
    { original: "El", translation: "The", partOfSpeech: "determiner", position: 0 },
    { original: "gato", translation: "cat", partOfSpeech: "noun", position: 1 },
    { original: "se sentó", translation: "sat", partOfSpeech: "verb", position: 2 },
  ];

  it("uses words[] rather than segmenting fullText", () => {
    const tokens = buildVariantTokens(method1(words, "The cat sat on the mat"));
    expect(tokens.map((t) => t.text)).toEqual(["The", "cat", "sat"]);
    expect(tokens.map((t) => t.original)).toEqual(["El", "gato", "se sentó"]);
  });

  it("preserves part of speech, which the segmented path cannot know", () => {
    const tokens = buildVariantTokens(method1(words, "irrelevant"));
    expect(tokens.map((t) => t.partOfSpeech)).toEqual([
      "determiner",
      "noun",
      "verb",
    ]);
  });

  it("preserves model-supplied positions", () => {
    const tokens = buildVariantTokens(method1(words, "irrelevant"));
    expect(tokens.map((t) => t.position)).toEqual([0, 1, 2]);
  });

  it("carries no offsets, so the suggestions call keeps using position", () => {
    for (const token of buildVariantTokens(method1(words, "irrelevant"))) {
      expect(token.start).toBe(null);
      expect(token.end).toBe(null);
    }
  });

  it("handles a multi-word aligned token without splitting it", () => {
    const tokens = buildVariantTokens(method1(words, "irrelevant"));
    expect(tokens[2].original).toBe("se sentó");
  });
});

// =============================================================================
// 3. CHINESE PRODUCES REAL TOKENS
// =============================================================================

describe("Chinese variants produce multiple tokens with punctuation flagged", () => {
  const chinese = CJK_GOLDEN.filter((c) => c.locale === "zh");

  for (const testCase of chinese) {
    it(`produces more than one draggable token for ${testCase.id}`, () => {
      const tokens = buildVariantTokens(method2(testCase.text));
      expect(tokens.filter((t) => t.wordLike).length).toBeGreaterThan(1);
    });
  }

  it("flags CJK punctuation as non-wordLike so it renders inline", () => {
    const tokens = buildVariantTokens(method2("那里，蝉在垂死挣扎"));
    const inline = tokens.filter((t) => !t.wordLike);
    expect(inline.map((t) => t.text)).toEqual(["，"]);
  });

  it("does not drop punctuation from the token list", () => {
    const line = "那里，蝉在垂死挣扎";
    const tokens = buildVariantTokens(method2(line));
    expect(joinSegments(tokens.map((t) => t.text), "han")).toBe(line);
  });

  it("no longer returns the whole line as one token", () => {
    for (const testCase of chinese) {
      const tokens = buildVariantTokens(method2(testCase.text));
      expect(tokens.map((t) => t.text)).not.toEqual([testCase.text]);
    }
  });
});

// =============================================================================
// 4. APPEND SEPARATOR
// =============================================================================

describe("append separator is script-aware", () => {
  it("is empty for Chinese, so chips do not assemble as 词 词 词", () => {
    expect(separatorForScript(detectScript("那里，蝉在垂死挣扎"))).toBe("");
  });

  it("is empty for Japanese", () => {
    expect(separatorForScript(detectScript("古池や蛙飛び込む水の音"))).toBe("");
  });

  it("is a space for Latin and for Devanagari", () => {
    expect(separatorForScript(detectScript("The moon rises"))).toBe(" ");
    expect(separatorForScript(detectScript("चाँद की रोशनी में"))).toBe(" ");
  });

  it("reassembles a Chinese line correctly chip by chip", () => {
    const line = "那蝉鸣的尽头，是引擎的哀鸣";
    const tokens = buildVariantTokens(method2(line));
    const sep = separatorForScript(detectScript(line));

    // Mirrors appendToDraft: separator only when the draft is non-empty.
    let draft = "";
    for (const token of tokens) {
      draft = draft.trim() ? draft + sep + token.text : draft + token.text;
    }
    expect(draft).toBe(line);
  });

  it("reassembles a Latin line correctly chip by chip", () => {
    const line = "The moon rises like a silver coin";
    const tokens = buildVariantTokens(method2(line));
    const sep = separatorForScript(detectScript(line));

    let draft = "";
    for (const token of tokens) {
      draft = draft.trim() ? draft + sep + token.text : draft + token.text;
    }
    expect(draft).toBe(line);
  });
});

// =============================================================================
// 5. KEY / DND-ID UNIQUENESS WITH REPEATED TOKENS
// =============================================================================

describe("repeated tokens do not collide on key or dnd id", () => {
  // 看 appears twice and 风景 twice in this line.
  const REPEATING = "你站在桥上看风景，看风景的人在楼上看你";

  const keyFor = (t: { start: number | null; position: number }, idx: number) =>
    `1-${t.start ?? `p${t.position}`}-${idx}`;
  const dndIdFor = (t: {
    start: number | null;
    position: number;
    text: string;
  }) => `variant-1-line-0-${t.start ?? `p${t.position}`}-${t.text}`;

  it("actually contains repeated tokens (guards the test itself)", () => {
    const texts = buildVariantTokens(method2(REPEATING)).map((t) => t.text);
    expect(texts.length).toBeGreaterThan(new Set(texts).size);
  });

  it("produces unique React keys", () => {
    const tokens = buildVariantTokens(method2(REPEATING));
    const keys = tokens.map(keyFor);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("produces unique dnd-kit ids", () => {
    const tokens = buildVariantTokens(method2(REPEATING));
    const ids = tokens.map(dndIdFor);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("would have collided under the old position-based dnd id", () => {
    // Demonstrates the bug this fixes: the old fallback used the array index
    // as position, so ids were unique by accident. Under words[] a model can
    // legitimately repeat a position, and identical text then collides.
    const words = [
      { original: "看", translation: "look", partOfSpeech: "verb", position: 4 },
      { original: "看", translation: "look", partOfSpeech: "verb", position: 4 },
    ];
    const tokens = buildVariantTokens(method1(words, "look look"));
    const oldIds = tokens.map(
      (t) => `variant-1-line-0-${t.position}-${t.text}`
    );
    expect(new Set(oldIds).size).toBe(1); // collision under the old scheme
  });
});

// =============================================================================
// 6. OFFSETS SENT TO THE SUGGESTIONS API
// =============================================================================

describe("offsetsForTarget only emits offsets that are valid for the target", () => {
  const LINE = "那蝉鸣的尽头，是引擎的哀鸣";

  it("passes offsets straight through when the target is the same string", () => {
    const tokens = buildVariantTokens(method2(LINE));
    for (const token of tokens) {
      const resolved = offsetsForTarget(LINE, token.text, token.start, token.end);
      expect(resolved.start).toBe(token.start);
      expect(resolved.end).toBe(token.end);
      expect(LINE.slice(resolved.start!, resolved.end!)).toBe(token.text);
    }
  });

  it("relocates offsets when the draft has a prefix", () => {
    // The realistic case: the user clicked the card, so the draft is the
    // variant text appended after something else. Raw fullText offsets would
    // mark the wrong span here.
    const draft = `前面的话${LINE}`;
    const resolved = offsetsForTarget(draft, "引擎", 8, 10);
    expect(draft.slice(resolved.start!, resolved.end!)).toBe("引擎");
  });

  it("returns nulls when the token is ambiguous in the target", () => {
    // 看 appears three times — no way to know which one was meant.
    const draft = "你站在桥上看风景，看风景的人在楼上看你";
    expect(offsetsForTarget(draft, "看", 5, 6)).toEqual({
      start: 5,
      end: 6,
    }); // exact slice matches, so it is not ambiguous
    expect(offsetsForTarget(draft, "看", 99, 100)).toEqual({
      start: null,
      end: null,
    }); // bad offsets + ambiguous text -> fall back to index path
  });

  it("returns nulls when the token is absent from the target", () => {
    expect(offsetsForTarget("completely different text", "引擎", 8, 10)).toEqual({
      start: null,
      end: null,
    });
  });

  it("returns nulls for an empty or missing target", () => {
    expect(offsetsForTarget("", "引擎", 0, 2)).toEqual({ start: null, end: null });
    expect(offsetsForTarget(null, "引擎", 0, 2)).toEqual({
      start: null,
      end: null,
    });
    expect(offsetsForTarget(undefined, "引擎", 0, 2)).toEqual({
      start: null,
      end: null,
    });
  });

  it("resolves Latin tokens against their own variant text", () => {
    const line = "The moon rises like a silver coin";
    for (const token of buildVariantTokens(method2(line))) {
      const resolved = offsetsForTarget(line, token.text, token.start, token.end);
      expect(line.slice(resolved.start!, resolved.end!)).toBe(token.text);
    }
  });
});

// =============================================================================
// 7. END TO END — right-click a chip, server marks the right span
// =============================================================================

describe("E2E: right-clicking a chip marks the correct span server-side", () => {
  // Walks the whole Phase 2a -> Phase 1 path without a browser:
  //   buildVariantTokens -> offsetsForTarget -> focus payload -> markTokenInText
  // markTokenInText is the real server function from the prompt builder.

  const asServerWouldReceive = (token: {
    text: string;
    position: number;
    start: number | null;
    end: number | null;
  }, targetLineDraft: string) => {
    const { start, end } = offsetsForTarget(
      targetLineDraft,
      token.text,
      token.start,
      token.end
    );
    return { position: token.position, start, end };
  };

  it("marks every Chinese chip correctly when the draft is the variant text", () => {
    const line = "那蝉鸣的尽头，是引擎的哀鸣";
    const tokens = buildVariantTokens(method2(line)).filter((t) => t.wordLike);

    for (const token of tokens) {
      const focus = asServerWouldReceive(token, line);
      const marked = markTokenInText(line, focus.position, focus.start, focus.end);

      // The chip the user right-clicked is the span that got bracketed.
      expect(marked).toContain(`[[${token.text}]]`);
      // And nothing else changed.
      expect(marked.replace("[[", "").replace("]]", "")).toBe(line);
    }
  });

  it("marks the correct span when the draft has a prefix", () => {
    const line = "那里，蝉在垂死挣扎";
    const draft = `已有内容${line}`;
    const token = buildVariantTokens(method2(line)).find(
      (t) => t.text === "垂死"
    )!;

    const focus = asServerWouldReceive(token, draft);
    const marked = markTokenInText(draft, focus.position, focus.start, focus.end);

    expect(marked).toBe("已有内容那里，蝉在[[垂死]]挣扎");
  });

  it("marks the correct span for Latin chips too", () => {
    const line = "The moon rises like a silver coin";
    const tokens = buildVariantTokens(method2(line));

    for (const token of tokens) {
      const focus = asServerWouldReceive(token, line);
      const marked = markTokenInText(line, focus.position, focus.start, focus.end);
      expect(marked).toContain(`[[${token.text}]]`);
    }
  });

  it("degrades to the index path, not a wrong span, when offsets cannot be resolved", () => {
    const line = "那里，蝉在垂死挣扎";
    const token = buildVariantTokens(method2(line)).find(
      (t) => t.text === "垂死"
    )!;
    const unrelatedDraft = "完全不同的草稿";

    const focus = asServerWouldReceive(token, unrelatedDraft);
    expect(focus.start).toBe(null);
    expect(focus.end).toBe(null);

    // With no offsets the server falls back to the token index — the exact
    // behaviour that shipped before this change.
    const marked = markTokenInText(
      unrelatedDraft,
      focus.position,
      focus.start,
      focus.end
    );
    const byIndexOnly = markTokenInText(unrelatedDraft, focus.position);
    expect(marked).toBe(byIndexOnly);
  });
});
