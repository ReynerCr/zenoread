import { describe, it, expect } from "vitest";
import { PdfStreamer } from "./pdfStreamer";
import { makeMockPdf, makeMockLoadingTask } from "./testHelpers";

describe("PdfStreamer", () => {
  it("sectionCount equals pdf.numPages", () => {
    const pdf = makeMockPdf(["a", "b", "c"]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(streamer.sectionCount).toBe(3);
  });

  it("loads page text on demand", async () => {
    const pdf = makeMockPdf(["Hello world", "from PDF"]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(0)).toBe("Hello world");
    expect(await streamer.loadSection(1)).toBe("from PDF");
  });

  it("returns empty string for out-of-range sections", async () => {
    const pdf = makeMockPdf(["page one"]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(1)).toBe("");
    expect(await streamer.loadSection(-1)).toBe("");
  });

  it("handles empty page texts", async () => {
    const pdf = makeMockPdf(["", "page two"]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    expect(await streamer.loadSection(0)).toBe("");
    expect(await streamer.loadSection(1)).toBe("page two");
  });

  it("calls loadingTask.destroy() on close", async () => {
    const loadingTask = makeMockLoadingTask();
    const streamer = new PdfStreamer(makeMockPdf(["a"]), loadingTask);
    await streamer.close();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("loads each page only once per loadSection call", async () => {
    const pdf = makeMockPdf(["page one", "page two"]);
    const streamer = new PdfStreamer(pdf, makeMockLoadingTask());
    await streamer.loadSection(0);
    await streamer.loadSection(0);
    expect(pdf.getPage).toHaveBeenCalledTimes(2);
  });
});
