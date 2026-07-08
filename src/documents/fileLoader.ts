import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parserRegistry } from "./parserRegistry";
import type { ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { isTauri } from "../utils/platform";
import { reportError } from "../utils/errors";

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  txt: "txt",
  md: "md",
  pdf: "pdf",
  epub: "epub",
};

function detectFileType(filename: string): FileType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] ?? null;
}

function titleFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Opens a native file dialog (Tauri) or a hidden file input (web fallback),
 * reads the selected file as text, and runs it through the appropriate parser.
 * Returns null if the user cancels or no file is selected.
 */
export async function loadDocumentFromDialog(): Promise<ParsedDocument | null> {
  try {
    if (isTauri()) {
      return await loadFromTauriDialog();
    }
    return await loadFromWebInput();
  } catch (error) {
    reportError(error, "Could not load the file.", { context: "fileLoader.loadDocumentFromDialog" });
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
    const raw = await readTextFile(filePath);
    const filename = filePath.split("/").pop() ?? filePath;
    return parser.parse(raw, {
      title: titleFromFilename(filename),
      file_path: filePath,
      file_type: fileType,
      language,
    });
  } catch (error) {
    reportError(error, "Could not read the file from disk.", { context: "fileLoader.loadDocumentFromPath" });
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
    const raw = await file.text();
    return parser.parse(raw, {
      title: titleFromFilename(file.name),
      file_path: file.name,
      file_type: fileType,
      language: "en",
    });
  } catch (error) {
    reportError(error, "Could not read the dropped file.", { context: "fileLoader.loadDocumentFromFile" });
    return null;
  }
}

async function loadFromTauriDialog(): Promise<ParsedDocument | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Text files", extensions: ["txt"] }],
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

  const raw = await readTextFile(filePath);
  return parser.parse(raw, {
    title: titleFromFilename(filename),
    file_path: filePath,
    file_type: fileType,
    language: "en",
  });
}

async function loadFromWebInput(): Promise<ParsedDocument | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,text/plain";
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
