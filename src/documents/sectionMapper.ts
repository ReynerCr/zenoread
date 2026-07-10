import type { WordBlock } from "../parsing/types";
import type { DocumentSection } from "./types";

/**
 * Maps section word offsets to block indices by accumulating block word counts.
 * Returns an array where index i is the block index at which section i starts.
 *
 * Temporary glue. Will be replaced by page-number-based re-streaming when
 * file streaming is implemented.
 *
 * Known limitation: word offsets are computed with a naive whitespace split in
 * PdfParser, but block word counts come from tokenize(). The mismatch causes
 * drift on some PDFs. Empty pages also collapse into the next page's boundary.
 * Both are resolved by streaming (per-page segmentation, exact boundaries).
 */
export function mapSectionsToBlocks(
  blocks: WordBlock[],
  sections: DocumentSection[],
): number[] {
  if (sections.length === 0) return [];

  const result: number[] = [];
  let sectionIdx = 0;
  let cumulativeWords = 0;

  for (let i = 0; i < blocks.length; i++) {
    while (
      sectionIdx < sections.length &&
      cumulativeWords >= sections[sectionIdx].word_offset
    ) {
      result.push(i);
      sectionIdx++;
    }
    cumulativeWords += blocks[i].words.length;
  }

  while (sectionIdx < sections.length) {
    result.push(blocks.length);
    sectionIdx++;
  }

  return result;
}
