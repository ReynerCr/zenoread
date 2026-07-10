import { describe, it, expect } from "vitest";
import { mapSectionsToBlocks } from "./sectionMapper";
import type { WordBlock } from "../parsing/types";
import type { DocumentSection } from "./types";

function blocks(...wordCounts: number[]): WordBlock[] {
  return wordCounts.map((n) => ({ words: Array(n).fill("x"), pauseType: null }));
}

function sections(...offsets: number[]): DocumentSection[] {
  return offsets.map((offset, i) => ({
    label: `Page ${i + 1}`,
    page_number: i + 1,
    word_offset: offset,
  }));
}

describe("mapSectionsToBlocks", () => {
  it("maps each section to the block at its word offset", () => {
    const b = blocks(3, 2, 4);
    const s = sections(0, 3, 5);
    expect(mapSectionsToBlocks(b, s)).toEqual([0, 1, 2]);
  });

  it("handles multiple sections starting at block 0", () => {
    const b = blocks(5, 5);
    const s = sections(0, 0, 5);
    expect(mapSectionsToBlocks(b, s)).toEqual([0, 0, 1]);
  });

  it("maps section beyond total words to the last block index", () => {
    const b = blocks(3, 2);
    const s = sections(0, 10);
    expect(mapSectionsToBlocks(b, s)).toEqual([0, 2]);
  });

  it("returns empty array for no sections", () => {
    expect(mapSectionsToBlocks(blocks(3, 2), [])).toEqual([]);
  });

  it("maps single section at offset 0 to block 0", () => {
    expect(mapSectionsToBlocks(blocks(3, 2, 4), sections(0))).toEqual([0]);
  });
});
