<script setup lang="ts">
import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useDocumentsStore } from "../../stores/documents";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentLoader } from "../../composables/useDocumentLoader";
import { useKeyboardShortcuts } from "../../composables/useKeyboardShortcuts";
import { usePlayback } from "../../composables/usePlayback";
import PlaybackControls from "./PlaybackControls.vue";
import { completionPercentage } from "../../utils/progress";

const settings = useSettingsStore();
const playback = usePlayback();
const documentsStore = useDocumentsStore();
const { isLoading } = storeToRefs(documentsStore);

const {
  loadedDocument,
  saveState,
  dropZoneRef,
  isDragOver,
  openFile,
  openFromLibrary,
  currentSegmentConfig,
} = useDocumentLoader(playback);

useKeyboardShortcuts({
  onTogglePlayPause: togglePlayPause,
  onNext: () => playback.next(),
  onPrev: () => playback.prev(),
  onStop: () => playback.pause(),
});

const wordStyle = computed(() => ({
  fontSize: `${settings.settings.font_size}px`,
  fontFamily: settings.settings.font_family,
}));

const displayText = computed(() => {
  const block = playback.currentBlock.value;
  if (!block) return "";
  return block.words.join(" ");
});

const hasSections = computed(() => playback.sectionCount.value > 1);
const totalPages = computed(() => playback.sectionCount.value);
const currentPage = computed(() => playback.currentSection.value + 1);

function countParagraphBreaks(blocks: { pauseType: string | null }[], start: number, end: number): number {
  let count = 0;
  for (let i = start; i < end; i++) {
    if (blocks[i]?.pauseType === "paragraph") count++;
  }
  return count;
}

const progressLabel = computed(() => {
  if (playback.blocks.value.length === 0) {
    if (hasSections.value) return `Page ${currentPage.value} · no text`;
    return "";
  }
  const idx = playback.currentIndex.value;
  const blocks = playback.blocks.value;
  const suffix = completionLabel.value ? ` · ${completionLabel.value}` : "";

  if (hasSections.value) {
    const page = currentPage.value;
    const paragraphInPage = 1 + countParagraphBreaks(blocks, 0, idx);
    return `Page ${page} · ¶ ${paragraphInPage}${suffix}`;
  }

  const currentParagraph = 1 + countParagraphBreaks(blocks, 0, idx);
  const totalParagraphs = 1 + blocks.filter((b) => b.pauseType === "paragraph").length;
  return `¶ ${currentParagraph} / ${totalParagraphs}${suffix}`;
});

const blockCounterLabel = computed(() => {
  if (playback.totalBlocks.value === 0) return "";
  return `block ${playback.currentIndex.value + 1} / ${playback.totalBlocks.value}`;
});

const completionLabel = computed(() => {
  if (playback.sectionCount.value <= 0 || playback.totalBlocks.value <= 0) return "";
  return `${completionPercentage(
    playback.currentSection.value,
    playback.currentIndex.value,
    playback.sectionCount.value,
    playback.totalBlocks.value,
  )}%`;
});

const isPlaying = computed(() => playback.state.value === "play");
const isPaused = computed(() => playback.state.value === "pause");
const hasDocument = computed(() => loadedDocument.value !== null);
const isEmptyPage = computed(() => playback.isEmptySection.value && hasSections.value);
const emptyPageLabel = computed(() => `Page ${currentPage.value} has no text content`);

function togglePlayPause() {
  if (isPlaying.value) {
    playback.pause();
  } else {
    playback.play();
  }
}

function prevPage() {
  playback.seekToSection(playback.currentSection.value - 1);
}

function nextPage() {
  playback.seekToSection(playback.currentSection.value + 1);
}

function onPageInput(value: string) {
  const parsed = parseInt(value, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages.value) {
    playback.seekToSection(parsed - 1);
  }
}

watch(
  () => [
    settings.settings.min_words_screen,
    settings.settings.max_words_screen,
    settings.settings.split_on_sentence_end,
    settings.settings.wpm_default,
    settings.settings.pause_multipliers,
  ],
  () => {
    playback.updateSettings(
      settings.settings.wpm_default,
      settings.settings.pause_multipliers,
      currentSegmentConfig(),
    );
  },
);

defineExpose({ openFromLibrary });
</script>

<template>
  <section
    ref="dropZoneRef"
    class="flex h-full w-full flex-col items-center justify-center bg-zeno-bg px-8 relative"
    aria-label="Reading area"
    :data-save-state="saveState"
  >
    <!-- Drag-and-drop overlay -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 z-10 flex items-center justify-center bg-zeno-accent/10 border-2 border-dashed border-zeno-accent rounded-lg"
      data-testid="drop-overlay"
    >
      <span class="text-sm font-medium text-zeno-accent">Drop file to open</span>
    </div>

    <!-- Centered word display -->
    <div class="flex flex-1 items-center justify-center">
      <div v-if="isLoading" data-testid="loading-indicator" class="flex flex-col items-center gap-2">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-zeno-border border-t-zeno-accent"></div>
        <span class="text-sm text-zeno-muted">Loading...</span>
      </div>
      <p
        v-else-if="displayText"
        class="font-semibold tracking-wide text-zeno-text select-none text-center"
        :style="wordStyle"
      >
        {{ displayText }}
      </p>
      <p
        v-else-if="isEmptyPage"
        data-testid="empty-page"
        class="text-sm text-zeno-muted text-center"
      >
        {{ emptyPageLabel }}
      </p>
      <p v-else class="text-sm text-zeno-muted">
        Load a document to start reading.
      </p>
    </div>

    <!-- Document title + progress + controls -->
    <div class="flex flex-col items-center gap-3 pb-6">
      <div class="flex items-center gap-3">
        <span v-if="hasDocument" class="max-w-xs truncate text-xs text-zeno-muted">
          {{ loadedDocument?.title }}
        </span>
        <button
          class="rounded-md border border-zeno-border px-3 py-1 text-xs text-zeno-muted hover:text-zeno-text disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Open file"
          :disabled="isLoading"
          @click="openFile"
        >
          Open file
        </button>
      </div>

      <span v-if="progressLabel" data-testid="progress" class="text-xs text-zeno-muted tabular-nums">
        {{ progressLabel }}
      </span>
      <span
        v-if="settings.settings.show_block_counter && blockCounterLabel"
        data-testid="block-counter"
        class="text-xs text-zeno-muted/60 tabular-nums"
      >
        {{ blockCounterLabel }}
      </span>

      <PlaybackControls
        :is-playing="isPlaying"
        :is-paused="isPaused"
        :has-sections="hasSections"
        :current-page="currentPage"
        :total-pages="totalPages"
        @toggle-play-pause="togglePlayPause"
        @stop="playback.pause()"
        @next-block="playback.next()"
        @prev-block="playback.prev()"
        @prev-page="prevPage"
        @next-page="nextPage"
        @page-input="onPageInput"
      />
    </div>
  </section>
</template>
