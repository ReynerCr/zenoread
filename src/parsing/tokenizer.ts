import { INVERTED_MARKS } from "./punctuation";

// Permissive word-char set: letters, combining marks, numbers, apostrophes,
// and Spanish inverted marks. Used for all languages — diacritics are kept by
// default and only stripped when `stripDiacritics` is explicitly requested.
const WORD_CHARS = /[\p{L}\p{M}\p{N}'’`]/u;

/**
 * Splits a single paragraph string into word tokens.
 *
 * By default any character that is a letter, combining mark, number, or
 * apostrophe is kept as part of a token — diacritics and inverted marks pass
 * through untouched. When `stripDiacritics` is true, the input is NFD-normalized
 * and combining marks are removed before tokenizing (e.g. "café" → "cafe").
 *
 * Punctuation that ends a token (.,;:?!) stays attached to the preceding token
 * so the parser can detect it via `detectPunctuation`.
 */
export function tokenize(
  paragraph: string,
  stripDiacritics = false,
): string[] {
  const source = stripDiacritics ? removeDiacritics(paragraph) : paragraph;

  const tokens: string[] = [];
  let current = "";

  for (const ch of source) {
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

function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}
