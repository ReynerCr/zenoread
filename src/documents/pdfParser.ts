import type { DocumentMetadata, DocumentParser, ParsedDocument } from "./types";
import type { FileType } from "../db/schemas/documents.schema";
import { PdfStreamer } from "./pdfStreamer";
import { AppError } from "../utils/errors";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function getPdfjsLib(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(async (lib) => {
      try {
        const { default: PdfWorker } = await import(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker"
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
 * Parses PDF (.pdf) files using pdf.js. Opens the document and keeps it
 * open for on-demand page loading via PdfStreamer. Probes pages during
 * parse to validate that the document has a text layer.
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

    // Probe pages until we find text content. If no page has text, the
    // document is likely scanned and has no text layer.
    let hasContent = false;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      if (content.items.some((item) => "str" in item && item.str.trim().length > 0)) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      await loadingTask.destroy();
      throw new AppError("This PDF doesn't contain any text. It may be a fully scanned document.");
    }

    return {
      title,
      file_path: metadata.file_path,
      file_type: metadata.file_type,
      language: metadata.language,
      streamer: new PdfStreamer(pdf, loadingTask),
    };
  }
}
