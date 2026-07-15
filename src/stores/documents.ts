import { defineStore } from "pinia";
import { ref } from "vue";

import { getDatabase } from "../db/database";
import type { DocumentDocType } from "../db/schemas/documents.schema";
import type { ParsedDocument } from "../documents/types";
import { reportError } from "../utils/errors";

/**
 * Manages the documents collection in RxDB: persisting loaded files, listing
 * them, and tracking the currently open document.
 */
export const useDocumentsStore = defineStore("documents", () => {
  const documents = ref<DocumentDocType[]>([]);
  const currentDocument = ref<DocumentDocType | null>(null);
  const loaded = ref(false);
  const isLoading = ref(false);

  async function init(): Promise<void> {
    if (loaded.value) return;
    try {
      const db = await getDatabase();
      const docs = await db.documents.find().exec();
      documents.value = docs.map((d) => d.toJSON() as DocumentDocType);

      db.documents.$.subscribe((change) => {
        if (change.operation === "INSERT") {
          documents.value = [...documents.value, change.documentData as DocumentDocType];
        } else if (change.operation === "UPDATE") {
          documents.value = documents.value.map((d) =>
            d.id === (change.documentData as DocumentDocType).id
              ? (change.documentData as DocumentDocType)
              : d,
          );
        } else if (change.operation === "DELETE") {
          documents.value = documents.value.filter(
            (d) => d.id !== (change.documentData as DocumentDocType).id,
          );
        }
      });

      loaded.value = true;
    } catch (error) {
      reportError(error, "Could not load your document library.", { context: "documents.init" });
      loaded.value = true;
    }
  }

  /**
   * Stores a parsed document's metadata in RxDB (content is NOT persisted — it
   * is re-read from disk on open). Updates the existing record if a document
   * with the same file_path is already stored. Sets it as the current document.
   */
  async function saveDocument(parsed: ParsedDocument): Promise<DocumentDocType | null> {
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      const existing = await db.documents
        .findOne({ selector: { file_path: parsed.file_path } })
        .exec();

      let doc: DocumentDocType;
      if (existing) {
        await existing.patch({
          title: parsed.title,
          section_count: parsed.streamer?.sectionCount ?? 1,
          modified_date: now,
          language: parsed.language,
        });
        doc = existing.toJSON() as DocumentDocType;
      } else {
        const newDoc: DocumentDocType = {
          id: crypto.randomUUID(),
          title: parsed.title,
          section_count: parsed.streamer?.sectionCount ?? 1,
          file_path: parsed.file_path,
          created_date: now,
          modified_date: now,
          file_type: parsed.file_type,
          language: parsed.language,
        };
        await db.documents.insert(newDoc);
        doc = newDoc;
      }

      currentDocument.value = doc;
      return doc;
    } catch (error) {
      reportError(error, "Could not save the document.", { context: "documents.saveDocument" });
      return null;
    }
  }

  async function getDocument(id: string): Promise<DocumentDocType | null> {
    try {
      const db = await getDatabase();
      const doc = await db.documents.findOne({ selector: { id } }).exec();
      return doc ? (doc.toJSON() as DocumentDocType) : null;
    } catch (error) {
      reportError(error, "Could not retrieve the document.", { context: "documents.getDocument" });
      return null;
    }
  }

  function setCurrent(doc: DocumentDocType | null): void {
    currentDocument.value = doc;
  }

  return {
    documents,
    currentDocument,
    loaded,
    isLoading,
    init,
    saveDocument,
    getDocument,
    setCurrent,
  };
});
