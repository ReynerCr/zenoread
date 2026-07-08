import { describe, it, expect } from "vitest";
import { validateContent } from "./fileLoader";
import { AppError } from "../utils/errors";
import type { ParsedDocument } from "./types";

function makeDoc(over: Partial<ParsedDocument> = {}): ParsedDocument {
  return {
    title: "test",
    content_raw: "Hello world",
    total_words: 2,
    file_path: "/test.txt",
    file_type: "txt",
    language: "en",
    ...over,
  };
}

describe("validateContent", () => {
  it("passes through documents with content", () => {
    const doc = makeDoc();
    expect(validateContent(doc)).toBe(doc);
  });

  it("throws AppError with empty-file message for empty txt", () => {
    expect(() => validateContent(makeDoc({ content_raw: "", file_type: "txt" }))).toThrow(AppError);
    expect(() => validateContent(makeDoc({ content_raw: "", file_type: "txt" }))).toThrow(
      "The file appears to be empty.",
    );
  });

  it("throws AppError with scanned-document message for empty pdf", () => {
    expect(() => validateContent(makeDoc({ content_raw: "", file_type: "pdf" }))).toThrow(
      "This PDF doesn't contain a text layer. It may be a scanned document.",
    );
  });
});
