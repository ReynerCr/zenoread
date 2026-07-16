import { vi } from "vitest";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

/** Creates a mock PDF document proxy for testing. Handles empty pages gracefully. */
export function makeMockPdf(pages: string[]): PDFDocumentProxy {
  return {
    numPages: pages.length,
    getPage: vi.fn((n: number) =>
      Promise.resolve({
        getTextContent: vi.fn(() =>
          Promise.resolve({
            items: pages[n - 1] === ""
              ? []
              : pages[n - 1].split(" ").map((str) => ({ str })),
          }),
        ),
      }),
    ),
  } as unknown as PDFDocumentProxy;
}

/** Creates a mock PDF loading task for testing. */
export function makeMockLoadingTask(): PDFDocumentLoadingTask {
  return {
    destroy: vi.fn(() => Promise.resolve()),
  } as unknown as PDFDocumentLoadingTask;
}
