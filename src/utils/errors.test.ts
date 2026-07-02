import { describe, it, expect } from "vitest";
import { AppError, toMessage } from "./errors";

describe("toMessage", () => {
  it("returns the userMessage for an AppError", () => {
    expect(toMessage(new AppError("Friendly message"))).toBe("Friendly message");
  });

  it("returns the message for a generic Error", () => {
    expect(toMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string values as-is", () => {
    expect(toMessage("just a string")).toBe("just a string");
  });

  it("falls back to a generic message for unknown values", () => {
    expect(toMessage({ weird: true })).toBe("An unexpected error occurred.");
    expect(toMessage(null)).toBe("An unexpected error occurred.");
  });
});

describe("AppError", () => {
  it("exposes the user message and preserves the cause", () => {
    const cause = new Error("root cause");
    const err = new AppError("Could not load file", { cause });
    expect(err.userMessage).toBe("Could not load file");
    expect(err.name).toBe("AppError");
    expect(err.cause).toBe(cause);
  });
});
