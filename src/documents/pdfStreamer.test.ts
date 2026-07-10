import { describe, it, expect } from "vitest";
import { PdfStreamer } from "./pdfStreamer";

describe("PdfStreamer", () => {
  it("sectionCount equals the number of page texts", () => {
    const streamer = new PdfStreamer(["page one", "page two", "page three"]);
    expect(streamer.sectionCount).toBe(3);
  });

  it("returns the text for each page", async () => {
    const streamer = new PdfStreamer(["page one", "page two"]);
    expect(await streamer.loadSection(0)).toBe("page one");
    expect(await streamer.loadSection(1)).toBe("page two");
  });

  it("returns empty string for out-of-range sections", async () => {
    const streamer = new PdfStreamer(["page one"]);
    expect(await streamer.loadSection(1)).toBe("");
    expect(await streamer.loadSection(-1)).toBe("");
  });

  it("returns page labels starting from 1", () => {
    const streamer = new PdfStreamer(["page one", "page two"]);
    expect(streamer.getSectionLabel(0)).toBe("Page 1");
    expect(streamer.getSectionLabel(1)).toBe("Page 2");
  });

  it("handles empty page texts", async () => {
    const streamer = new PdfStreamer(["", "page two"]);
    expect(await streamer.loadSection(0)).toBe("");
    expect(await streamer.loadSection(1)).toBe("page two");
  });

  it("close is a no-op", async () => {
    const streamer = new PdfStreamer(["page one"]);
    await expect(streamer.close()).resolves.toBeUndefined();
  });
});
