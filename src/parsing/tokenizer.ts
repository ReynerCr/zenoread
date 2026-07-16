import { INVERTED_MARKS } from "./punctuation";

// Permissive word-char set: letters, combining marks, numbers, apostrophes,
// and Spanish inverted marks.
const WORD_CHARS = /[\p{L}\p{M}\p{N}'’`]/u;

/**
 * Splits a single paragraph string into word tokens.
 *
 * Any character that is a letter, combining mark, number, or apostrophe is
 * kept as part of a token; diacritics and inverted marks pass through
 * untouched. Punctuation that ends a token (.,;:?!) stays attached to the
 * preceding token so the parser can detect it via `detectPunctuation`.
 */
export function tokenize(paragraph: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (const ch of paragraph) {
    if (WORD_CHARS.test(ch) || INVERTED_MARKS.has(ch)) {
      current += ch;
    } else {
      if (current) {
        if (".,;:?!".includes(ch)) {
          current += ch;
        }
        tokens.push(current);
        current = "";
      }
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
