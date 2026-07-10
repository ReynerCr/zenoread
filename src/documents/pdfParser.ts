import type { DocumentMetadata, DocumentParser, ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { PdfStreamer } from "./pdfStreamer";

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
 * concatenates it, and counts words. Populates `sections` with one entry
 * per page so the UI can offer page navigation.
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

      pageTexts.push(text);
    }

    await loadingTask.destroy();

    return {
      title,
      file_path: metadata.file_path,
      file_type: metadata.file_type,
      language: metadata.language,
      streamer: new PdfStreamer(pageTexts),
    };
  }
}
