import { describe, it, expect } from "vitest";
import { validateContent } from "./fileLoader";
import { AppError } from "../utils/errors";
import { TxtStreamer } from "./txtStreamer";
import { PdfStreamer } from "./pdfStreamer";
import type { ParsedDocument } from "./types";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

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
