import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateContent, loadDocumentFromDialog } from "./fileLoader";
import { isAndroid } from "../utils/platform";
import { AppError } from "../utils/errors";
import { TxtStreamer } from "./txtStreamer";
import { PdfStreamer } from "./pdfStreamer";
import type { ParsedDocument } from "./types";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

const mockOpen = vi.hoisted(() => vi.fn());
const mockInvoke = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockReadTextFile = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: mockReadFile,
  readTextFile: mockReadTextFile,
}));
vi.mock("../utils/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/platform")>();
  return { ...actual, isTauri: vi.fn(() => true), isAndroid: vi.fn(() => false) };
});

function makeTxtDoc(text: string): ParsedDocument {
  return {
    title: "test",
    file_path: "/test.txt",
    file_type: "txt",
    language: "en",
    streamer: new TxtStreamer(text),
  };
}

function makePdfDoc(): ParsedDocument {
  const pdf = {
    numPages: 2,
    getPage: () => Promise.resolve({
      getTextContent: () => Promise.resolve({ items: [{ str: "text" }] }),
    }),
  } as unknown as PDFDocumentProxy;
  const loadingTask = {
    destroy: () => Promise.resolve(),
  } as unknown as PDFDocumentLoadingTask;
  return {
    title: "test",
    file_path: "/test.pdf",
    file_type: "pdf",
    language: "en",
    streamer: new PdfStreamer(pdf, loadingTask),
  };
}

describe("loadFromTauriDialog", () => {
  beforeEach(() => mockOpen.mockReset());

  it("defaults the dialog to an 'All supported files' filter", async () => {
    mockOpen.mockResolvedValue(null);
    await loadDocumentFromDialog();
    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          { name: "All supported files", extensions: ["txt", "pdf"] },
          { name: "PDF files", extensions: ["pdf"] },
          { name: "Text files", extensions: ["txt"] },
        ],
      }),
    );
  });
});

describe("loadDocumentFromDialog on Android", () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockInvoke.mockReset();
    mockReadFile.mockReset();
    mockReadTextFile.mockReset();
    vi.mocked(isAndroid).mockReturnValue(true);
  });

  afterEach(() => vi.mocked(isAndroid).mockReturnValue(false));

  it("picks via the saf plugin and reads the display-named file as text", async () => {
    mockInvoke.mockResolvedValue({
      uri: "content://provider/document/hello.txt",
      name: "hello.txt",
    });
    mockReadTextFile.mockResolvedValue("Hello world.");

    const doc = await loadDocumentFromDialog();

    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|pick_file", {
      mimeTypes: ["text/plain", "application/pdf"],
    });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockReadTextFile).toHaveBeenCalledWith("content://provider/document/hello.txt");
    expect(doc?.file_type).toBe("txt");
    expect(doc?.title).toBe("hello");
    expect(doc?.file_path).toBe("content://provider/document/hello.txt");
  });

  it("returns null when the picker is cancelled", async () => {
    mockInvoke.mockResolvedValue({ uri: null, name: null });

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it("rejects files whose name is missing and no mime is declared", async () => {
    mockInvoke.mockResolvedValue({ uri: "content://provider/document/1234", name: null, mime: null });

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it("accepts a hidden-name text file via its mime type", async () => {
    mockInvoke.mockResolvedValue({ uri: "content://provider/document/1234", name: null, mime: "text/plain" });
    mockReadTextFile.mockResolvedValue("Hello world.");

    const doc = await loadDocumentFromDialog();

    expect(mockReadTextFile).toHaveBeenCalledWith("content://provider/document/1234");
    expect(doc?.file_type).toBe("txt");
  });

  it("rejects files whose mime is unrecognized", async () => {
    mockInvoke.mockResolvedValue({ uri: "content://provider/document/1234", name: null, mime: "application/epub+zip" });

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it("rejects files with an unrecognized extension", async () => {
    mockInvoke.mockResolvedValue({ uri: "content://provider/document/readme", name: "readme", mime: null });

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });
});

describe("validateContent", () => {
  it("passes through TXT documents with content", async () => {
    const doc = makeTxtDoc("Hello world");
    await expect(validateContent(doc)).resolves.toBe(doc);
  });

  it("throws AppError with empty-file message for empty txt", async () => {
    await expect(validateContent(makeTxtDoc(""))).rejects.toThrow(AppError);
    await expect(validateContent(makeTxtDoc(""))).rejects.toThrow(
      "The file appears to be empty.",
    );
  });

  it("passes through PDF without checking (validation happens in parser)", async () => {
    const doc = makePdfDoc();
    await expect(validateContent(doc)).resolves.toBe(doc);
  });
});
