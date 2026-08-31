import type { FileType } from "../db/schemas/documents.schema";

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  txt: "txt",
  pdf: "pdf",
};

const BINARY_TYPES: ReadonlySet<FileType> = new Set(["pdf"]);

export function detectFileType(filename: string): FileType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] ?? null;
}

export function isBinaryType(fileType: FileType): boolean {
  return BINARY_TYPES.has(fileType);
}

export function titleFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Maps a provider-declared MIME type to a supported file type. Strict by
 * design: only explicit text/plain and application/pdf declarations pass;
 * anything else (octet-stream, epub+zip, ...) is rejected.
 */
export function fileTypeFromMime(mime: string | null | undefined): FileType | null {
  if (!mime) return null;
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "application/pdf") return "pdf";
  if (base === "text/plain") return "txt";
  return null;
}
