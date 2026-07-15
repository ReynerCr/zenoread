import { describe, it, expect } from "vitest";
import { parserRegistry } from "./parserRegistry";
import { TxtParser } from "./txtParser";
import { PdfParser } from "./pdfParser";

describe("ParserRegistry — built-in parsers", () => {
  it("has the txt parser pre-registered", () => {
    expect(parserRegistry.getParser("txt")).toBeInstanceOf(TxtParser);
  });

  it("has the pdf parser pre-registered", () => {
    expect(parserRegistry.getParser("pdf")).toBeInstanceOf(PdfParser);
  });

  it("returns null for unregistered types", () => {
    expect(parserRegistry.getParser("epub")).toBeNull();
  });
});
