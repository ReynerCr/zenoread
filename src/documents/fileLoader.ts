import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { parserRegistry } from "./parserRegistry";
import type { ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { isTauri } from "../utils/platform";
import { reportError, AppError } from "../utils/errors";

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  txt: "txt",
  md: "md",
  pdf: "pdf",
  epub: "epub",
};

const BINARY_TYPES: ReadonlySet<FileType> = new Set(["pdf", "epub"]);

function detectFileType(filename: string): FileType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] ?? null;
}

function isBinaryType(fileType: FileType): boolean {
  return BINARY_TYPES.has(fileType);
}

function titleFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.[^.]+$/, "");
}

async function readFileFromPath(filePath: string, fileType: FileType): Promise<string | Uint8Array> {
  if (isBinaryType(fileType)) {
    return await readFile(filePath);
  }
  return await readTextFile(filePath);
}

async function readFileFromBlob(file: File, fileType: FileType): Promise<string | Uint8Array> {
  if (isBinaryType(fileType)) {
    return new Uint8Array(await file.arrayBuffer());
  }
  return await file.text();
}

function emptyContentError(fileType: FileType): AppError {
  if (fileType === "pdf") {
    return new AppError("This PDF doesn't contain a text layer. It may be a scanned document.");
  }
  return new AppError("The file appears to be empty.");
}

export async function validateContent(doc: ParsedDocument): Promise<ParsedDocument> {
  const { streamer } = doc;
  let hasContent = false;
  for (let i = 0; i < streamer.sectionCount; i++) {
    const text = await streamer.loadSection(i);
    if (text.trim().length > 0) {
      hasContent = true;
      break;
    }
  }
  if (!hasContent) {
    throw emptyContentError(doc.file_type);
  }
  return doc;
}

/**
 * Opens a native file dialog (Tauri) or a hidden file input (web fallback),
 * reads the selected file, and runs it through the appropriate parser.
 * Returns null if the user cancels or no file is selected.
 */
export async function loadDocumentFromDialog(): Promise<ParsedDocument | null> {
  try {
    if (isTauri()) {
      return await loadFromTauriDialog();
    }
    return await loadFromWebInput();
  } catch (error) {
    reportError(error, error instanceof AppError ? undefined : "Could not load the file.", { context: "fileLoader.loadDocumentFromDialog" });
    return null;
  }
}

/**
 * Reads a file from disk by its path and parses it. Used when re-opening a
 * document from the library or when a file is dropped onto the window in
 * Tauri mode (where we get a path, not a File object).
 */
export async function loadDocumentFromPath(
  filePath: string,
  fileType: FileType,
  language: string,
): Promise<ParsedDocument | null> {
  try {
    const parser = parserRegistry.getParser(fileType);
    if (!parser) {
      reportError(new Error(`No parser for .${fileType} files yet.`), undefined, { context: "fileLoader.loadDocumentFromPath" });
      return null;
    }
    const raw = await readFileFromPath(filePath, fileType);
    const filename = filePath.split("/").pop() ?? filePath;
    return validateContent(await parser.parse(raw, {
      title: titleFromFilename(filename),
      file_path: filePath,
      file_type: fileType,
      language,
    }));
  } catch (error) {
    reportError(error, error instanceof AppError ? undefined : "Could not read the file from disk.", { context: "fileLoader.loadDocumentFromPath" });
    return null;
  }
}

/**
 * Parses a browser File object (from drag-and-drop or file input). Used in
 * web mode where we can't access disk paths directly.
 */
export async function loadDocumentFromFile(file: File): Promise<ParsedDocument | null> {
  try {
    const fileType = detectFileType(file.name);
    if (!fileType) {
      reportError(new Error(`Unsupported file type: ${file.name}`), undefined, { context: "fileLoader.loadDocumentFromFile" });
      return null;
    }
    const parser = parserRegistry.getParser(fileType);
    if (!parser) {
      reportError(new Error(`No parser for .${fileType} files yet.`), undefined, { context: "fileLoader.loadDocumentFromFile" });
      return null;
    }
    const raw = await readFileFromBlob(file, fileType);
    return validateContent(await parser.parse(raw, {
      title: titleFromFilename(file.name),
      file_path: file.name,
      file_type: fileType,
      language: "en",
    }));
  } catch (error) {
    reportError(error, error instanceof AppError ? undefined : "Could not read the dropped file.", { context: "fileLoader.loadDocumentFromFile" });
    return null;
  }
}

async function loadFromTauriDialog(): Promise<ParsedDocument | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: "Text files", extensions: ["txt"] },
      { name: "PDF files", extensions: ["pdf"] },
    ],
  });
  if (!selected) return null;

  const filePath = selected;

  const filename = filePath.split("/").pop() ?? filePath;
  const fileType = detectFileType(filename);
  if (!fileType) {
    reportError(new Error(`Unsupported file type: ${filename}`), undefined, { context: "fileLoader.loadFromTauriDialog" });
    return null;
  }

  const parser = parserRegistry.getParser(fileType);
  if (!parser) {
    reportError(new Error(`No parser for .${fileType} files yet.`), undefined, { context: "fileLoader.loadFromTauriDialog" });
    return null;
  }

  const raw = await readFileFromPath(filePath, fileType);
  return validateContent(await parser.parse(raw, {
    title: titleFromFilename(filename),
    file_path: filePath,
    file_type: fileType,
    language: "en",
  }));
}

async function loadFromWebInput(): Promise<ParsedDocument | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,text/plain,.pdf,application/pdf";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await loadDocumentFromFile(file));
    };
    input.click();
  });
}
