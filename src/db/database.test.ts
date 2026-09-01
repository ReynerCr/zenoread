import { describe, it, expect, vi } from "vitest";

const { mockRemoveRxDatabase, mockInvoke, mockIsTauri } = vi.hoisted(() => ({
  mockRemoveRxDatabase: vi.fn(),
  mockInvoke: vi.fn(),
  mockIsTauri: vi.fn(),
}));

vi.mock("rxdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("rxdb")>();
  return { ...actual, removeRxDatabase: mockRemoveRxDatabase };
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("../utils/platform", () => ({ isTauri: mockIsTauri }));

// Imports after mocks so the module-under-test sees the mocked deps.
import { resetAllAppData } from "./database";

describe("resetAllAppData", () => {
  it("throws when storage removal fails and we are not on Tauri", async () => {
    mockRemoveRxDatabase.mockRejectedValueOnce(new Error("disk full"));
    mockIsTauri.mockReturnValue(false);

    await expect(resetAllAppData()).rejects.toThrow("Database could not be wiped on web");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});