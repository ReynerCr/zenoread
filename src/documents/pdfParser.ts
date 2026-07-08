import type { DocumentMetadata, DocumentParser, ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjsLib(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then(async (lib) => {
      try {
        const { default: PdfWorker } = await import(
          "pdfjs-dist/build/pdf.worker.min.mjs?worker"
        );
        lib.GlobalWorkerOptions.workerPort = new PdfWorker();
      } catch {
        // Worker setup failed (e.g. in test environment). pdf.js will
        // fall back to running in the main thread.
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Parses PDF (.pdf) files using pdf.js. Extracts text from all pages,
 * concatenates it, and counts words. No page awareness — the output is
 * a flat text stream suitable for the RSVP engine.
 */
export class PdfParser implements DocumentParser {
  readonly supportedTypes: FileType[] = ["pdf"];

  async parse(raw: string | Uint8Array, metadata: DocumentMetadata): Promise<ParsedDocument> {
    const pdfjsLib = await getPdfjsLib();
    const data = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    let title = metadata.title;
    try {
      const { info } = await pdf.getMetadata();
      const pdfTitle = (info as Record<string, unknown>)?.Title;
      if (typeof pdfTitle === "string" && pdfTitle.trim().length > 0) {
        title = pdfTitle.trim();
      }
    } catch {
      // Metadata is optional — fall back to filename.
    }

    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      if (text) pageTexts.push(text);
    }

    await loadingTask.destroy();

    const content_raw = pageTexts.join("\n\n");
    const total_words = content_raw.length > 0
      ? content_raw.split(/\s+/).filter(Boolean).length
      : 0;

    return {
      title,
      content_raw,
      total_words,
      file_path: metadata.file_path,
      file_type: metadata.file_type,
      language: metadata.language,
    };
  }
}
