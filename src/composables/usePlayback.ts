import { ref, shallowRef, computed, onUnmounted } from "vue";
import { PlaybackController, type PlaybackState } from "../playback/controller";
import type { WordBlock } from "../parsing/types";
import type { PauseMultipliers } from "../db/schemas/userSettings.schema";

/**
 * Bridges the framework-agnostic `PlaybackController` to Vue reactivity.
 *
 * Controller callbacks update refs so components can render reactively. The
 * controller instance itself is kept in a shallowRef (it's a class, not plain
 * data) and is disposed on unmount to cancel any pending timer.
 */
export function usePlayback() {
  const state = ref<PlaybackState>("stop");
  const currentIndex = ref(0);
  const currentBlock = ref<WordBlock | null>(null);
  const isFinished = ref(false);
  const totalBlocks = ref(0);
  const sectionBoundaries = ref<number[]>([]);

  const controller = shallowRef<PlaybackController | null>(null);

  // currentSection returns the last boundary at or before currentIndex.
  // When two sections share the same block index (e.g. an empty page and the
  // next page with content), the later section wins, making the empty page
  // invisible. Resolved by file streaming (per-page segmentation).
  const currentSection = computed(() => {
    if (sectionBoundaries.value.length === 0) return -1;
    let section = 0;
    for (let i = 0; i < sectionBoundaries.value.length; i++) {
      if (sectionBoundaries.value[i] <= currentIndex.value) {
        section = i;
      } else {
        break;
      }
    }
    return section;
  });

  function createController(multipliers: PauseMultipliers): PlaybackController {
    return new PlaybackController(
      {
        onStateChange: (s) => {
          state.value = s;
        },
        onBlockChange: (i, block) => {
          currentIndex.value = i;
          currentBlock.value = block;
        },
        onFinish: () => {
          isFinished.value = true;
        },
      },
      multipliers,
    );
  }

  function load(
    blocks: WordBlock[],
    wpm: number,
    multipliers: PauseMultipliers,
  ): void {
    if (!controller.value) {
      controller.value = createController(multipliers);
    }
    controller.value.load({ blocks, wpm, multipliers });
    state.value = controller.value.state;
    currentIndex.value = controller.value.currentIndex;
    currentBlock.value = controller.value.currentBlock;
    isFinished.value = false;
    totalBlocks.value = controller.value.totalBlocks;
    sectionBoundaries.value = [];
  }

  function loadSections(boundaries: number[]): void {
    sectionBoundaries.value = boundaries;
  }

  function seekToSection(sectionIndex: number): void {
    if (sectionIndex < 0 || sectionIndex >= sectionBoundaries.value.length) return;
    controller.value?.seek(sectionBoundaries.value[sectionIndex]);
  }

  function updateSettings(wpm?: number, multipliers?: PauseMultipliers): void {
    controller.value?.updateSettings(wpm, multipliers);
  }

  const play = () => controller.value?.play();
  const pause = () => controller.value?.pause();
  const stop = () => controller.value?.stop();
  const next = () => controller.value?.next();
  const prev = () => controller.value?.prev();
  const seek = (i: number) => controller.value?.seek(i);

  onUnmounted(() => {
    controller.value?.stop();
  });

  return {
    state,
    currentIndex,
    currentBlock,
    isFinished,
    totalBlocks,
    sectionBoundaries,
    currentSection,
    load,
    loadSections,
    seekToSection,
    updateSettings,
    play,
    pause,
    stop,
    next,
    prev,
    seek,
  };
}
