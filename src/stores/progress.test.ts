import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mockFindOne = vi.fn();
const mockInsert = vi.fn();
const mockFind = vi.fn();

const mockCollection = {
  findOne: mockFindOne,
  insert: mockInsert,
  find: mockFind,
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
  mockFind.mockReturnValue({ exec: () => Promise.resolve([]) });
  mockInsert.mockImplementation((doc: unknown) => Promise.resolve({ toJSON: () => doc }));
});

describe("progress store — loadProgress", () => {
  it("returns default position when no progress record exists", async () => {
    const store = useProgressStore();
    const pos = await store.loadProgress("doc-1");
    expect(pos).toEqual({ sectionIndex: 0, blockIndex: 0 });
  });

  it("returns saved section and block index when a record exists", async () => {
    const saved = {
      document_id: "doc-1",
      section_index: 3,
      block_index_in_section: 7,
      last_read_date: "2026-01-01T00:00:00.000Z",
      completion_percentage: 50,
    };
    mockFindOne.mockReturnValue({
      exec: () => Promise.resolve({ toJSON: () => saved }),
    });

    const store = useProgressStore();
    const pos = await store.loadProgress("doc-1");
    expect(pos).toEqual({ sectionIndex: 3, blockIndex: 7 });
  });
});

describe("progress store — saveProgress", () => {
  it("inserts a new progress record when none exists", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 2, 5, 10, 20);

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.document_id).toBe("doc-1");
    expect(inserted.section_index).toBe(2);
    expect(inserted.block_index_in_section).toBe(5);
    expect(inserted.completion_percentage).toBe(23);
    expect(store.progressByDocId["doc-1"]).toBe(23);
  });

  it("updates an existing progress record", async () => {
    const mockPatch = vi.fn();
    const existing = {
      document_id: "doc-1",
      section_index: 0,
      block_index_in_section: 5,
      last_read_date: "2026-01-01T00:00:00.000Z",
      completion_percentage: 25,
    };
    mockFindOne.mockReturnValue({
      exec: () => Promise.resolve({ toJSON: () => existing, patch: mockPatch }),
    });

    const store = useProgressStore();
    await store.saveProgress("doc-1", 1, 10, 4, 20);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        section_index: 1,
        block_index_in_section: 10,
        completion_percentage: 38,
      }),
    );
  });

  it("clamps block index to valid range", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 0, 100, 1, 20);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.block_index_in_section).toBe(19);
  });

  it("skips saving when blocksInSection is 0", async () => {
    const store = useProgressStore();
    await store.saveProgress("doc-1", 0, 5, 1, 0);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("progress store — loadAllProgress", () => {
  it("builds a document_id → completion map", async () => {
    mockFind.mockReturnValue({
      exec: () => Promise.resolve([
        { toJSON: () => ({ document_id: "doc-1", completion_percentage: 43 }) },
        { toJSON: () => ({ document_id: "doc-2", completion_percentage: 100 }) },
      ]),
    });

    const store = useProgressStore();
    await store.loadAllProgress();
    expect(store.progressByDocId).toEqual({ "doc-1": 43, "doc-2": 100 });
  });

  it("keeps in-memory values and fills the rest from db", async () => {
    const store = useProgressStore();
    store.progressByDocId = { "doc-1": 43 };
    mockFind.mockReturnValue({
      exec: () => Promise.resolve([
        { toJSON: () => ({ document_id: "doc-2", completion_percentage: 60 }) },
      ]),
    });
    await store.loadAllProgress();
    expect(store.progressByDocId).toEqual({ "doc-1": 43, "doc-2": 60 });
  });
});

describe("progress store — updateCompletionPreview", () => {
  it("updates the completion map without writing to db", async () => {
    const store = useProgressStore();
    store.updateCompletionPreview("doc-1", 1, 3, 3, 10);
    expect(store.progressByDocId["doc-1"]).toBe(43);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
