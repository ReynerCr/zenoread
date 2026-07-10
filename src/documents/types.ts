import type { FileType } from "../db/schemas/documents.schema";

export interface DocumentMetadata {
  title: string;
  file_path: string;
  file_type: FileType;
  language: string;
}

/**
 * Provides text content on demand, one section at a time.
 * TXT files have one section; PDFs have one per page.
 * The streamer owns the underlying resource (e.g. pdf.js document)
 * and must be closed when the document is no longer needed.
 */
export interface DocumentStreamer {
  sectionCount: number;
  getSectionLabel(i: number): string;
  loadSection(i: number): Promise<string>;
  close(): Promise<void>;
}

export interface ParsedDocument {
  title: string;
  file_path: string;
  file_type: FileType;
  language: string;
  streamer: DocumentStreamer;
}

/**
 * Abstraction layer for converting raw file content into a display-ready
 * document. Each format (txt, pdf, epub, md) gets its own implementation.
 * New parsers are registered via `ParserRegistry.registerParser()`.
 */
export interface DocumentParser {
  readonly supportedTypes: FileType[];
  parse(raw: string | Uint8Array, metadata: DocumentMetadata): Promise<ParsedDocument>;
}
