import { describe, it, expect } from "vitest";
import { computeBlockDuration } from "./pause";
import type { WordBlock } from "./types";
import { DEFAULT_PAUSE_MULTIPLIERS } from "../db/schemas/userSettings.schema";

const block = (words: string[], pauseType: WordBlock["pauseType"]): WordBlock => ({
  words,
  pauseType,
});

const M = DEFAULT_PAUSE_MULTIPLIERS;

describe("computeBlockDuration — base interval", () => {
  it("derives per-word duration from WPM", () => {
    // 300 WPM → 200ms/word; 600 WPM → 100ms/word.
    const b = block(["hello"], null);
    expect(computeBlockDuration(b, 300, M)).toBe(200);
    expect(computeBlockDuration(b, 600, M)).toBe(100);
  });

  it("scales linearly with word count for multi-word blocks", () => {
    const b = block(["one", "two", "three"], null);
    // 300 WPM → 200ms * 3 words * 1 (no pause) = 600ms.
    expect(computeBlockDuration(b, 300, M)).toBe(600);
  });
});

describe("computeBlockDuration — pause multipliers", () => {
  it("applies no extra delay when pauseType is null", () => {
    const b = block(["word"], null);
    expect(computeBlockDuration(b, 300, M)).toBe(200);
  });

  it("applies each punctuation type's multiplier", () => {
    const w = 300;
    const base = 200;
    expect(computeBlockDuration(block(["end."], "period"), w, M)).toBe(base * M.period);
    expect(computeBlockDuration(block(["hi,"], "comma"), w, M)).toBe(base * M.comma);
    expect(computeBlockDuration(block(["a;"], "semicolon"), w, M)).toBe(base * M.semicolon);
    expect(computeBlockDuration(block(["a:"], "colon"), w, M)).toBe(base * M.colon);
    expect(computeBlockDuration(block(["what?"], "question"), w, M)).toBe(base * M.question);
    expect(computeBlockDuration(block(["wow!"], "exclamation"), w, M)).toBe(base * M.exclamation);
    expect(computeBlockDuration(block(["para"], "paragraph"), w, M)).toBe(base * M.paragraph);
  });

  it("combines word count and pause multiplier", () => {
    // 2 words, period pause, 300 WPM → 200 * 2 * 2.5 = 1000ms.
    const b = block(["hello", "world."], "period");
    expect(computeBlockDuration(b, 300, M)).toBe(1000);
  });
});

describe("computeBlockDuration — edge cases", () => {
  it("clamps WPM to 1 to avoid division by zero", () => {
    const b = block(["word"], null);
    expect(computeBlockDuration(b, 0, M)).toBe(60_000);
  });

  it("treats an empty block as a single word", () => {
    const b = block([], null);
    expect(computeBlockDuration(b, 300, M)).toBe(200);
  });
});
