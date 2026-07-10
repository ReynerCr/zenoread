import type { RxJsonSchema } from "rxdb";

export interface ReadingProgressDocType {
  /** Primary key; equals the related document's id (one progress per document). */
  document_id: string;
  /** Which section (page) the reader was on. */
  section_index: number;
  /** Block index within the current section. */
  block_index_in_section: number;
  /** ISO-8601 timestamp of the last reading session. */
  last_read_date: string;
  /** Accumulated reading time for this document, in milliseconds. */
  reading_time_total: number;
  /** 0-100 percentage of the document that has been read. */
  completion_percentage: number;
}

export const readingProgressSchema: RxJsonSchema<ReadingProgressDocType> = {
  title: "reading progress schema",
  version: 1,
  primaryKey: "document_id",
  type: "object",
  properties: {
    document_id: { type: "string", maxLength: 64 },
    section_index: { type: "number", minimum: 0, multipleOf: 1 },
    block_index_in_section: { type: "number", minimum: 0, multipleOf: 1 },
    last_read_date: { type: "string", maxLength: 32 },
    reading_time_total: { type: "number", minimum: 0 },
    completion_percentage: { type: "number", minimum: 0, maximum: 100 },
  },
  required: [
    "document_id",
    "section_index",
    "block_index_in_section",
    "last_read_date",
    "reading_time_total",
    "completion_percentage",
  ],
};
