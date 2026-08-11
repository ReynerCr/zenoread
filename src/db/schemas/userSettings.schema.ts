import type { RxJsonSchema } from "rxdb";

/**
 * Multipliers applied to the base word duration when a word ends with a given
 * punctuation type. A multiplier of 1 means no extra pause. These are
 * user-configurable so readers can tune the rhythm of the RSVP stream.
 */
export interface PauseMultipliers {
  period: number;
  comma: number;
  semicolon: number;
  colon: number;
  question: number;
  exclamation: number;
  paragraph: number;
}

export type ThemeName = "light" | "dark";

export type LanguageName = "en" | "es";

export interface UserSettingsDocType {
  /** Singleton primary key. Always `SETTINGS_SINGLETON_ID`. */
  id: string;
  wpm_default: number;
  max_words_screen: number;
  min_words_screen: number;
  theme: ThemeName;
  pause_multipliers: PauseMultipliers;
  font_size: number;
  font_family: string;
  /** When true, sentence-ending punctuation (., ?, !) forces a block break. */
  split_on_sentence_end: boolean;
  /** When true, shows the block counter alongside the page/paragraph indicator. */
  show_block_counter: boolean;
  /** UI language (English / Spanish). */
  language: LanguageName;
}

/** There is only ever one settings document; this is its fixed primary key. */
export const SETTINGS_SINGLETON_ID = "user-settings";

export const DEFAULT_PAUSE_MULTIPLIERS: PauseMultipliers = {
  period: 2.5,
  comma: 1.5,
  semicolon: 1.8,
  colon: 1.8,
  question: 2.5,
  exclamation: 2.5,
  paragraph: 3,
};

export const DEFAULT_USER_SETTINGS: UserSettingsDocType = {
  id: SETTINGS_SINGLETON_ID,
  wpm_default: 300,
  max_words_screen: 3,
  min_words_screen: 1,
  theme: "dark",
  pause_multipliers: { ...DEFAULT_PAUSE_MULTIPLIERS },
  font_size: 48,
  font_family: "system-ui",
  split_on_sentence_end: true,
  show_block_counter: false,
  language: "en",
};

export const userSettingsSchema: RxJsonSchema<UserSettingsDocType> = {
  title: "user settings schema",
  version: 3,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 32 },
    wpm_default: { type: "number", minimum: 1, maximum: 2000, multipleOf: 1 },
    max_words_screen: { type: "number", minimum: 1, maximum: 20, multipleOf: 1 },
    min_words_screen: { type: "number", minimum: 1, maximum: 20, multipleOf: 1 },
    theme: { type: "string", enum: ["light", "dark"] },
    pause_multipliers: {
      type: "object",
      properties: {
        period: { type: "number" },
        comma: { type: "number" },
        semicolon: { type: "number" },
        colon: { type: "number" },
        question: { type: "number" },
        exclamation: { type: "number" },
        paragraph: { type: "number" },
      },
      required: [
        "period",
        "comma",
        "semicolon",
        "colon",
        "question",
        "exclamation",
        "paragraph",
      ],
    },
    font_size: { type: "number", minimum: 8, maximum: 200, multipleOf: 1 },
    font_family: { type: "string", maxLength: 100 },
    split_on_sentence_end: { type: "boolean" },
    show_block_counter: { type: "boolean" },
    language: { type: "string", maxLength: 16, enum: ["en", "es"] },
  },
  required: [
    "id",
    "wpm_default",
    "max_words_screen",
    "min_words_screen",
    "theme",
    "pause_multipliers",
    "font_size",
    "font_family",
    "split_on_sentence_end",
    "show_block_counter",
    "language",
  ],
};
