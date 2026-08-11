import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { parserRegistry } from "./parserRegistry";
import type { ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { isTauri } from "../utils/platform";
import { reportError, AppError } from "../utils/errors";
import { t } from "../i18n";
import { detectFileType, isBinaryType, titleFromFilename } from "./fileUtils";

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
    return new AppError(t("errors.pdfEmpty"));
  }
  return new AppError(t("errors.fileEmpty"));
}

export async function validateContent(doc: ParsedDocument): Promise<ParsedDocument> {
  // PDF validation (checking for text layer) happens in PdfParser during parse().
  if (doc.file_type === "pdf") return doc;
  const text = await doc.streamer.loadSection(0);
  if (text.trim().length === 0) {
    throw emptyContentError(doc.file_type);
  }
  return doc;
}

/** Wraps a loader operation with uniform error handling: reports and returns null on failure. */
async function withLoaderError<T>(
  fn: () => Promise<T>,
  fallbackMessage: string,
  context: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    reportError(error, error instanceof AppError ? undefined : fallbackMessage, { context });
    return null;
  }
}

/** Returns the parser for a file type, or reports and returns null if none registered. */
function getParserOrReport(fileType: FileType, context: string) {
  const parser = parserRegistry.getParser(fileType);
  if (!parser) {
    reportError(new Error(t("errors.noParser", { type: fileType })), undefined, { context });
  }
  return parser;
}

/**
 * Opens a native file dialog (Tauri) or a hidden file input (web fallback),
 * reads the selected file, and runs it through the appropriate parser.
 * Returns null if the user cancels or no file is selected.
 */
export async function loadDocumentFromDialog(): Promise<ParsedDocument | null> {
  return withLoaderError(
    async () => (isTauri() ? loadFromTauriDialog() : loadFromWebInput()),
    t("errors.loadFile"),
    "fileLoader.loadDocumentFromDialog",
  );
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
  return withLoaderError(
    async () => {
      const parser = getParserOrReport(fileType, "fileLoader.loadDocumentFromPath");
      if (!parser) return null;
      const raw = await readFileFromPath(filePath, fileType);
      const filename = filePath.split("/").pop() ?? filePath;
      return validateContent(await parser.parse(raw, {
        title: titleFromFilename(filename),
        file_path: filePath,
        file_type: fileType,
        language,
      }));
    },
    t("errors.readDisk"),
    "fileLoader.loadDocumentFromPath",
  );
}

/**
 * Parses a browser File object (from drag-and-drop or file input). Used in
 * web mode where we can't access disk paths directly.
 */
export async function loadDocumentFromFile(file: File): Promise<ParsedDocument | null> {
  return withLoaderError(
    async () => {
      const fileType = detectFileType(file.name);
      if (!fileType) {
        reportError(new Error(t("errors.unsupportedType", { name: file.name })), undefined, { context: "fileLoader.loadDocumentFromFile" });
        return null;
      }
      const parser = getParserOrReport(fileType, "fileLoader.loadDocumentFromFile");
      if (!parser) return null;
      const raw = await readFileFromBlob(file, fileType);
      return validateContent(await parser.parse(raw, {
        title: titleFromFilename(file.name),
        file_path: file.name,
        file_type: fileType,
        language: "en",
      }));
    },
    t("errors.readDropped"),
    "fileLoader.loadDocumentFromFile",
  );
}

async function loadFromTauriDialog(): Promise<ParsedDocument | null> {
  const selected = await open({
    multiple: false,
    filters: [
      // Tauri uses the first filter as the dialog default; keep an
      // "All supported files" entry first so users see both formats.
      { name: t("picker.allSupported"), extensions: ["txt", "pdf"] },
      { name: t("picker.pdf"), extensions: ["pdf"] },
      { name: t("picker.txt"), extensions: ["txt"] },
    ],
  });
  if (!selected) return null;

  const filePath = selected;

  const filename = filePath.split("/").pop() ?? filePath;
  const fileType = detectFileType(filename);
  if (!fileType) {
    reportError(new Error(t("errors.unsupportedType", { name: filename })), undefined, { context: "fileLoader.loadFromTauriDialog" });
    return null;
  }

  const parser = getParserOrReport(fileType, "fileLoader.loadFromTauriDialog");
  if (!parser) return null;

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
