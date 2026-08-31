import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAndroid } from "../utils/platform";
import {
  releasePersistedGrant,
  releaseAllPersistedGrants,
  persistPersistedGrant,
  evictOldestGrants,
} from "./androidGrants";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("../utils/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/platform")>();
  return { ...actual, isAndroid: vi.fn(() => true) };
});

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue(undefined);
});

describe("releasePersistedGrant", () => {
  it("releases a single grant on Android", async () => {
    await releasePersistedGrant("content://provider/document/1");
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://provider/document/1",
    });
  });

  it("is a no-op off Android and ignores failures", async () => {
    vi.mocked(isAndroid).mockReturnValue(false);
    await releasePersistedGrant("content://provider/document/1");
    expect(mockInvoke).not.toHaveBeenCalled();

    vi.mocked(isAndroid).mockReturnValue(true);
    mockInvoke.mockRejectedValueOnce(new Error("boom"));
    await expect(releasePersistedGrant("content://provider/document/1")).resolves.toBeUndefined();
  });
});

describe("releaseAllPersistedGrants", () => {
  it("releases every grant on Android", async () => {
    await releaseAllPersistedGrants();
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release_all");
  });
});

describe("persistPersistedGrant", () => {
  it("persists and reports success", async () => {
    await expect(persistPersistedGrant("content://provider/document/1")).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|persist", {
      uri: "content://provider/document/1",
    });
  });

  it("reports failure when persist rejects", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Persisted permission limit reached"));
    await expect(persistPersistedGrant("content://provider/document/1")).resolves.toBe(false);
  });
});

describe("evictOldestGrants", () => {
  const docs = [
    { file_path: "content://a/2", modified_date: "2025-01-02" },
    { file_path: "/plain/path.txt", modified_date: "2025-01-01" },
    { file_path: "content://a/3", modified_date: "2025-01-03" },
    { file_path: "content://a/1", modified_date: "2025-01-01" },
  ];

  it("releases only content URIs, oldest first, up to count", async () => {
    await evictOldestGrants(docs, 2);

    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://a/1",
    });
    expect(mockInvoke).toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://a/2",
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "content://a/3",
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("plugin:zenoread-android-fs|release", {
      uri: "/plain/path.txt",
    });
  });

  it("is a no-op off Android", async () => {
    vi.mocked(isAndroid).mockReturnValue(false);
    await evictOldestGrants(docs, 2);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
