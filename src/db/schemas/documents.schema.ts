import type { RxJsonSchema } from "rxdb";

/**
 * Supported document source formats. Only `txt` is implemented in the MVP;
 * the field exists so the format-extensible loader (PDF/EPUB/...) can be added
 * later without a schema migration.
 */
export type FileType = "txt" | "pdf" | "epub" | "md";

export interface DocumentDocType {
  id: string;
  title: string;
  total_words: number;
  /** Absolute path on disk the document was loaded from (for reloading). */
  file_path: string;
  /** ISO-8601 timestamp. */
  created_date: string;
  /** ISO-8601 timestamp. */
  modified_date: string;
  file_type: FileType;
  /** BCP-47 language tag (e.g. "en", "es") used by the language-aware parser. */
  language: string;
}

export const documentsSchema: RxJsonSchema<DocumentDocType> = {
  title: "documents schema",
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 64 },
    title: { type: "string", maxLength: 500 },
    total_words: { type: "number", minimum: 0, multipleOf: 1 },
    file_path: { type: "string", maxLength: 4096 },
    created_date: { type: "string", maxLength: 32 },
    modified_date: { type: "string", maxLength: 32 },
    file_type: { type: "string", enum: ["txt", "pdf", "epub", "md"] },
    language: { type: "string", maxLength: 35 },
  },
  required: [
    "id",
    "title",
    "total_words",
    "file_path",
    "created_date",
    "modified_date",
    "file_type",
    "language",
  ],
};
