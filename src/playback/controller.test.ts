import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlaybackController } from "./controller";
import type { WordBlock } from "../parsing/types";
import { DEFAULT_PAUSE_MULTIPLIERS } from "../db/schemas/userSettings.schema";

// Helper: build N plain blocks with no pauses, each 1 word, 300 WPM → 200ms.
const blocks = (n: number): WordBlock[] =>
  Array.from({ length: n }, (_, i) => ({ words: [`w${i}`], pauseType: null }));

// Collect state + block events into arrays for assertion.
function harness(blocks: WordBlock[], wpm = 300) {
  const states: string[] = [];
  const indices: number[] = [];
  const flags = { finished: false };
  const ctrl = new PlaybackController(
    {
      onStateChange: (s) => states.push(s),
      onBlockChange: (i) => indices.push(i),
      onFinish: () => {
        flags.finished = true;
      },
    },
    DEFAULT_PAUSE_MULTIPLIERS,
  );
  ctrl.load({ blocks, wpm, multipliers: DEFAULT_PAUSE_MULTIPLIERS });
  return { ctrl, states, indices, flags };
}

describe("PlaybackController — state transitions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts in stop state with index 0", () => {
    const { ctrl } = harness(blocks(3));
    expect(ctrl.state).toBe("stop");
    expect(ctrl.currentIndex).toBe(0);
  });

  it("play → pause → stop cycle", () => {
    const { ctrl, states } = harness(blocks(3));
    ctrl.play();
    expect(ctrl.state).toBe("play");
    ctrl.pause();
    expect(ctrl.state).toBe("pause");
    ctrl.stop();
    expect(ctrl.state).toBe("stop");
    expect(ctrl.currentIndex).toBe(0);
    expect(states).toEqual(["play", "pause", "stop"]);
  });

  it("pause is a no-op when not playing", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.pause();
    expect(ctrl.state).toBe("stop");
  });

  it("play is a no-op when already playing", () => {
    const { ctrl, states } = harness(blocks(3));
    ctrl.play();
    ctrl.play();
    expect(states.filter((s) => s === "play")).toHaveLength(1);
  });
});

describe("PlaybackController — block advancement", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances through blocks on timer fire", () => {
    const { ctrl, indices } = harness(blocks(3));
    ctrl.play();
    // play() emits block 0 immediately.
    expect(indices).toEqual([0]);
    vi.advanceTimersByTime(200);
    expect(indices).toEqual([0, 1]);
    vi.advanceTimersByTime(200);
    expect(indices).toEqual([0, 1, 2]);
  });

  it("auto-stops and emits onFinish at the end", () => {
    const { ctrl, flags } = harness(blocks(2));
    ctrl.play();
    vi.advanceTimersByTime(200); // → block 1
    vi.advanceTimersByTime(200); // → finish
    expect(ctrl.isFinished).toBe(true);
    expect(flags.finished).toBe(true);
  });

  it("respects block duration from pause multipliers", () => {
    const { ctrl } = harness(
      [{ words: ["end."], pauseType: "period" as const }],
      300,
    );
    ctrl.play();
    // 200ms base * 2.5 (period) = 500ms. Advancing 200ms should NOT advance.
    vi.advanceTimersByTime(200);
    expect(ctrl.currentIndex).toBe(0);
    vi.advanceTimersByTime(300); // total 500ms → finish
    expect(ctrl.isFinished).toBe(true);
  });
});

describe("PlaybackController — skipping", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("next() skips forward and reschedules the timer", () => {
    const { ctrl, indices } = harness(blocks(4));
    ctrl.play();
    expect(indices).toEqual([0]);
    ctrl.next();
    expect(ctrl.currentIndex).toBe(1);
    expect(indices).toEqual([0, 1]);
    // Timer was rescheduled; advancing the old duration should not double-fire.
    vi.advanceTimersByTime(200);
    expect(indices).toEqual([0, 1, 2]);
  });

  it("prev() skips backward", () => {
    const { ctrl } = harness(blocks(4));
    ctrl.play();
    ctrl.next();
    ctrl.next();
    expect(ctrl.currentIndex).toBe(2);
    ctrl.prev();
    expect(ctrl.currentIndex).toBe(1);
  });

  it("prev() at index 0 stays at 0", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.play();
    ctrl.prev();
    expect(ctrl.currentIndex).toBe(0);
  });

  it("next() at last block finishes", () => {
    const { ctrl, flags } = harness(blocks(2));
    ctrl.play();
    ctrl.next();
    expect(ctrl.currentIndex).toBe(1);
    ctrl.next();
    expect(flags.finished).toBe(true);
    expect(ctrl.isFinished).toBe(true);
  });

  it("seek() jumps to a target index", () => {
    const { ctrl } = harness(blocks(5));
    ctrl.play();
    ctrl.seek(3);
    expect(ctrl.currentIndex).toBe(3);
  });

  it("seek() clamps to valid range", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.play();
    ctrl.seek(99);
    expect(ctrl.currentIndex).toBe(2);
    ctrl.seek(-5);
    expect(ctrl.currentIndex).toBe(0);
  });

  it("skipping works while paused", () => {
    const { ctrl } = harness(blocks(4));
    ctrl.play();
    ctrl.pause();
    ctrl.next();
    expect(ctrl.currentIndex).toBe(1);
    expect(ctrl.state).toBe("pause");
  });
});

