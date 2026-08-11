import { defineStore } from "pinia";
import { ref } from "vue";

import { getDatabase } from "../db/database";
import type { ReadingProgressDocType } from "../db/schemas/readingProgress.schema";
import { reportError } from "../utils/errors";
import { completionPercentage } from "../utils/progress";
import { t } from "../i18n";

export interface ProgressPosition {
  sectionIndex: number;
  blockIndex: number;
}

/**
 * Manages the reading_progress collection in RxDB: saving and restoring the
 * reader's position within a document.
 */
export const useProgressStore = defineStore("progress", () => {
  const progressByDocId = ref<Record<string, number>>({});
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
        return {
          sectionIndex: progress.section_index,
          blockIndex: progress.block_index_in_section,
        };
      }
      return { sectionIndex: 0, blockIndex: 0 };
    } catch (error) {
      reportError(error, t("errors.progress.load"), { context: "progress.loadProgress" });
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
    const record: ReadingProgressDocType = {
      document_id: documentId,
      section_index: sectionIndex,
      block_index_in_section: clampedBlock,
      last_read_date: now,
      completion_percentage: completionPercentage(sectionIndex, clampedBlock, sectionCount, blocksInSection),
    };
    // Keep in-memory state in sync so the Recent list updates without a reload.
    updateCompletionPreview(documentId, sectionIndex, clampedBlock, sectionCount, blocksInSection);

    try {
      const db = await getDatabase();
      const existing = await db.reading_progress
        .findOne({ selector: { document_id: documentId } })
        .exec();

      if (existing) {
        await existing.patch({
          section_index: record.section_index,
          block_index_in_section: record.block_index_in_section,
          last_read_date: record.last_read_date,
          completion_percentage: record.completion_percentage,
        });
      } else {
        await db.reading_progress.insert({ ...record });
      }
    } catch (error) {
      reportError(error, t("errors.progress.save"), { context: "progress.saveProgress" });
    }
  }

  /**
   * Loads the completion percentage of every document that has a progress
   * record, keyed by document id. Used by the Recent documents list.
   */
  async function loadAllProgress(): Promise<void> {
    try {
      const db = await getDatabase();
      const docs = await db.reading_progress.find().exec();
      // Seed from in-memory values: the open document's live completion is
      // newer than the db snapshot, so the db only fills missing entries.
      const map = { ...progressByDocId.value };
      for (const doc of docs) {
        const progress = doc.toJSON() as ReadingProgressDocType;
        if (!(progress.document_id in map)) {
          map[progress.document_id] = progress.completion_percentage;
        }
      }
      progressByDocId.value = map;
    } catch (error) {
      reportError(error, t("errors.progress.loadAll"), { context: "progress.loadAllProgress" });
    }
  }

  /**
   * In-memory completion for the open document, without a db write. Keeps the
   * Recent list live while the reader advances.
   */
  function updateCompletionPreview(
    documentId: string,
    sectionIndex: number,
    blockIndex: number,
    sectionCount: number,
    blocksInSection: number,
  ): void {
    progressByDocId.value = {
      ...progressByDocId.value,
      [documentId]: completionPercentage(sectionIndex, blockIndex, sectionCount, blocksInSection),
    };
  }

  return {
    progressByDocId,
    loaded,
    init,
    loadProgress,
    loadAllProgress,
    saveProgress,
    updateCompletionPreview,
  };
});
