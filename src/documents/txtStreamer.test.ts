import { describe, it, expect } from "vitest";
import { TxtStreamer } from "./txtStreamer";

describe("TxtStreamer", () => {
  it("has one section", () => {
    const streamer = new TxtStreamer("Hello world");
    expect(streamer.sectionCount).toBe(1);
  });

  it("returns the full text from section 0", async () => {
    const streamer = new TxtStreamer("Hello world");
    expect(await streamer.loadSection(0)).toBe("Hello world");
  });

  it("returns empty string for out-of-range sections", async () => {
    const streamer = new TxtStreamer("Hello world");
    expect(await streamer.loadSection(1)).toBe("");
    expect(await streamer.loadSection(-1)).toBe("");
  });

  it("close is a no-op", async () => {
    const streamer = new TxtStreamer("Hello world");
    await expect(streamer.close()).resolves.toBeUndefined();
  });
});
