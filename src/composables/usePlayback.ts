import { ref, shallowRef, onUnmounted } from "vue";
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
  const currentSection = ref(0);
  const sectionCount = ref(0);

  const controller = shallowRef<PlaybackController | null>(null);

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
  }

  function setSection(index: number, count: number): void {
    currentSection.value = index;
    sectionCount.value = count;
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
    currentSection,
    sectionCount,
    load,
    setSection,
    updateSettings,
    play,
    pause,
    stop,
    next,
    prev,
    seek,
  };
}
