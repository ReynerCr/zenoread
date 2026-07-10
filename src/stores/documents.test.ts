import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the database module before importing the store.
const mockInsert = vi.fn();
const mockFindOne = vi.fn();
const mockSubscribe = vi.fn();

const mockCollection = {
  find: () => ({ exec: () => Promise.resolve([]) }),
  findOne: mockFindOne,
  insert: mockInsert,
  $: { subscribe: mockSubscribe },
};

vi.mock("../db/database", () => ({
  getDatabase: () =>
    Promise.resolve({
      documents: mockCollection,
    }),
}));

import { useDocumentsStore } from "./documents";
import { TxtStreamer } from "../documents/txtStreamer";
import type { ParsedDocument } from "../documents/types";

const PARSED_DOC: ParsedDocument = {
  title: "Test Document",
  file_path: "/home/user/test.txt",
  file_type: "txt",
  language: "en",
  streamer: new TxtStreamer("Hello world. This is a test."),
};

function mockExecReturn(doc: unknown | null) {
  return { exec: () => Promise.resolve(doc ? { toJSON: () => doc, patch: vi.fn() } : null) };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mockFindOne.mockReturnValue(mockExecReturn(null));
  mockInsert.mockImplementation((doc: unknown) => Promise.resolve({ toJSON: () => doc }));
  mockSubscribe.mockReturnValue({ unsubscribe: vi.fn() });
});

describe("documents store — init", () => {
  it("loads with empty list by default", async () => {
    const store = useDocumentsStore();
    await store.init();
    expect(store.documents).toEqual([]);
    expect(store.loaded).toBe(true);
  });
});

describe("documents store — saveDocument", () => {
  it("inserts a new document when file_path is not found", async () => {
    const store = useDocumentsStore();
    await store.init();

    const result = await store.saveDocument(PARSED_DOC);

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Test Document");
    expect(result?.file_path).toBe("/home/user/test.txt");
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(store.currentDocument).not.toBeNull();
    expect(store.currentDocument?.id).toBe(result?.id);
  });

  it("updates an existing document when file_path matches", async () => {
    const existingDoc = {
      id: "existing-id",
      title: "Old Title",
      section_count: 1,
      file_path: "/home/user/test.txt",
      created_date: "2026-01-01T00:00:00.000Z",
      modified_date: "2026-01-01T00:00:00.000Z",
      file_type: "txt",
      language: "en",
    };
    const mockPatch = vi.fn();
    mockFindOne.mockReturnValue({
      exec: () =>
        Promise.resolve({
          toJSON: () => existingDoc,
          patch: mockPatch,
        }),
    });

    const store = useDocumentsStore();
    await store.init();

    const result = await store.saveDocument(PARSED_DOC);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Document",
        section_count: 1,
      }),
    );
    expect(result?.id).toBe("existing-id");
    expect(store.currentDocument?.id).toBe("existing-id");
  });
});

describe("documents store — setCurrent", () => {
  it("sets and clears the current document", () => {
    const store = useDocumentsStore();
    const doc = { ...PARSED_DOC, id: "x", created_date: "", modified_date: "" } as never;
    store.setCurrent(doc);
    expect(store.currentDocument).toEqual(doc);
    store.setCurrent(null);
    expect(store.currentDocument).toBeNull();
  });
});
