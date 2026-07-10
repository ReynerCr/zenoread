import { describe, it, expect } from "vitest";
import { validateContent } from "./fileLoader";
import { AppError } from "../utils/errors";
import { TxtStreamer } from "./txtStreamer";
import { PdfStreamer } from "./pdfStreamer";
import type { ParsedDocument } from "./types";

function makeTxtDoc(text: string): ParsedDocument {
  return {
    title: "test",
    file_path: "/test.txt",
    file_type: "txt",
    language: "en",
    streamer: new TxtStreamer(text),
  };
}

function makePdfDoc(pages: string[]): ParsedDocument {
  return {
    title: "test",
    file_path: "/test.pdf",
    file_type: "pdf",
    language: "en",
    streamer: new PdfStreamer(pages),
  };
}

describe("validateContent", () => {
  it("passes through documents with content", async () => {
    const doc = makeTxtDoc("Hello world");
    await expect(validateContent(doc)).resolves.toBe(doc);
  });

  it("throws AppError with empty-file message for empty txt", async () => {
    await expect(validateContent(makeTxtDoc(""))).rejects.toThrow(AppError);
    await expect(validateContent(makeTxtDoc(""))).rejects.toThrow(
      "The file appears to be empty.",
    );
  });

  it("throws AppError with scanned-document message for empty pdf", async () => {
    await expect(validateContent(makePdfDoc(["", ""]))).rejects.toThrow(
      "This PDF doesn't contain a text layer. It may be a scanned document.",
    );
  });

  it("passes through PDF with some empty pages", async () => {
    const doc = makePdfDoc(["", "page two text", ""]);
    await expect(validateContent(doc)).resolves.toBe(doc);
  });
});
