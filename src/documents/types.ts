import type { FileType } from "../db/schemas/documents.schema";

export interface DocumentMetadata {
  title: string;
  file_path: string;
  file_type: FileType;
  language: string;
}

export interface ParsedDocument {
  title: string;
  content_raw: string;
  total_words: number;
  file_path: string;
  file_type: FileType;
  language: string;
}

/**
 * Abstraction layer for converting raw file content into a display-ready
 * document. Each format (txt, pdf, epub, md) gets its own implementation.
 * New parsers are registered via `ParserRegistry.registerParser()`.
 */
export interface DocumentParser {
  readonly supportedTypes: FileType[];
  parse(raw: string | Uint8Array, metadata: DocumentMetadata): ParsedDocument;
}
