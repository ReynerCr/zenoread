import { describe, it, expect, vi } from "vitest";
import { PdfStreamer } from "./pdfStreamer";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

function makeMockPdf(pages: { text: string }[]): PDFDocumentProxy {
  return {
    numPages: pages.length,
    getPage: vi.fn((n: number) =>
      Promise.resolve({
        getTextContent: vi.fn(() =>
          Promise.resolve({
            items: pages[n - 1].text.split(" ").map((str) => ({ str })),
          }),
        ),
      }),
    ),
  } as unknown as PDFDocumentProxy;
}

function makeMockLoadingTask(): PDFDocumentLoadingTask {
  return {
    destroy: vi.fn(() => Promise.resolve()),
  } as unknown as PDFDocumentLoadingTask;
}

describe("PdfStreamer", () => {
  it("sectionCount equals pdf.numPages", () => {
    const pdf = makeMockPdf([{ text: "a" }, { text: "b" }, { text: "c" }]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(streamer.sectionCount).toBe(3);
  });

  it("loads page text on demand", async () => {
    const pdf = makeMockPdf([{ text: "Hello world" }, { text: "from PDF" }]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(0)).toBe("Hello world");
    expect(await streamer.loadSection(1)).toBe("from PDF");
  });

  it("returns empty string for out-of-range sections", async () => {
    const pdf = makeMockPdf([{ text: "page one" }]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(1)).toBe("");
    expect(await streamer.loadSection(-1)).toBe("");
  });

  it("returns page labels starting from 1", () => {
    const streamer = new PdfStreamer(makeMockPdf([{ text: "a" }, { text: "b" }]), makeMockLoadingTask());
    expect(streamer.getSectionLabel(0)).toBe("Page 1");
    expect(streamer.getSectionLabel(1)).toBe("Page 2");
  });

  it("handles empty page texts", async () => {
    const pdf = makeMockPdf([{ text: "" }, { text: "page two" }]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(0)).toBe("");
    expect(await streamer.loadSection(1)).toBe("page two");
  });

  it("calls loadingTask.destroy() on close", async () => {
    const loadingTask = makeMockLoadingTask();
    const streamer = new PdfStreamer(makeMockPdf([{ text: "a" }]), loadingTask);
    await streamer.close();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("loads each page only once per loadSection call", async () => {
    const pdf = makeMockPdf([{ text: "page one" }, { text: "page two" }]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    await streamer.loadSection(0);
    await streamer.loadSection(0);
    expect(pdf.getPage).toHaveBeenCalledTimes(2);
  });
});
