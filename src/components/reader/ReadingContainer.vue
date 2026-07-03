<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { usePlayback } from "../../composables/usePlayback";
import { useKeyboardShortcuts } from "../../composables/useKeyboardShortcuts";
import { segmentIntoBlocks } from "../../parsing/parser";
import { loadDocumentFromDialog, loadDocumentFromPath } from "../../documents/fileLoader";
import type { ParsedDocument } from "../../documents/types";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { isTauri } from "../../utils/platform";

const settings = useSettingsStore();
const playback = usePlayback();
const documentsStore = useDocumentsStore();
const progressStore = useProgressStore();
const loadedDocument = ref<ParsedDocument | null>(null);
const savedDocId = ref<string | null>(null);
const saveState = ref<"idle" | "saving" | "saved">("idle");

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

const progressLabel = computed(() => {
  if (playback.totalBlocks.value === 0) return "";
  return `${playback.currentIndex.value + 1} / ${playback.totalBlocks.value}`;
});

const isPlaying = computed(() => playback.state.value === "play");
const isPaused = computed(() => playback.state.value === "pause");
const hasDocument = computed(() => loadedDocument.value !== null);

function loadText(text: string, startIndex = 0) {
  const blocks = segmentIntoBlocks(text, {
    language: "en",
    minWords: settings.settings.min_words_screen,
    maxWords: settings.settings.max_words_screen,
    splitOnSentenceEnd: settings.settings.split_on_sentence_end,
  });
  playback.load(blocks, settings.settings.wpm_default, settings.settings.pause_multipliers);
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
  const doc = await loadDocumentFromDialog();
  if (!doc) return;
  await openParsedDocument(doc);
}

async function openFromLibrary(docId: string) {
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
}

async function openParsedDocument(doc: ParsedDocument) {
  loadedDocument.value = doc;
  const saved = await documentsStore.saveDocument(doc);
  savedDocId.value = saved?.id ?? null;

  let startIndex = 0;
  if (savedDocId.value) {
    startIndex = await progressStore.loadProgress(savedDocId.value);
  }
  loadText(doc.content_raw, startIndex);
}

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
      loadText(loadedDocument.value?.content_raw ?? SAMPLE_TEXT, currentIndex);
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
    class="flex h-full w-full flex-col items-center justify-center bg-zeno-bg px-8"
    aria-label="Reading area"
    :data-save-state="saveState"
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

    <!-- Document title + progress + controls -->
    <div class="flex flex-col items-center gap-3 pb-6">
      <div class="flex items-center gap-3">
        <span v-if="hasDocument" class="max-w-xs truncate text-xs text-zeno-muted">
          {{ loadedDocument?.title }}
        </span>
        <button
          class="rounded-md border border-zeno-border px-3 py-1 text-xs text-zeno-muted hover:text-zeno-text"
          aria-label="Open file"
          @click="openFile"
        >
          Open file
        </button>
      </div>

      <span v-if="progressLabel" data-testid="progress" class="text-xs text-zeno-muted tabular-nums">
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
