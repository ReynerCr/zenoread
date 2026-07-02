import type { PauseMultipliers } from "../db/schemas/userSettings.schema";
import type { PunctuationType, WordBlock } from "./types";

const MS_PER_MINUTE = 60_000;

/**
 * Computes how long a block should stay on screen, in milliseconds.
 *
 * `baseInterval = 60000 / wpm` gives the per-word duration at the user's reading
 * speed. Multi-word blocks scale linearly. The pause multiplier for the block's
 * punctuation type extends the duration so the reader gets a cognitive beat at
 * sentence/clause boundaries. A block with no punctuation uses a multiplier of 1.
 *
 * WPM is clamped to a minimum of 1 to avoid division by zero.
 */
export function computeBlockDuration(
  block: WordBlock,
  wpm: number,
  multipliers: PauseMultipliers,
): number {
  const safeWpm = Math.max(1, wpm);
  const baseInterval = MS_PER_MINUTE / safeWpm;
  const wordCount = Math.max(1, block.words.length);
  const multiplier = block.pauseType
    ? multipliers[block.pauseType]
    : 1;
  return baseInterval * wordCount * multiplier;
}

/** Convenience: returns just the multiplier for a punctuation type (1 if null). */
export function pauseMultiplier(
  type: PunctuationType | null,
  multipliers: PauseMultipliers,
): number {
  return type ? multipliers[type] : 1;
}
