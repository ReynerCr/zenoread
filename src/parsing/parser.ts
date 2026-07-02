import type { ParseOptions, PunctuationType, WordBlock } from "./types";
import { detectPunctuation, stronger } from "./punctuation";
import { tokenize } from "./tokenizer";

const PARAGRAPH_SPLIT = /\n{2,}|\r\n{2,}|\r{2,}/;
const SOFT_LINE_BREAK = /[\n\r]+/;

// Punctuation that forces a block break (sentence enders). Weaker punctuation
// (comma, semicolon, colon) does NOT break a block — it only contributes to the
// pause multiplier when the block ends at maxWords.
const SENTENCE_ENDERS = new Set<PunctuationType>([
  "period",
  "question",
  "exclamation",
]);

/**
 * Segments raw text into display blocks for the RSVP engine.
 *
 * A block ends when `splitOnSentenceEnd` is enabled and a sentence-ending
 * punctuation mark (., ?, !) is appended, when `maxWords` is reached (forced
 * break), or at a paragraph boundary. When `splitOnSentenceEnd` is false,
 * sentence enders behave like weaker punctuation — they do not break a block
 * but still contribute to the pause multiplier via `stronger()`.
 *
 * `minWords` is a soft floor enforced only on the tail block, and never merges
 * across a sentence or paragraph boundary.
 */
export function segmentIntoBlocks(raw: string, options: ParseOptions): WordBlock[] {
  const { minWords, maxWords, stripDiacritics, splitOnSentenceEnd = true } = options;
  if (!raw || !raw.trim()) return [];

  const paragraphs = raw.split(PARAGRAPH_SPLIT);
  const blocks: WordBlock[] = [];

  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    if (!paragraph.trim()) continue;

    // Collapse soft line breaks inside a paragraph into spaces; a lone newline
    // is treated as a soft break, not a paragraph boundary.
    const text = paragraph.replace(SOFT_LINE_BREAK, " ");
    const tokens = tokenize(text, stripDiacritics);

    let current: string[] = [];
    let currentPause: PunctuationType | null = null;

    const flush = (forcePause: PunctuationType | null) => {
      if (current.length === 0) return;
      blocks.push({
        words: current,
        pauseType: stronger(currentPause, forcePause),
      });
      current = [];
      currentPause = null;
    };

    for (const token of tokens) {
      current.push(token);
      const punct = detectPunctuation(token);
      if (punct) currentPause = stronger(currentPause, punct);

      const endsWithSentence =
        splitOnSentenceEnd && punct !== null && SENTENCE_ENDERS.has(punct);
      const reachedMax = current.length >= maxWords;

      if (endsWithSentence || reachedMax) {
        flush(null);
      }
    }

    // End of paragraph: force a paragraph pause on whatever remains.
    const isLastParagraph = p === paragraphs.length - 1;
    flush(isLastParagraph && blocks.length > 0 ? null : "paragraph");
  }

  // The final block has no trailing pause (nothing comes after it).
  if (blocks.length > 0) {
    blocks[blocks.length - 1].pauseType = null;
  }

  // Soft minWords enforcement on the tail only: if the final block is shorter
  // than minWords AND the previous block has no punctuation pause (i.e. it was
  // broken by maxWords, not by a punctuation boundary), merge them. We never
  // merge across a punctuation boundary — that would straddle a pause point and
  // violate the punctuation-bound sizing rule.
  enforceMinWordsTail(blocks, minWords, maxWords);

  return blocks;
}

function enforceMinWordsTail(
  blocks: WordBlock[],
  minWords: number,
  maxWords: number,
): void {
  if (blocks.length < 2) return;
  const last = blocks[blocks.length - 1];
  const prev = blocks[blocks.length - 2];
  if (
    last.words.length < minWords &&
    prev.pauseType === null &&
    prev.words.length + last.words.length <= maxWords
  ) {
    prev.words.push(...last.words);
    blocks.pop();
  }
}
