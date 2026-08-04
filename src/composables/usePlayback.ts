import { computed, ref, shallowRef, onUnmounted } from "vue";
import { PlaybackController, type PlaybackState } from "../playback/controller";
import type { WordBlock } from "../parsing/types";
import type { PauseMultipliers } from "../db/schemas/userSettings.schema";
import type { DocumentStreamer } from "../documents/types";
import { segmentIntoBlocks } from "../parsing/parser";

export interface SegmentConfig {
  minWords: number;
  maxWords: number;
  splitOnSentenceEnd: boolean;
}

/**
 * Bridges the framework-agnostic `PlaybackController` to Vue reactivity.
 *
 * Owns section loading, caching, and preloading. The controller drives
 * block-level playback; this composable handles cross-section transitions
 * via `onFinish` and wraps `prev()` for backward section jumps.
 */
export function usePlayback() {
  const state = ref<PlaybackState>("stop");
  const currentIndex = ref(0);
  const currentBlock = ref<WordBlock | null>(null);
  const totalBlocks = ref(0);
  const currentSection = ref(0);
  const sectionCount = ref(0);
  const blocks = ref<WordBlock[]>([]);
  const isEmptySection = computed(() => blocks.value.length === 0);

  const controller = shallowRef<PlaybackController | null>(null);
  const streamer = shallowRef<DocumentStreamer | null>(null);
  const segmentConfig = shallowRef<SegmentConfig | null>(null);
  const wpm = ref(300);
  const multipliers = shallowRef<PauseMultipliers>({
    period: 2.5, comma: 1.5, semicolon: 1.8, colon: 1.8,
    question: 2.5, exclamation: 2.5, paragraph: 3,
  });
  const cache = new Map<number, WordBlock[]>();

  function createController(): PlaybackController {
    return new PlaybackController(
      {
        onStateChange: (s) => { state.value = s; },
        onBlockChange: (i, block) => {
          currentIndex.value = i;
          currentBlock.value = block;
        },
        onFinish: () => { void handleSectionEnd(); },
      },
      multipliers.value,
    );
  }

  async function loadSectionBlocks(sectionIndex: number): Promise<WordBlock[]> {
    const cached = cache.get(sectionIndex);
    if (cached) return cached;
    const s = streamer.value;
    const cfg = segmentConfig.value;
    if (!s || !cfg) return [];
    const text = await s.loadSection(sectionIndex);
    const result = segmentIntoBlocks(text, {
      minWords: cfg.minWords,
      maxWords: cfg.maxWords,
      splitOnSentenceEnd: cfg.splitOnSentenceEnd,
    });
    cache.set(sectionIndex, result);
    return result;
  }

  async function attachStreamer(
    s: DocumentStreamer,
    cfg: SegmentConfig,
    w: number,
    mult: PauseMultipliers,
    startSection = 0,
    startIndex = 0,
  ): Promise<void> {
    if (streamer.value) await streamer.value.close();
    streamer.value = s;
    segmentConfig.value = cfg;
    wpm.value = w;
    multipliers.value = mult;
    cache.clear();
    await loadSection(startSection, startIndex);
  }

  async function detachStreamer(): Promise<void> {
    if (streamer.value) await streamer.value.close();
    streamer.value = null;
    segmentConfig.value = null;
    cache.clear();
    currentSection.value = 0;
    sectionCount.value = 0;
    blocks.value = [];
    controller.value?.halt();
  }

  async function loadSection(sectionIndex: number, startIndex = 0): Promise<void> {
    const s = streamer.value;
    if (!s) return;
    if (sectionIndex < 0 || sectionIndex >= s.sectionCount) return;

    if (!controller.value) controller.value = createController();

    const sectionBlocks = await loadSectionBlocks(sectionIndex);
    blocks.value = sectionBlocks;
    controller.value.load({ blocks: sectionBlocks, wpm: wpm.value, multipliers: multipliers.value });
    state.value = controller.value.state;
    currentIndex.value = controller.value.currentIndex;
    currentBlock.value = controller.value.currentBlock;
    totalBlocks.value = controller.value.totalBlocks;
    currentSection.value = sectionIndex;
    sectionCount.value = s.sectionCount;

    if (startIndex === -1) {
      controller.value.seek(sectionBlocks.length - 1);
    } else if (startIndex > 0 && startIndex < sectionBlocks.length) {
      controller.value.seek(startIndex);
    }

    preloadNext();
  }

  function seekToSection(sectionIndex: number): void {
    void loadSection(sectionIndex);
  }

  function updateSettings(
    w?: number,
    mult?: PauseMultipliers,
    cfg?: SegmentConfig,
  ): void {
    if (w !== undefined) wpm.value = w;
    if (mult !== undefined) multipliers.value = mult;
    controller.value?.updateSettings(w, mult);

    if (cfg && segmentConfig.value) {
      const changed =
        cfg.minWords !== segmentConfig.value.minWords ||
        cfg.maxWords !== segmentConfig.value.maxWords ||
        cfg.splitOnSentenceEnd !== segmentConfig.value.splitOnSentenceEnd;
      if (changed) {
        segmentConfig.value = cfg;
        cache.clear();
        void loadSection(currentSection.value, currentIndex.value);
      }
    }
  }

  async function handleSectionEnd(): Promise<void> {
    const next = currentSection.value + 1;
    if (next >= sectionCount.value) {
      controller.value?.stopAtEnd();
      return;
    }

    const wasPlaying = state.value === "play";
    const cached = cache.get(next);

    if (cached) {
      controller.value?.replaceBlocks(cached, 0);
      blocks.value = cached;
      currentSection.value = next;
      totalBlocks.value = controller.value?.totalBlocks ?? 0;
      if (cached.length === 0) {
        currentBlock.value = null;
        currentIndex.value = 0;
        controller.value?.pause();
      }
      preloadNext();
      return;
    }

    controller.value?.pause();
    const nextBlocks = await loadSectionBlocks(next);
    if (streamer.value === null) return;
    controller.value?.replaceBlocks(nextBlocks, 0);
    blocks.value = nextBlocks;
    currentSection.value = next;
    totalBlocks.value = controller.value?.totalBlocks ?? 0;
    if (nextBlocks.length === 0) {
      currentBlock.value = null;
      currentIndex.value = 0;
    }
    if (wasPlaying && nextBlocks.length > 0) controller.value?.play();
    preloadNext();
  }

  function preloadNext(): void {
    const next = currentSection.value + 1;
    if (next >= sectionCount.value) return;
    if (cache.has(next)) return;
    void loadSectionBlocks(next);
  }

  const pauseSaveHandler = shallowRef<(() => void) | null>(null);

  const play = () => controller.value?.play();

  /** Freezes playback and persists progress. Used by both Stop and Pause. */
  const pause = () => {
    controller.value?.pause();
    pauseSaveHandler.value?.();
  };

  /** Registers the progress-save callback driven by pause(). */
  function registerPauseSave(handler: (() => void) | null) {
    pauseSaveHandler.value = handler;
  }

  function next(): void {
    controller.value?.next();
  }

  function prev(): void {
    if (!controller.value) return;
    if (controller.value.currentIndex <= 0 && currentSection.value > 0) {
      void loadSection(currentSection.value - 1, -1);
    } else {
      controller.value.prev();
    }
  }

  onUnmounted(() => {
    controller.value?.halt();
    if (streamer.value) void streamer.value.close();
  });

  return {
    state,
    currentIndex,
    currentBlock,
    totalBlocks,
    currentSection,
    sectionCount,
    blocks,
    isEmptySection,
    attachStreamer,
    detachStreamer,
    seekToSection,
    updateSettings,
    play,
    pause,
    registerPauseSave,
    next,
    prev,
  };
}
