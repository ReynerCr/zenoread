import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { loadDocumentFromDialog, loadDocumentFromPath } from "../documents/fileLoader";
import { TxtStreamer } from "../documents/txtStreamer";
import type { ParsedDocument } from "../documents/types";
import { storeToRefs } from "pinia";
import { useDocumentsStore } from "../stores/documents";
import { useProgressStore } from "../stores/progress";
import { useSettingsStore } from "../stores/settings";
import { isTauri } from "../utils/platform";
import { useDragDrop } from "./useDragDrop";
import { usePlayback, type SegmentConfig } from "./usePlayback";

const SAMPLE_TEXT =
  "Welcome to ZenoRead. This is a speed-reading app. " +
  "It uses RSVP to show words quickly. " +
  "Press play to begin, space to pause, and arrows to skip.";

/**
 * Owns document loading and progress persistence for the reading area.
 *
 * Takes the shared `usePlayback` instance so that attach/detach, navigation,
 * and progress saves all act on the same playback state the UI displays.
 * Registers the `beforeunload` save and streamer cleanup with the host
 * component's lifecycle.
 */
export function useDocumentLoader(playback: ReturnType<typeof usePlayback>) {
  const settings = useSettingsStore();
  const documentsStore = useDocumentsStore();
  const { isLoading } = storeToRefs(documentsStore);
  const progressStore = useProgressStore();

  const loadedDocument = shallowRef<ParsedDocument | null>(null);
  const savedDocId = ref<string | null>(null);
  const saveState = ref<"idle" | "saving" | "saved">("idle");
  const dropZoneRef = ref<HTMLElement | null>(null);

  function currentSegmentConfig(): SegmentConfig {
    return {
      minWords: settings.settings.min_words_screen,
      maxWords: settings.settings.max_words_screen,
      splitOnSentenceEnd: settings.settings.split_on_sentence_end,
    };
  }

  function loadSample() {
    loadedDocument.value = null;
    savedDocId.value = null;
    void playback.attachStreamer(
      new TxtStreamer(SAMPLE_TEXT),
      currentSegmentConfig(),
      settings.settings.wpm_default,
      settings.settings.pause_multipliers,
    );
  }

  async function openFile() {
    if (isLoading.value) return;
    documentsStore.setLoading(true);
    // Pause playback while the user picks a file; keep the current document
    // loaded so a cancelled dialog leaves the reader where it was.
    playback.pause();
    try {
      const doc = await loadDocumentFromDialog();
      if (!doc) return;
      await openParsedDocument(doc);
    } finally {
      documentsStore.setLoading(false);
    }
  }

  async function openFromLibrary(docId: string) {
    if (isLoading.value) return;
    documentsStore.setLoading(true);
    playback.pause();
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
      documentsStore.setLoading(false);
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
      documentsStore.setLoading(true);
      playback.pause();
      try {
        await openParsedDocument(doc);
      } finally {
        documentsStore.setLoading(false);
      }
    },
    isLoading,
  );

  // Pause is the shared freeze-and-save path for both Stop and Pause.
  playback.registerPauseSave(saveCurrentProgress);

  // Page turns are save points: persist the position whenever the reader moves
  // to a new section, so progress survives quitting mid-session.
  watch(
    () => playback.currentSection.value,
    () => saveCurrentProgress(),
  );

  // Mirror the reader's live position into the Recent list without a db write,
  // so the open document's completion ticks in step with the reader label.
  watch(
    () => [
      playback.currentSection.value,
      playback.currentIndex.value,
      playback.totalBlocks.value,
      playback.sectionCount.value,
    ],
    () => {
      if (!savedDocId.value) return;
      const totalBlocks = playback.totalBlocks.value;
      if (totalBlocks <= 0) return;
      progressStore.updateCompletionPreview(
        savedDocId.value,
        playback.currentSection.value,
        playback.currentIndex.value,
        playback.sectionCount.value,
        totalBlocks,
      );
    },
  );

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

  function handleBeforeUnload() {
    if (savedDocId.value && playback.state.value !== "stop") {
      saveCurrentProgress();
    }
    void playback.detachStreamer();
  }

  onMounted(() => {
    loadSample();
    window.addEventListener("beforeunload", handleBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    void playback.detachStreamer();
  });

  return {
    loadedDocument,
    savedDocId,
    saveState,
    dropZoneRef,
    isDragOver,
    loadSample,
    openFile,
    openFromLibrary,
    openParsedDocument,
    saveCurrentProgress,
    currentSegmentConfig,
  };
}