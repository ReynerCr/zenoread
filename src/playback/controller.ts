import type { PauseMultipliers } from "../db/schemas/userSettings.schema";
import type { WordBlock } from "../parsing/types";
import { computeBlockDuration } from "../parsing/pause";

export type PlaybackState = "play" | "pause" | "stop";

export interface PlaybackConfig {
  blocks: WordBlock[];
  wpm: number;
  multipliers: PauseMultipliers;
}

export interface PlaybackEvents {
  onStateChange?: (state: PlaybackState) => void;
  onBlockChange?: (index: number, block: WordBlock) => void;
  onFinish?: () => void;
}

/**
 * State machine + timer loop that drives the RSVP display.
 *
 * States:
 * - `stop`  — not playing, index at 0.
 * - `play`  — actively advancing; a timer is scheduled for the current block.
 * - `pause` — frozen at the current index; no timer running.
 *
 * The controller is framework-agnostic and emits changes via callbacks so a
 * Vue composable (Point 4) can bridge it to reactivity.
 */
export class PlaybackController {
  private blocks: WordBlock[] = [];
  private wpm = 300;
  private multipliers: PauseMultipliers;
  private index = 0;
  private _state: PlaybackState = "stop";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly events: PlaybackEvents;

  constructor(events: PlaybackEvents = {}, multipliers: PauseMultipliers) {
    this.events = events;
    this.multipliers = multipliers;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get currentIndex(): number {
    return this.index;
  }

  get currentBlock(): WordBlock | null {
    return this.blocks[this.index] ?? null;
  }

  get isFinished(): boolean {
    return this.index >= this.blocks.length && this.blocks.length > 0;
  }

  get totalBlocks(): number {
    return this.blocks.length;
  }

  /** Loads (or replaces) the block list and settings, resetting to stop. */
  load(config: PlaybackConfig): void {
    this.stop();
    this.blocks = config.blocks;
    this.wpm = config.wpm;
    this.multipliers = config.multipliers;
    this.index = 0;
  }

  /** Updates WPM and/or multipliers. Affects the next scheduled block. */
  updateSettings(wpm?: number, multipliers?: PauseMultipliers): void {
    if (wpm !== undefined) this.wpm = wpm;
    if (multipliers !== undefined) this.multipliers = multipliers;
  }

  play(): void {
    if (this._state === "play") return;
    if (this.blocks.length === 0) return;

    // Restart from the beginning if we were at the end.
    if (this.index >= this.blocks.length) {
      this.index = 0;
    }

    this.setState("play");
    this.emitBlock();
    this.scheduleCurrent();
  }

  pause(): void {
    if (this._state !== "play") return;
    this.clearTimer();
    this.setState("pause");
  }

  stop(): void {
    this.clearTimer();
    this.index = 0;
    this.setState("stop");
    this.emitBlock();
  }

  next(): void {
    if (this.blocks.length === 0) return;
    if (this.index >= this.blocks.length - 1) {
      this.finish();
      return;
    }
    this.index++;
    this.afterSkip();
  }

  prev(): void {
    if (this.blocks.length === 0) return;
    if (this.index <= 0) return;
    this.index--;
    this.afterSkip();
  }

  seek(target: number): void {
    if (this.blocks.length === 0) return;
    this.index = Math.max(0, Math.min(target, this.blocks.length - 1));
    this.afterSkip();
  }

  // --- internals ---

  private afterSkip(): void {
    this.emitBlock();
    if (this._state === "play") {
      this.clearTimer();
      this.scheduleCurrent();
    }
  }

  private scheduleCurrent(): void {
    const block = this.currentBlock;
    if (!block) return;
    const duration = computeBlockDuration(block, this.wpm, this.multipliers);
    this.timer = setTimeout(() => this.advance(), duration);
  }

  private advance(): void {
    if (this._state !== "play") return;
    if (this.index >= this.blocks.length - 1) {
      this.finish();
      return;
    }
    this.index++;
    this.emitBlock();
    this.scheduleCurrent();
  }

  private finish(): void {
    this.clearTimer();
    this.index = this.blocks.length; // past-end marker
    this.setState("stop");
    this.events.onFinish?.();
  }

  private setState(next: PlaybackState): void {
    if (this._state === next) return;
    this._state = next;
    this.events.onStateChange?.(next);
  }

  private emitBlock(): void {
    const block = this.currentBlock;
    if (block) this.events.onBlockChange?.(this.index, block);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
