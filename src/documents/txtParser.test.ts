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
  it("parses plain text and returns a streamer", async () => {
    const result = await parser.parse("Hello world from ZenoRead", meta());
    expect(result.file_type).toBe("txt");
    expect(result.streamer.sectionCount).toBe(1);
    expect(await result.streamer.loadSection(0)).toBe("Hello world from ZenoRead");
  });

  it("normalizes CRLF and CR line endings to LF", async () => {
    const result = await parser.parse("line one\r\nline two\rline three", meta());
    expect(await result.streamer.loadSection(0)).toBe("line one\nline two\nline three");
  });

  it("trims leading/trailing whitespace", async () => {
    const result = await parser.parse("  \n  Hello world  \n  ", meta());
    expect(await result.streamer.loadSection(0)).toBe("Hello world");
  });

  it("handles empty input", async () => {
    const result = await parser.parse("   \n\n  ", meta());
    expect(await result.streamer.loadSection(0)).toBe("");
    expect(result.title).toBe("fallback.txt");
  });

  it("accepts Uint8Array input", async () => {
    const encoder = new TextEncoder();
    const result = await parser.parse(encoder.encode("Hello world"), meta());
    expect(await result.streamer.loadSection(0)).toBe("Hello world");
  });
});

describe("TxtParser — title extraction", () => {
  it("uses the first short line as the title", async () => {
    const result = await parser.parse("My Document\n\nSome content here.", meta());
    expect(result.title).toBe("My Document");
  });

  it("falls back to filename when first line ends with punctuation", async () => {
    const result = await parser.parse("This is a sentence.\n\nMore text.", meta());
    expect(result.title).toBe("fallback.txt");
  });

  it("falls back to filename when first line is too long", async () => {
    const longLine = "A".repeat(81);
    const result = await parser.parse(`${longLine}\n\nContent`, meta());
    expect(result.title).toBe("fallback.txt");
  });

  it("uses provided title as fallback", async () => {
    const result = await parser.parse("Just some text here.", meta({ title: "custom" }));
    expect(result.title).toBe("custom");
  });
});

describe("TxtParser — metadata passthrough", () => {
  it("preserves file_path, file_type, and language from metadata", async () => {
    const result = await parser.parse("Hello", meta({
      file_path: "/docs/test.txt",
      file_type: "txt",
      language: "es",
    }));
    expect(result.file_path).toBe("/docs/test.txt");
    expect(result.file_type).toBe("txt");
    expect(result.language).toBe("es");
  });
});
