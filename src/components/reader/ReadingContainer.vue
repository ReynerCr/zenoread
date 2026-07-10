<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../../stores/settings";
import { usePlayback } from "../../composables/usePlayback";
import { useKeyboardShortcuts } from "../../composables/useKeyboardShortcuts";
import { useDragDrop } from "../../composables/useDragDrop";
import { segmentIntoBlocks } from "../../parsing/parser";
import { loadDocumentFromDialog, loadDocumentFromPath } from "../../documents/fileLoader";
import { mapSectionsToBlocks } from "../../documents/sectionMapper";
import type { ParsedDocument, DocumentSection } from "../../documents/types";
import type { WordBlock } from "../../parsing/types";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { isTauri } from "../../utils/platform";

const settings = useSettingsStore();
const playback = usePlayback();
const documentsStore = useDocumentsStore();
const { isLoading } = storeToRefs(documentsStore);
const progressStore = useProgressStore();
const loadedDocument = ref<ParsedDocument | null>(null);
const savedDocId = ref<string | null>(null);
const saveState = ref<"idle" | "saving" | "saved">("idle");
const dropZoneRef = ref<HTMLElement | null>(null);
const blocksRef = ref<WordBlock[]>([]);

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

const wordStyle = computed(() => ({
  fontSize: `${settings.settings.font_size}px`,
  fontFamily: settings.settings.font_family,
}));

const displayText = computed(() => {
  const block = playback.currentBlock.value;
  if (!block) return "";
  return block.words.join(" ");
});

const hasSections = computed(() => playback.sectionBoundaries.value.length > 0);
const totalPages = computed(() => playback.sectionBoundaries.value.length);
const currentPage = computed(() => playback.currentSection.value + 1);

function countParagraphBreaks(blocks: WordBlock[], start: number, end: number): number {
  let count = 0;
  for (let i = start; i < end; i++) {
    if (blocks[i]?.pauseType === "paragraph") count++;
  }
  return count;
}

const progressLabel = computed(() => {
  if (playback.totalBlocks.value === 0 || blocksRef.value.length === 0) return "";
  const idx = playback.currentIndex.value;
  const blocks = blocksRef.value;

  if (hasSections.value) {
    const page = currentPage.value;
    const pageStart = playback.sectionBoundaries.value[playback.currentSection.value] ?? 0;
    const paragraphInPage = 1 + countParagraphBreaks(blocks, pageStart, idx);
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

function loadText(text: string, startIndex = 0, sections?: DocumentSection[]) {
  const blocks = segmentIntoBlocks(text, {
    language: "en",
    minWords: settings.settings.min_words_screen,
    maxWords: settings.settings.max_words_screen,
    splitOnSentenceEnd: settings.settings.split_on_sentence_end,
  });
  blocksRef.value = blocks;
  playback.load(blocks, settings.settings.wpm_default, settings.settings.pause_multipliers);

  if (sections && sections.length > 0) {
    playback.loadSections(mapSectionsToBlocks(blocks, sections));
  }

  if (startIndex > 0 && startIndex < blocks.length) {
    playback.seek(startIndex);
  }
}

function loadSample() {
  loadedDocument.value = null;
  savedDocId.value = null;
  progressStore.clearProgress();
  loadText(SAMPLE_TEXT);
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
      // Web mode cannot read from disk paths — re-open via file dialog.
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

  let startIndex = 0;
  if (savedDocId.value) {
    startIndex = await progressStore.loadProgress(savedDocId.value);
  }
  loadText(doc.content_raw, startIndex, doc.sections);
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
      playback.currentIndex.value,
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

// Reload when block-sizing or splitting settings change, preserving position.
watch(
  () => [
    settings.settings.min_words_screen,
    settings.settings.max_words_screen,
    settings.settings.split_on_sentence_end,
  ],
  () => {
    if (playback.totalBlocks.value > 0) {
      const currentIndex = playback.currentIndex.value;
      loadText(
          loadedDocument.value?.content_raw ?? SAMPLE_TEXT,
          currentIndex,
          loadedDocument.value?.sections,
        );
    }
  },
);

// Push WPM and pause multiplier changes to the controller without reloading.
watch(
  () => [settings.settings.wpm_default, settings.settings.pause_multipliers] as const,
  ([wpm, multipliers]) => playback.updateSettings(wpm, multipliers),
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
