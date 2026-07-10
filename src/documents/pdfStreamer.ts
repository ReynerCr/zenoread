import type { DocumentStreamer } from "./types";

/**
 * Streamer for PDF files. Currently extracts all page texts upfront and
 * stores them in memory. On-demand per-page loading will replace this.
 */
export class PdfStreamer implements DocumentStreamer {
  readonly sectionCount: number;
  private pageTexts: string[];

  constructor(pageTexts: string[]) {
    this.pageTexts = pageTexts;
    this.sectionCount = pageTexts.length;
  }

  getSectionLabel(i: number): string {
    return `Page ${i + 1}`;
  }

  async loadSection(i: number): Promise<string> {
    if (i < 0 || i >= this.pageTexts.length) return "";
    return this.pageTexts[i];
  }

  async close(): Promise<void> {}
}
