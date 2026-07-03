import type { DocumentMetadata, DocumentParser, ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";

/**
 * Parses plain text (.txt) files. Normalizes line endings, counts words, and
 * extracts a title from the first non-empty line when it looks like a heading
 * (short, no trailing sentence punctuation). Falls back to the filename.
 */
export class TxtParser implements DocumentParser {
  readonly supportedTypes: FileType[] = ["txt"];

  parse(raw: string | Uint8Array, metadata: DocumentMetadata): ParsedDocument {
    const content = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    const total_words = normalized.length > 0
      ? normalized.split(/\s+/).filter(Boolean).length
      : 0;

    const title = extractTitle(normalized, metadata.title);

    return {
      title,
      content_raw: normalized,
      total_words,
      file_path: metadata.file_path,
      file_type: metadata.file_type,
      language: metadata.language,
    };
  }
}

/**
 * Uses the first non-empty line as the title if it is short (≤ 80 chars) and
 * does not end with sentence punctuation. Otherwise falls back to the provided
 * default (typically the filename without extension).
 */
function extractTitle(content: string, fallback: string): string {
  if (!content) return fallback;
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return fallback;

  const trimmed = firstLine.trim();
  if (trimmed.length > 80) return fallback;
  if (/[.!?,;:]$/.test(trimmed)) return fallback;
  return trimmed;
}