describe("PlaybackController — restart and edge cases", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("play() after finishing restarts from index 0", () => {
    const { ctrl, indices } = harness(blocks(2));
    ctrl.play();
    vi.advanceTimersByTime(400); // finish
    expect(ctrl.isFinished).toBe(true);
    ctrl.play();
    expect(ctrl.currentIndex).toBe(0);
    expect(indices).toEqual([0, 1, 0]);
  });

  it("play() on empty blocks is a no-op", () => {
    const { ctrl, states } = harness([]);
    ctrl.play();
    expect(ctrl.state).toBe("stop");
    expect(states).toEqual([]);
  });

  it("load() resets to stop with new blocks", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.play();
    ctrl.next();
    ctrl.load({
      blocks: blocks(5),
      wpm: 600,
      multipliers: DEFAULT_PAUSE_MULTIPLIERS,
    });
    expect(ctrl.state).toBe("stop");
    expect(ctrl.currentIndex).toBe(0);
    expect(ctrl.totalBlocks).toBe(5);
  });
});

describe("PlaybackController — settings update during playback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies new WPM to the next scheduled block, not the current one", () => {
    const { ctrl } = harness(blocks(3), 300);
    ctrl.play();
    // Current block scheduled at 300 WPM → 200ms.
    ctrl.updateSettings(600); // 600 WPM → 100ms, but only for next block.
    vi.advanceTimersByTime(200); // old duration fires → advance to block 1.
    expect(ctrl.currentIndex).toBe(1);
    // Now block 1 is scheduled at 600 WPM → 100ms.
    vi.advanceTimersByTime(100);
    expect(ctrl.currentIndex).toBe(2);
  });
});

describe("PlaybackController — onFinish", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires onFinish when timer reaches the last block", () => {
    const onFinish = vi.fn();
    const ctrl = new PlaybackController({ onFinish }, DEFAULT_PAUSE_MULTIPLIERS);
    ctrl.load({ blocks: blocks(2), wpm: 300, multipliers: DEFAULT_PAUSE_MULTIPLIERS });
    ctrl.play();
    vi.advanceTimersByTime(400);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("fires onFinish on next() at last block", () => {
    const onFinish = vi.fn();
    const ctrl = new PlaybackController({ onFinish }, DEFAULT_PAUSE_MULTIPLIERS);
    ctrl.load({ blocks: blocks(2), wpm: 300, multipliers: DEFAULT_PAUSE_MULTIPLIERS });
    ctrl.play();
    ctrl.next();
    ctrl.next();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("does not set state to stop — caller decides", () => {
    const { ctrl } = harness(blocks(2));
    ctrl.play();
    vi.advanceTimersByTime(400);
    expect(ctrl.state).toBe("play");
    expect(ctrl.isFinished).toBe(true);
  });
});

describe("PlaybackController — replaceBlocks", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("swaps blocks and seeks to startIndex while paused", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.play();
    ctrl.pause();
    const newBlocks = blocks(5);
    ctrl.replaceBlocks(newBlocks, 2);
    expect(ctrl.totalBlocks).toBe(5);
    expect(ctrl.currentIndex).toBe(2);
    expect(ctrl.state).toBe("pause");
  });

  it("reschedules timer when playing", () => {
    const { ctrl, indices } = harness(blocks(3));
    ctrl.play();
    expect(indices).toEqual([0]);
    const newBlocks = blocks(3);
    ctrl.replaceBlocks(newBlocks, 1);
    expect(ctrl.currentIndex).toBe(1);
    expect(indices).toEqual([0, 1]);
    vi.advanceTimersByTime(200);
    expect(indices).toEqual([0, 1, 2]);
  });

  it("clamps startIndex to valid range", () => {
    const { ctrl } = harness(blocks(3));
    ctrl.play();
    ctrl.pause();
    ctrl.replaceBlocks(blocks(3), 99);
    expect(ctrl.currentIndex).toBe(2);
    ctrl.replaceBlocks(blocks(3), -5);
    expect(ctrl.currentIndex).toBe(0);
  });
});
