import { describe, it, expect } from "vitest";
import { segmentIntoBlocks } from "./parser";
import type { ParseOptions } from "./types";

const opts = (over: Partial<ParseOptions> = {}): ParseOptions => ({
  minWords: 1,
  maxWords: 3,
  ...over,
});

describe("segmentIntoBlocks — basic splitting", () => {
  it("returns [] for empty / whitespace-only input", () => {
    expect(segmentIntoBlocks("", opts())).toEqual([]);
    expect(segmentIntoBlocks("   \n\n  ", opts())).toEqual([]);
  });

  it("packs plain words up to maxWords with no pause", () => {
    const blocks = segmentIntoBlocks("one two three four", opts({ maxWords: 3 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].words).toEqual(["one", "two", "three"]);
    expect(blocks[0].pauseType).toBeNull();
    expect(blocks[1].words).toEqual(["four"]);
    expect(blocks[1].pauseType).toBeNull();
  });
});

describe("segmentIntoBlocks — sentence-end breaks", () => {
  it("does NOT break at a comma; comma only sets the pause multiplier", () => {
    // maxWords=2 forces the break; the comma is detected as the block's pause.
    const blocks = segmentIntoBlocks("hello, world bye", opts({ maxWords: 2 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ words: ["hello,", "world"], pauseType: "comma" });
    expect(blocks[1]).toEqual({ words: ["bye"], pauseType: null });
  });

  it("breaks at a period and tags the block with period", () => {
    const blocks = segmentIntoBlocks("hi there. bye", opts({ maxWords: 5 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].words).toEqual(["hi", "there."]);
    expect(blocks[0].pauseType).toBe("period");
    expect(blocks[1]).toEqual({ words: ["bye"], pauseType: null });
  });

  it("uses the strongest punctuation inside a multi-word block", () => {
    // Comma does not break; period does. The block carries the stronger pause.
    const blocks = segmentIntoBlocks("hi, there. bye", opts({ maxWords: 5 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ words: ["hi,", "there."], pauseType: "period" });
    expect(blocks[1]).toEqual({ words: ["bye"], pauseType: null });
  });

  it("breaks at question and exclamation marks", () => {
    expect(
      segmentIntoBlocks("really? yes! ok", opts({ maxWords: 5 }))[0].pauseType,
    ).toBe("question");
    expect(
      segmentIntoBlocks("wow! ok", opts({ maxWords: 5 }))[0].pauseType,
    ).toBe("exclamation");
  });

  it("does NOT break at semicolons or colons; they only set the pause", () => {
    // maxWords=2 forces the break; the mark is detected as the block's pause.
    expect(
      segmentIntoBlocks("a; b c", opts({ maxWords: 2 })),
    ).toEqual([
      { words: ["a;", "b"], pauseType: "semicolon" },
      { words: ["c"], pauseType: null },
    ]);
    expect(
      segmentIntoBlocks("a: b c", opts({ maxWords: 2 })),
    ).toEqual([
      { words: ["a:", "b"], pauseType: "colon" },
      { words: ["c"], pauseType: null },
    ]);
  });
});

describe("segmentIntoBlocks — splitOnSentenceEnd disabled", () => {
  it("does NOT break at sentence enders; only at maxWords", () => {
    // With splitOnSentenceEnd=false, the period does not break the block.
    // maxWords=5 is not reached either → single block. Final block pause is
    // nulled, so we only assert the word grouping.
    const blocks = segmentIntoBlocks(
      "hi there. bye now. again",
      opts({ maxWords: 10, splitOnSentenceEnd: false }),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].words).toEqual(["hi", "there.", "bye", "now.", "again"]);
  });

  it("still breaks at maxWords when disabled", () => {
    const blocks = segmentIntoBlocks(
      "one two three four. five",
      opts({ maxWords: 3, splitOnSentenceEnd: false }),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].words).toEqual(["one", "two", "three"]);
    expect(blocks[1].words).toEqual(["four.", "five"]);
    // Block 1 is not the final block → its pause survives.
    expect(blocks[0].pauseType).toBeNull();
  });

  it("still breaks at paragraph boundaries when disabled", () => {
    const blocks = segmentIntoBlocks(
      "first. sentence\n\nsecond one",
      opts({ maxWords: 10, splitOnSentenceEnd: false }),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].pauseType).toBe("paragraph");
    expect(blocks[1].pauseType).toBeNull();
  });

  it("question and exclamation also do not break when disabled", () => {
    // Add a trailing word so the punctuated block is not the final one.
    const blocks = segmentIntoBlocks(
      "really? yes! ok end",
      opts({ maxWords: 10, splitOnSentenceEnd: false }),
    );
    expect(blocks).toHaveLength(1);
    // Final block pause is nulled; verify no break occurred (single block).
    expect(blocks[0].words).toEqual(["really?", "yes!", "ok", "end"]);
  });

  it("defaults to true (current behavior preserved)", () => {
    const blocks = segmentIntoBlocks("hi there. bye", opts({ maxWords: 5 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].pauseType).toBe("period");
  });
});

describe("segmentIntoBlocks — paragraphs", () => {
  it("marks paragraph breaks with the paragraph pause type", () => {
    const blocks = segmentIntoBlocks("first paragraph\n\nsecond one", opts({ maxWords: 5 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].pauseType).toBe("paragraph");
    expect(blocks[1].pauseType).toBeNull(); // final block never pauses
  });

  it("treats a single newline as a soft break, not a paragraph", () => {
    const blocks = segmentIntoBlocks("line one\nline two", opts({ maxWords: 5 }));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].words).toEqual(["line", "one", "line", "two"]);
  });
});

describe("segmentIntoBlocks — diacritics & special characters", () => {
  it("keeps accents and inverted marks by default (any language)", () => {
    const blocks = segmentIntoBlocks("¿Qué tal? Adiós.", opts({ maxWords: 10 }));
    expect(blocks[0].words).toEqual(["¿Qué", "tal?"]);
    expect(blocks[0].pauseType).toBe("question");
    expect(blocks[1].words).toEqual(["Adiós."]);
  });

  it("preserves ñ and accented vowels across a sentence by default", () => {
    const blocks = segmentIntoBlocks("El niño está aquí. Adiós.", opts({ maxWords: 10 }));
    expect(blocks[0].words).toEqual(["El", "niño", "está", "aquí."]);
    expect(blocks[0].pauseType).toBe("period");
    expect(blocks[1].words).toEqual(["Adiós."]);
  });

  it("strips diacritics only when stripDiacritics is set", () => {
    const blocks = segmentIntoBlocks(
      "café résumé",
      opts({ maxWords: 5, stripDiacritics: true }),
    );
    expect(blocks[0].words).toEqual(["cafe", "resume"]);
  });
});

describe("segmentIntoBlocks — minWords soft floor", () => {
  it("merges a trailing under-min block into the previous one when there is room", () => {
    // 4 words, maxWords=3, minWords=2 → first block 3, trailing 1 merges → 3+1=4 > 3, no merge.
    // Use 5 words, maxWords=3, minWords=2 → blocks 3 + 2, no merge needed.
    const blocks = segmentIntoBlocks("a b c d e", opts({ minWords: 2, maxWords: 3 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].words).toHaveLength(3);
    expect(blocks[1].words).toHaveLength(2);
  });

  it("does not merge when it would exceed maxWords", () => {
    // 4 words, maxWords=3, minWords=2 → 3 + 1; merging gives 4 > 3, so kept apart.
    const blocks = segmentIntoBlocks("a b c d", opts({ minWords: 2, maxWords: 3 }));
    expect(blocks).toHaveLength(2);
    expect(blocks[1].words).toHaveLength(1);
  });

  it("does not merge across a sentence boundary", () => {
    // "a. b" → block1 ["a."] (period break), block2 ["b"] (tail, 1 word).
    // minWords=2 but merging would straddle a sentence boundary → kept apart.
    const blocks = segmentIntoBlocks("a. b", opts({ minWords: 2, maxWords: 5 }));
    expect(blocks.map((b) => b.words)).toEqual([["a."], ["b"]]);
  });
});
