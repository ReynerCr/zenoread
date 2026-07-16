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
