<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { usePlayback } from "../../composables/usePlayback";
import { useKeyboardShortcuts } from "../../composables/useKeyboardShortcuts";
import { segmentIntoBlocks } from "../../parsing/parser";

const settings = useSettingsStore();
const playback = usePlayback();

useKeyboardShortcuts({
  onTogglePlayPause: togglePlayPause,
  onNext: () => playback.next(),
  onPrev: () => playback.prev(),
  onStop: () => playback.stop(),
});

// Phase 3 will replace this with loaded documents. For now a sample text
// exercises the full parser → controller → renderer pipeline.
const SAMPLE_TEXT =
  "Welcome to ZenoRead. This is a speed-reading app. " +
  "It uses RSVP to show words quickly. " +
  "Press play to begin, space to pause, and arrows to skip.";

const wordStyle = computed(() => ({
  fontSize: `${settings.settings.font_size}px`,
  fontFamily: settings.settings.font_family,
}));

const displayText = computed(() => {
  const block = playback.currentBlock.value;
  if (!block) return "";
  return block.words.join(" ");
});

const progressLabel = computed(() => {
  if (playback.totalBlocks.value === 0) return "";
  return `${playback.currentIndex.value + 1} / ${playback.totalBlocks.value}`;
});

const isPlaying = computed(() => playback.state.value === "play");
const isPaused = computed(() => playback.state.value === "pause");

function loadSample() {
  const blocks = segmentIntoBlocks(SAMPLE_TEXT, {
    language: "en",
    minWords: settings.settings.min_words_screen,
    maxWords: settings.settings.max_words_screen,
    splitOnSentenceEnd: settings.settings.split_on_sentence_end,
  });
  playback.load(blocks, settings.settings.wpm_default, settings.settings.pause_multipliers);
}

function togglePlayPause() {
  if (isPlaying.value) playback.pause();
  else playback.play();
}

// Reload when block-sizing or splitting settings change.
watch(
  () => [
    settings.settings.min_words_screen,
    settings.settings.max_words_screen,
    settings.settings.split_on_sentence_end,
  ],
  () => {
    if (playback.totalBlocks.value > 0) loadSample();
  },
);

// Push WPM and pause multiplier changes to the controller without reloading.
watch(
  () => [settings.settings.wpm_default, settings.settings.pause_multipliers] as const,
  ([wpm, multipliers]) => playback.updateSettings(wpm, multipliers),
);

onMounted(() => {
  loadSample();
});
</script>

<template>
  <section
    class="flex h-full w-full flex-col items-center justify-center bg-zeno-bg px-8"
    aria-label="Reading area"
  >
    <!-- Centered word display -->
    <div class="flex flex-1 items-center justify-center">
      <p
        v-if="displayText"
        class="font-semibold tracking-wide text-zeno-text select-none text-center"
        :style="wordStyle"
      >
        {{ displayText }}
      </p>
      <p v-else class="text-sm text-zeno-muted">
        Load a document to start reading.
      </p>
    </div>

    <!-- Progress + controls -->
    <div class="flex flex-col items-center gap-3 pb-6">
      <span v-if="progressLabel" class="text-xs text-zeno-muted tabular-nums">
        {{ progressLabel }}
      </span>
      <div class="flex items-center gap-2">
        <button
          class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
          aria-label="Previous block"
          @click="playback.prev()"
        >
          ◀
        </button>
        <button
          class="rounded-md border border-zeno-border px-4 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayPause"
        >
          {{ isPlaying ? "Pause" : isPaused ? "Resume" : "Play" }}
        </button>
        <button
          class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
          aria-label="Stop"
          @click="playback.stop()"
        >
          Stop
        </button>
        <button
          class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
          aria-label="Next block"
          @click="playback.next()"
        >
          ▶
        </button>
      </div>
    </div>
  </section>
</template>
