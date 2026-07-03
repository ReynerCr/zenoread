import { describe, it, expect } from "vitest";
import { TxtParser } from "./txtParser";
import type { DocumentMetadata } from "./types";

const parser = new TxtParser();

const meta = (over: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  title: "fallback.txt",
  file_path: "/home/user/fallback.txt",
  file_type: "txt",
  language: "en",
  ...over,
});

describe("TxtParser — basic parsing", () => {
  it("parses plain text and counts words", () => {
    const result = parser.parse("Hello world from ZenoRead", meta());
    expect(result.content_raw).toBe("Hello world from ZenoRead");
    expect(result.total_words).toBe(4);
    expect(result.file_type).toBe("txt");
  });

  it("normalizes CRLF and CR line endings to LF", () => {
    const result = parser.parse("line one\r\nline two\rline three", meta());
    expect(result.content_raw).toBe("line one\nline two\nline three");
  });

  it("trims leading/trailing whitespace", () => {
    const result = parser.parse("  \n  Hello world  \n  ", meta());
    expect(result.content_raw).toBe("Hello world");
  });

  it("handles empty input", () => {
    const result = parser.parse("   \n\n  ", meta());
    expect(result.content_raw).toBe("");
    expect(result.total_words).toBe(0);
    expect(result.title).toBe("fallback.txt");
  });

  it("accepts Uint8Array input", () => {
    const encoder = new TextEncoder();
    const result = parser.parse(encoder.encode("Hello world"), meta());
    expect(result.content_raw).toBe("Hello world");
    expect(result.total_words).toBe(2);
  });
});

describe("TxtParser — title extraction", () => {
  it("uses the first short line as the title", () => {
    const result = parser.parse("My Document\n\nSome content here.", meta());
    expect(result.title).toBe("My Document");
  });

  it("falls back to filename when first line ends with punctuation", () => {
    const result = parser.parse("This is a sentence.\n\nMore text.", meta());
    expect(result.title).toBe("fallback.txt");
  });

  it("falls back to filename when first line is too long", () => {
    const longLine = "A".repeat(81);
    const result = parser.parse(`${longLine}\n\nContent`, meta());
    expect(result.title).toBe("fallback.txt");
  });

  it("uses provided title as fallback", () => {
    const result = parser.parse("Just some text here.", meta({ title: "custom" }));
    expect(result.title).toBe("custom");
  });
});

describe("TxtParser — metadata passthrough", () => {
  it("preserves file_path, file_type, and language from metadata", () => {
    const result = parser.parse("Hello", meta({
      file_path: "/docs/test.txt",
      file_type: "txt",
      language: "es",
    }));
    expect(result.file_path).toBe("/docs/test.txt");
    expect(result.file_type).toBe("txt");
    expect(result.language).toBe("es");
  });
});
