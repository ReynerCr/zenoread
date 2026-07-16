import { defineStore } from "pinia";
import { ref } from "vue";

import { getDatabase } from "../db/database";
import type { ReadingProgressDocType } from "../db/schemas/readingProgress.schema";
import { reportError } from "../utils/errors";

export interface ProgressPosition {
  sectionIndex: number;
  blockIndex: number;
}

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
   * Loads the saved progress for a document. Returns the section and block
   * index, or { sectionIndex: 0, blockIndex: 0 } if no progress record exists.
   */
  async function loadProgress(documentId: string): Promise<ProgressPosition> {
    try {
      const db = await getDatabase();
      const doc = await db.reading_progress
        .findOne({ selector: { document_id: documentId } })
        .exec();

      if (doc) {
        const progress = doc.toJSON() as ReadingProgressDocType;
        currentProgress.value = progress;
        return {
          sectionIndex: progress.section_index,
          blockIndex: progress.block_index_in_section,
        };
      }
      currentProgress.value = null;
      return { sectionIndex: 0, blockIndex: 0 };
    } catch (error) {
      reportError(error, "Could not load your reading progress.", { context: "progress.loadProgress" });
      return { sectionIndex: 0, blockIndex: 0 };
    }
  }

  /**
   * Saves the current position for a document. Called on pause, stop, and
   * beforeunload. Creates or updates the progress record.
   */
  async function saveProgress(
    documentId: string,
    sectionIndex: number,
    blockIndex: number,
    sectionCount: number,
    blocksInSection: number,
  ): Promise<void> {
    if (blocksInSection === 0) return;

    const clampedBlock = Math.max(0, Math.min(blockIndex, blocksInSection - 1));
    const now = new Date().toISOString();
    const completion = sectionCount > 0
      ? Math.round(((sectionIndex + clampedBlock / blocksInSection) / sectionCount) * 100)
      : 0;

    try {
      const db = await getDatabase();
      const existing = await db.reading_progress
        .findOne({ selector: { document_id: documentId } })
        .exec();

      if (existing) {
        await existing.patch({
          section_index: sectionIndex,
          block_index_in_section: clampedBlock,
          last_read_date: now,
          completion_percentage: completion,
        });
      } else {
        const newProgress: ReadingProgressDocType = {
          document_id: documentId,
          section_index: sectionIndex,
          block_index_in_section: clampedBlock,
          last_read_date: now,
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
