import type { DocumentStreamer } from "./types";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

/**
 * Streamer for PDF files. Loads page text on demand via pdf.js instead of
 * extracting all pages upfront. The pdf.js document handle is kept open
 * until `close()` is called.
 */
export class PdfStreamer implements DocumentStreamer {
  readonly sectionCount: number;
  private pdf: PDFDocumentProxy;
  private loadingTask: PDFDocumentLoadingTask;

  constructor(pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask) {
    this.pdf = pdf;
    this.loadingTask = loadingTask;
    this.sectionCount = pdf.numPages;
  }

  async loadSection(i: number): Promise<string> {
    if (i < 0 || i >= this.sectionCount) return "";
    const page = await this.pdf.getPage(i + 1);
    const content = await page.getTextContent();
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
  }

  async close(): Promise<void> {
    await this.loadingTask.destroy();
  }
}
