import { describe, it, expect } from "vitest";
import { parserRegistry } from "./parserRegistry";
import { TxtParser } from "./txtParser";
import type { DocumentParser, ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";

describe("ParserRegistry — built-in parsers", () => {
  it("has the txt parser pre-registered", () => {
    expect(parserRegistry.getParser("txt")).toBeInstanceOf(TxtParser);
  });

  it("isSupported returns true for txt", () => {
    expect(parserRegistry.isSupported("txt")).toBe(true);
  });

  it("returns null for unregistered types", () => {
    expect(parserRegistry.getParser("pdf")).toBeNull();
    expect(parserRegistry.getParser("epub")).toBeNull();
    expect(parserRegistry.isSupported("pdf")).toBe(false);
  });
});

describe("ParserRegistry — custom registration", () => {
  it("registers and retrieves a custom parser", () => {
    const mockParser: DocumentParser = {
      supportedTypes: ["md"] as FileType[],
      parse: (_raw, metadata): ParsedDocument => ({
        title: metadata.title,
        content_raw: "parsed markdown",
        total_words: 2,
        file_path: metadata.file_path,
        file_type: "md",
        language: metadata.language,
      }),
    };

    parserRegistry.registerParser(mockParser);
    expect(parserRegistry.getParser("md")).toBe(mockParser);
    expect(parserRegistry.isSupported("md")).toBe(true);
  });

  it("a parser can support multiple file types", () => {
    const multiParser: DocumentParser = {
      supportedTypes: ["pdf", "epub"] as FileType[],
      parse: (_raw, metadata): ParsedDocument => ({
        title: metadata.title,
        content_raw: "",
        total_words: 0,
        file_path: metadata.file_path,
        file_type: metadata.file_type,
        language: metadata.language,
      }),
    };

    parserRegistry.registerParser(multiParser);
    expect(parserRegistry.getParser("pdf")).toBe(multiParser);
    expect(parserRegistry.getParser("epub")).toBe(multiParser);
  });
});
