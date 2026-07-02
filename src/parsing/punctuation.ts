import type { PunctuationType } from "./types";

const PUNCTUATION_CHARS: Record<string, PunctuationType> = {
  ".": "period",
  ",": "comma",
  ";": "semicolon",
  ":": "colon",
  "?": "question",
  "!": "exclamation",
};

// Inverted marks used in Spanish; treated as part of the token by the tokenizer
// but do not themselves trigger a pause (only the closing ? / ! does).
export const INVERTED_MARKS = new Set(["¿", "¡"]);

// Structural rank: stronger punctuation wins when a block contains several.
// paragraph > sentence-enders > clause separators > comma.
const RANK: Record<PunctuationType, number> = {
  paragraph: 4,
  period: 3,
  question: 3,
  exclamation: 3,
  semicolon: 2,
  colon: 2,
  comma: 1,
};

export function rank(p: PunctuationType): number {
  return RANK[p];
}

/**
 * Returns the punctuation type of the *last* character of `word`, or null if it
 * is not a recognized punctuation mark. Inverted marks (¿ ¡) are intentionally
 * ignored here — only the closing mark triggers a pause.
 */
export function detectPunctuation(word: string): PunctuationType | null {
  if (word.length === 0) return null;
  const last = word[word.length - 1];
  return PUNCTUATION_CHARS[last] ?? null;
}

/** Returns the higher-ranked of the two punctuation types (null loses). */
export function stronger(
  a: PunctuationType | null,
  b: PunctuationType | null,
): PunctuationType | null {
  if (a === null) return b;
  if (b === null) return a;
  return rank(a) >= rank(b) ? a : b;
}
