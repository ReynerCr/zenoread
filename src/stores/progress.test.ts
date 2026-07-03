import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mockFindOne = vi.fn();
const mockInsert = vi.fn();

const mockCollection = {
  findOne: mockFindOne,
  insert: mockInsert,
};

vi.mock("../db/database", () => ({
  getDatabase: () =>
    Promise.resolve({
      reading_progress: mockCollection,
    }),
}));

import { useProgressStore } from "./progress";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mockFindOne.mockReturnValue({ exec: () => Promise.resolve(null) });
  mockInsert.mockImplementation((doc: unknown) => Promise.resolve({ toJSON: () => doc }));
});

describe("progress store — loadProgress", () => {
  it("returns 0 when no progress record exists", async () => {
    const store = useProgressStore();
    const index = await store.loadProgress("doc-1");
    expect(index).toBe(0);
    expect(store.currentProgress).toBeNull();
  });

  it("returns saved last_word_index when a record exists", async () => {
    const saved = {
      document_id: "doc-1",
      last_word_index: 42,
      last_read_date: "2026-01-01T00:00:00.000Z",
      reading_time_total: 60000,
      completion_percentage: 50,
    };
    mockFindOne.mockReturnValue({
      exec: () => Promise.resolve({ toJSON: () => saved }),
    });

    const store = useProgressStore();
    const index = await store.loadProgress("doc-1");
    expect(index).toBe(42);
    expect(store.currentProgress?.last_word_index).toBe(42);
  });
});

describe("progress store — saveProgress", () => {
  it("inserts a new progress record when none exists", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 10, 20);

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.document_id).toBe("doc-1");
    expect(inserted.last_word_index).toBe(10);
    expect(inserted.completion_percentage).toBe(50);
    expect(inserted.reading_time_total).toBe(0);
  });

  it("updates an existing progress record", async () => {
    const mockPatch = vi.fn();
    const existing = {
      document_id: "doc-1",
      last_word_index: 5,
      last_read_date: "2026-01-01T00:00:00.000Z",
      reading_time_total: 30000,
      completion_percentage: 25,
    };
    mockFindOne.mockReturnValue({
      exec: () => Promise.resolve({ toJSON: () => existing, patch: mockPatch }),
    });

    const store = useProgressStore();
    await store.saveProgress("doc-1", 15, 20);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        last_word_index: 15,
        completion_percentage: 75,
      }),
    );
  });

  it("clamps last_word_index to valid range", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 100, 20);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.last_word_index).toBe(19);
    expect(inserted.completion_percentage).toBe(95);
  });

  it("skips saving when totalBlocks is 0", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 5, 0);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("progress store — clearProgress", () => {
  it("clears the current progress ref", async () => {
    const saved = {
      document_id: "doc-1",
      last_word_index: 5,
      last_read_date: "",
      reading_time_total: 0,
      completion_percentage: 25,
    };
    mockFindOne.mockReturnValue({
      exec: () => Promise.resolve({ toJSON: () => saved }),
    });

    const store = useProgressStore();
    await store.loadProgress("doc-1");
    expect(store.currentProgress).not.toBeNull();

    store.clearProgress();
    expect(store.currentProgress).toBeNull();
  });
});
