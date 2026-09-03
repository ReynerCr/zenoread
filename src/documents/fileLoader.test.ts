import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateContent, loadDocumentFromDialog, loadDocumentFromPath } from "./fileLoader";
import { isAndroid } from "../utils/platform";
import { AppError } from "../utils/errors";
import { TxtStreamer } from "./txtStreamer";
import { PdfStreamer } from "./pdfStreamer";
import type { ParsedDocument } from "./types";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist/legacy/build/pdf.mjs";

const mockOpen = vi.hoisted(() => vi.fn());
const mockInvoke = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockReadTextFile = vi.hoisted(() => vi.fn());
const mockUseDocumentsStore = vi.hoisted(() =>
  vi.fn<() => { documents: { file_path: string; modified_date: string }[] }>(() => ({ documents: [] })),
);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: mockReadFile,
  readTextFile: mockReadTextFile,
}));
vi.mock("../stores/documents", () => ({ useDocumentsStore: mockUseDocumentsStore }));
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
    mockInvoke.mockResolvedValue(undefined);
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
    expect(mockInvoke).not.toHaveBeenCalledWith("plugin:zenoread-android-fs|release", expect.anything());
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

  it("releases the grant when the picked file has an unsupported type", async () => {
    mockInvoke.mockResolvedValueOnce({
      uri: "content://provider/document/1234",
      name: null,
      mime: null,
      persistError: null,
    });

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/1234",
    });
  });

  it("releases the grant when the picked file fails to open", async () => {
    mockInvoke.mockResolvedValueOnce({
      uri: "content://provider/document/broken.txt",
      name: "broken.txt",
      mime: "text/plain",
      persistError: null,
    });
    mockReadTextFile.mockRejectedValue(new Error("boom"));

    await expect(loadDocumentFromDialog()).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/broken.txt",
    });
  });

  it("evicts oldest grants and retries persistence on the limit error", async () => {
    mockUseDocumentsStore.mockReturnValue({
      documents: [
        { file_path: "content://provider/document/old", modified_date: "2025-01-01" },
        { file_path: "content://provider/document/new", modified_date: "2025-01-02" },
      ],
    });
    mockInvoke.mockResolvedValueOnce({
      uri: "content://provider/document/picked",
      name: "picked.txt",
      mime: "text/plain",
      persistError: "limit",
    });
    mockReadTextFile.mockResolvedValue("Hello world.");

    const doc = await loadDocumentFromDialog();

    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/old",
    });
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/new",
    });
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|persist", {
      uri: "content://provider/document/picked",
    });
    expect(doc?.file_type).toBe("txt");
  });
});

describe("loadDocumentFromPath on Android", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    mockReadFile.mockReset();
    mockReadTextFile.mockReset();
    vi.mocked(isAndroid).mockReturnValue(true);
  });

  afterEach(() => vi.mocked(isAndroid).mockReturnValue(false));

  it("keeps the stored title for content uris", async () => {
    mockInvoke.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue("Hello world.");

    const doc = await loadDocumentFromPath(
      "content://provider/document/raw%3A%2Fstorage%2Fhello.txt",
      "txt",
      "en",
      "Stored title",
    );

    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|check_persisted", {
      uri: "content://provider/document/raw%3A%2Fstorage%2Fhello.txt",
    });
    expect(doc?.title).toBe("Stored title");
  });

  it("reports when the persisted grant is gone", async () => {
    mockInvoke.mockResolvedValue(false);

    await expect(
      loadDocumentFromPath("content://provider/document/1234", "txt", "en", "Stored title"),
    ).resolves.toBeNull();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it("releases the dead grant when reopening a content uri read fails", async () => {
    mockInvoke.mockResolvedValueOnce(true); // check_persisted passes
    mockReadTextFile.mockRejectedValueOnce(new Error("File not found"));

    await expect(
      loadDocumentFromPath("content://provider/document/gone", "txt", "en", "Stored title"),
    ).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/gone",
    });
  });

  it("releases the grant when the reopened file fails validation", async () => {
    mockInvoke.mockResolvedValueOnce(true); // check_persisted passes
    mockReadTextFile.mockResolvedValue(""); // empty content fails validation

    await expect(
      loadDocumentFromPath("content://provider/document/empty.txt", "txt", "en", "Stored title"),
    ).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/empty.txt",
    });
  });

  it("still derives the title from plain paths on desktop", async () => {
    vi.mocked(isAndroid).mockReturnValue(false);
    mockReadTextFile.mockResolvedValue("Hello world.");

    const doc = await loadDocumentFromPath("/home/user/hello.txt", "txt", "en", "Stored title");

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(doc?.title).toBe("hello");
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
