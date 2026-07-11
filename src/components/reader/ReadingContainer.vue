<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../../stores/settings";
import { usePlayback, type SegmentConfig } from "../../composables/usePlayback";
import { useKeyboardShortcuts } from "../../composables/useKeyboardShortcuts";
import { useDragDrop } from "../../composables/useDragDrop";
import { loadDocumentFromDialog, loadDocumentFromPath } from "../../documents/fileLoader";
import { TxtStreamer } from "../../documents/txtStreamer";
import type { ParsedDocument } from "../../documents/types";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { isTauri } from "../../utils/platform";

const settings = useSettingsStore();
const playback = usePlayback();
const documentsStore = useDocumentsStore();
const { isLoading } = storeToRefs(documentsStore);
const progressStore = useProgressStore();
const loadedDocument = shallowRef<ParsedDocument | null>(null);
const savedDocId = ref<string | null>(null);
const saveState = ref<"idle" | "saving" | "saved">("idle");
const dropZoneRef = ref<HTMLElement | null>(null);

useKeyboardShortcuts({
  onTogglePlayPause: togglePlayPause,
  onNext: () => playback.next(),
  onPrev: () => playback.prev(),
  onStop: stopAndSave,
});

const SAMPLE_TEXT =
  "Welcome to ZenoRead. This is a speed-reading app. " +
  "It uses RSVP to show words quickly. " +
  "Press play to begin, space to pause, and arrows to skip.";

function currentSegmentConfig(): SegmentConfig {
  return {
    language: "en" as const,
    minWords: settings.settings.min_words_screen,
    maxWords: settings.settings.max_words_screen,
    splitOnSentenceEnd: settings.settings.split_on_sentence_end,
  };
}

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

  if (hasSections.value) {
    const page = currentPage.value;
    const paragraphInPage = 1 + countParagraphBreaks(blocks, 0, idx);
    return `Page ${page} · ¶ ${paragraphInPage}`;
  }

  const currentParagraph = 1 + countParagraphBreaks(blocks, 0, idx);
  const totalParagraphs = 1 + blocks.filter((b) => b.pauseType === "paragraph").length;
  return `¶ ${currentParagraph} / ${totalParagraphs}`;
});

const blockCounterLabel = computed(() => {
  if (playback.totalBlocks.value === 0) return "";
  return `block ${playback.currentIndex.value + 1} / ${playback.totalBlocks.value}`;
});

const isPlaying = computed(() => playback.state.value === "play");
const isPaused = computed(() => playback.state.value === "pause");
const hasDocument = computed(() => loadedDocument.value !== null);
const isEmptyPage = computed(() => playback.isEmptySection.value && hasSections.value);
const emptyPageLabel = computed(() => `Page ${currentPage.value} has no text content`);

function loadSample() {
  loadedDocument.value = null;
  savedDocId.value = null;
  progressStore.clearProgress();
  void playback.attachStreamer(
    new TxtStreamer(SAMPLE_TEXT),
    currentSegmentConfig(),
    settings.settings.wpm_default,
    settings.settings.pause_multipliers,
  );
}

async function openFile() {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const doc = await loadDocumentFromDialog();
    if (!doc) return;
    await openParsedDocument(doc);
  } finally {
    isLoading.value = false;
  }
}

async function openFromLibrary(docId: string) {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const meta = await documentsStore.getDocument(docId);
    if (!meta) return;

    if (isTauri()) {
      const doc = await loadDocumentFromPath(meta.file_path, meta.file_type, meta.language);
      if (!doc) return;
      await openParsedDocument(doc);
    } else {
      await openFile();
    }
  } finally {
    isLoading.value = false;
  }
}

async function openParsedDocument(doc: ParsedDocument) {
  loadedDocument.value = doc;
  const saved = await documentsStore.saveDocument(doc);
  savedDocId.value = saved?.id ?? null;

  let startSection = 0;
  let startIndex = 0;
  if (savedDocId.value) {
    const pos = await progressStore.loadProgress(savedDocId.value);
    startSection = pos.sectionIndex;
    startIndex = pos.blockIndex;
  }

  await playback.attachStreamer(
    doc.streamer,
    currentSegmentConfig(),
    settings.settings.wpm_default,
    settings.settings.pause_multipliers,
    startSection,
    startIndex,
  );
}

const { isDragOver } = useDragDrop(
  dropZoneRef,
  async (doc) => {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      await openParsedDocument(doc);
    } finally {
      isLoading.value = false;
    }
  },
  isLoading,
);

function togglePlayPause() {
  if (isPlaying.value) {
    playback.pause();
    saveCurrentProgress();
  } else {
    playback.play();
  }
}

function saveCurrentProgress() {
  if (!savedDocId.value) return;
  saveState.value = "saving";
  void progressStore
    .saveProgress(
      savedDocId.value,
      playback.currentSection.value,
      playback.currentIndex.value,
      playback.sectionCount.value,
      playback.totalBlocks.value,
    )
    .then(() => {
      saveState.value = "saved";
    })
    .catch(() => {
      saveState.value = "idle";
    });
}

function stopAndSave() {
  saveCurrentProgress();
  playback.stop();
}

function prevPage() {
  playback.seekToSection(playback.currentSection.value - 1);
}

function nextPage() {
  playback.seekToSection(playback.currentSection.value + 1);
}

function onPageInput(event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value, 10);
  if (!isNaN(value) && value >= 1 && value <= totalPages.value) {
    playback.seekToSection(value - 1);
  }
}

function handleBeforeUnload() {
  if (savedDocId.value && playback.state.value !== "stop") {
    saveCurrentProgress();
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

function handleOpenRecent(event: Event) {
  const detail = (event as CustomEvent).detail;
  if (detail?.docId) void openFromLibrary(detail.docId);
}

onMounted(() => {
  loadSample();
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("zenoread:open-recent", handleOpenRecent);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("zenoread:open-recent", handleOpenRecent);
  void playback.detachStreamer();
});
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

      <!-- Page navigation (PDF only) -->
      <div v-if="hasSections" class="flex items-center gap-1" data-testid="page-nav">
        <button
          class="rounded-md border border-zeno-border px-2 py-1 text-xs text-zeno-text hover:bg-zeno-surface disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
          :disabled="currentPage <= 1"
          @click="prevPage"
        >
          ◀
        </button>
        <input
          type="number"
          :min="1"
          :max="totalPages"
          :value="currentPage"
          class="w-12 rounded-md border border-zeno-border bg-zeno-bg px-2 py-1 text-center text-xs text-zeno-text tabular-nums"
          aria-label="Page number"
          @change="onPageInput"
        />
        <span class="text-xs text-zeno-muted tabular-nums">/ {{ totalPages }}</span>
        <button
          class="rounded-md border border-zeno-border px-2 py-1 text-xs text-zeno-text hover:bg-zeno-surface disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
          :disabled="currentPage >= totalPages"
          @click="nextPage"
        >
          ▶
        </button>
      </div>

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
          @click="stopAndSave"
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
