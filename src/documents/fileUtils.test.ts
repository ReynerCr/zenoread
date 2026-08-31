import { describe, it, expect } from "vitest";
import { detectFileType, fileTypeFromMime } from "./fileUtils";

describe("detectFileType", () => {
  it("recognizes supported extensions case-insensitively", () => {
    expect(detectFileType("hello.txt")).toBe("txt");
    expect(detectFileType("book.PDF")).toBe("pdf");
  });

  it("returns null for unknown extensions", () => {
    expect(detectFileType("readme")).toBeNull();
    expect(detectFileType("photo.jpg")).toBeNull();
  });
});

describe("fileTypeFromMime", () => {
  it("maps explicit text and pdf declarations", () => {
    expect(fileTypeFromMime("application/pdf")).toBe("pdf");
    expect(fileTypeFromMime("text/plain")).toBe("txt");
  });

  it("tolerates parameters and case", () => {
    expect(fileTypeFromMime("text/plain; charset=utf-8")).toBe("txt");
    expect(fileTypeFromMime("Application/PDF")).toBe("pdf");
  });

  it("rejects anything ambiguous or unknown", () => {
    expect(fileTypeFromMime("application/octet-stream")).toBeNull();
    expect(fileTypeFromMime("application/epub+zip")).toBeNull();
    expect(fileTypeFromMime("text/html")).toBeNull();
    expect(fileTypeFromMime(null)).toBeNull();
  });
});
