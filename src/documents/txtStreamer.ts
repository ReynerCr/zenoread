import type { DocumentStreamer } from "./types";

/**
 * Streamer for plain text files. Has a single section containing the full
 * text. No resources to close.
 */
export class TxtStreamer implements DocumentStreamer {
  readonly sectionCount = 1;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  getSectionLabel(i: number): string {
    return i === 0 ? "Document" : "";
  }

  async loadSection(i: number): Promise<string> {
    if (i !== 0) return "";
    return this.text;
  }

  async close(): Promise<void> {}
}
