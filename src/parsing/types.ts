export type PunctuationType =
  | "period"
  | "comma"
  | "semicolon"
  | "colon"
  | "question"
  | "exclamation"
  | "paragraph";

export interface WordBlock {
  words: string[];
  pauseType: PunctuationType | null;
}

export type SupportedLanguage = "en" | "es";

export interface ParseOptions {
  language: SupportedLanguage;
  minWords: number;
  maxWords: number;
  /** When true, strips combining diacritics (NFD decomposition). Default: false. */
  stripDiacritics?: boolean;
  /**
   * When true (default), sentence-ending punctuation (., ?, !) forces a block
   * break. When false, blocks only break at maxWords or paragraph boundaries;
   * sentence-ending punctuation still contributes to the pause multiplier.
   */
  splitOnSentenceEnd?: boolean;
}
