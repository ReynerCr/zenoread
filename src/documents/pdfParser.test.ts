import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentMetadata } from "./types";

const meta = (over: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  title: "test.pdf",
  file_path: "/home/user/test.pdf",
  file_type: "pdf",
  language: "en",
  ...over,
});

function mockPdfjsLib(pages: { text: string }[], info: Record<string, unknown> = {}) {
  return {
    GlobalWorkerOptions: { workerPort: null, workerSrc: "" },
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getMetadata: vi.fn(() => Promise.resolve({ info, metadata: {} })),
        getPage: vi.fn((n: number) => Promise.resolve({
          getTextContent: vi.fn(() => Promise.resolve({
            items: pages[n - 1].text.split(" ").map((str) => ({ str })),
          })),
        })),
        destroy: vi.fn(() => Promise.resolve()),
      }),
      destroy: vi.fn(() => Promise.resolve()),
    })),
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("PdfParser — text extraction", () => {
  it("extracts text from all pages into the streamer", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([
      { text: "Hello world" },
      { text: "from PDF" },
    ]));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse(new Uint8Array([1, 2, 3]), meta());
    expect(result.file_type).toBe("pdf");
    expect(result.streamer.sectionCount).toBe(2);
    expect(await result.streamer.loadSection(0)).toBe("Hello world");
    expect(await result.streamer.loadSection(1)).toBe("from PDF");
  });

  it("falls back to filename title when PDF has no metadata title", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([{ text: "Some content" }]));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse(new Uint8Array([1]), meta({ title: "fallback" }));
    expect(result.title).toBe("fallback");
  });

  it("uses PDF metadata title when available", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([{ text: "Some content" }], { Title: "My PDF Document" }));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse(new Uint8Array([1]), meta({ title: "fallback" }));
    expect(result.title).toBe("My PDF Document");
  });

  it("preserves metadata passthrough", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([{ text: "Hola mundo" }]));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse(new Uint8Array([1]), meta({
      file_path: "/docs/test.pdf",
      file_type: "pdf",
      language: "es",
    }));
    expect(result.file_path).toBe("/docs/test.pdf");
    expect(result.file_type).toBe("pdf");
    expect(result.language).toBe("es");
  });
});

describe("PdfParser — edge cases", () => {
  it("returns empty page texts when PDF has no text layer", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([{ text: "" }, { text: "" }]));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse(new Uint8Array([1]), meta());
    expect(result.streamer.sectionCount).toBe(2);
    expect(await result.streamer.loadSection(0)).toBe("");
    expect(await result.streamer.loadSection(1)).toBe("");
  });

  it("accepts string input by encoding it", async () => {
    vi.doMock("pdfjs-dist", () => mockPdfjsLib([{ text: "Text content" }]));
    vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({ default: vi.fn() }));
    const { PdfParser } = await import("./pdfParser");
    const parser = new PdfParser();
    const result = await parser.parse("fake pdf bytes", meta());
    expect(await result.streamer.loadSection(0)).toBe("Text content");
  });
});
