import type { DocumentParser } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { TxtParser } from "./txtParser";
import { PdfParser } from "./pdfParser";

/**
 * Maps file types to their parsers. New formats are added by registering a
 * parser that declares its `supportedTypes`.
 */
class ParserRegistry {
  private parsers = new Map<FileType, DocumentParser>();

  registerParser(parser: DocumentParser): void {
    for (const type of parser.supportedTypes) {
      this.parsers.set(type, parser);
    }
  }

  getParser(fileType: FileType): DocumentParser | null {
    return this.parsers.get(fileType) ?? null;
  }

  isSupported(fileType: FileType): boolean {
    return this.parsers.has(fileType);
  }
}

export const parserRegistry = new ParserRegistry();

parserRegistry.registerParser(new TxtParser());
parserRegistry.registerParser(new PdfParser());
