import { defineStore } from "pinia";
import { ref } from "vue";

import { getDatabase } from "../db/database";
import type { ReadingProgressDocType } from "../db/schemas/readingProgress.schema";
import { reportError } from "../utils/errors";

/**
 * Manages the reading_progress collection in RxDB: saving and restoring the
 * reader's position within a document.
 */
export const useProgressStore = defineStore("progress", () => {
  const currentProgress = ref<ReadingProgressDocType | null>(null);
  const loaded = ref(false);

  async function init(): Promise<void> {
    if (loaded.value) return;
    loaded.value = true;
  }

  /**
   * Loads the saved progress for a document. Returns the `last_word_index` or
   * 0 if no progress record exists.
   */
  async function loadProgress(documentId: string): Promise<number> {
    try {
      const db = await getDatabase();
      const doc = await db.reading_progress
        .findOne({ selector: { document_id: documentId } })
        .exec();

      if (doc) {
        const progress = doc.toJSON() as ReadingProgressDocType;
        currentProgress.value = progress;
        return progress.last_word_index;
      }
      currentProgress.value = null;
      return 0;
    } catch (error) {
      reportError(error, "Could not load your reading progress.", { context: "progress.loadProgress" });
      return 0;
    }
  }

  /**
   * Saves the current position for a document. Called on pause, stop, and
   * beforeunload. Creates or updates the progress record.
   */
  async function saveProgress(
    documentId: string,
    lastWordIndex: number,
    totalBlocks: number,
  ): Promise<void> {
    if (totalBlocks === 0) return;

    const clampedIndex = Math.max(0, Math.min(lastWordIndex, totalBlocks - 1));
    const now = new Date().toISOString();
    const completion = Math.round((clampedIndex / totalBlocks) * 100);

    try {
      const db = await getDatabase();
      const existing = await db.reading_progress
        .findOne({ selector: { document_id: documentId } })
        .exec();

      if (existing) {
        await existing.patch({
          last_word_index: clampedIndex,
          last_read_date: now,
          completion_percentage: completion,
        });
      } else {
        const newProgress: ReadingProgressDocType = {
          document_id: documentId,
          last_word_index: clampedIndex,
          last_read_date: now,
          reading_time_total: 0,
          completion_percentage: completion,
        };
        await db.reading_progress.insert(newProgress);
        currentProgress.value = newProgress;
      }
    } catch (error) {
      reportError(error, "Could not save your reading progress.", { context: "progress.saveProgress" });
    }
  }

  /** Clears the current progress ref (e.g. when switching documents). */
  function clearProgress(): void {
    currentProgress.value = null;
  }

  return {
    currentProgress,
    loaded,
    init,
    loadProgress,
    saveProgress,
    clearProgress,
  };
});
