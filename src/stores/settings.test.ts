import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { i18n } from "../i18n";
import {
  DEFAULT_USER_SETTINGS,
} from "../db/schemas/userSettings.schema";

const mockFindOne = vi.fn();
const mockInsert = vi.fn();
const mockPatch = vi.fn();

const mockCollection = {
  findOne: mockFindOne,
  insert: mockInsert,
};

vi.mock("../db/database", () => ({
  getDatabase: () =>
    Promise.resolve({
      user_settings: mockCollection,
    }),
}));

import { useSettingsStore } from "./settings";

/** Recursively freezes like RxDB dev-mode's deepFreezeWhenDevMode. */
function deepFreeze(obj: Record<string, unknown>): Record<string, unknown> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      deepFreeze(value as Record<string, unknown>);
    }
  }
  return Object.freeze(obj);
}

/**
 * Returns a fake RxDocument whose toJSON() reports the dev-mode frozen shape
 * and whose patch records its argument. patch() also mimics dev-mode's
 * checkWriteRows: the row must survive structuredClone (throws DOC24 otherwise).
 */
function mockSettingsDoc() {
  const frozenData = deepFreeze({ ...DEFAULT_USER_SETTINGS });
  mockPatch.mockImplementation((data: unknown) => {
    structuredClone(data);
    return Promise.resolve({});
  });
  mockFindOne.mockReturnValue({
    exec: () =>
      Promise.resolve({
        toJSON: () => frozenData,
        patch: mockPatch,
        $: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
      }),
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockInsert.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  i18n.global.locale.value = "en";
});

describe("settings store — reset path (DOC24 regression)", () => {
  it("passes plain serialized reset values to patch, never the frozen cached refs", async () => {
    mockSettingsDoc();
    const store = useSettingsStore();
    await store.init();

    // resetAllSettings() in SettingsSidebar does exactly this.
    const { id, ...defaults } = DEFAULT_USER_SETTINGS;
    void id;
    store.update(defaults);
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPatch).toHaveBeenCalledTimes(1);
    const arg = mockPatch.mock.calls[0][0] as Record<string, unknown>;

    // No RxDB-internal fields on the written data.
    expect(Object.keys(arg).some((key) => key.startsWith("_"))).toBe(false);
    // A fresh plain object (not the dev-mode frozen doc cache reference).
    expect(Object.isFrozen(arg)).toBe(false);
    expect(Object.isFrozen(arg.pause_multipliers)).toBe(false);
    // Deep cloneability: dev-mode structuredClone check never throws (DOC24).
    expect(() => structuredClone(arg)).not.toThrow();
    expect(arg).toEqual(DEFAULT_USER_SETTINGS);
  });
});

describe("settings store — normal update path", () => {
  it("still persists a single-field edit through patch", async () => {
    mockSettingsDoc();
    const store = useSettingsStore();
    await store.init();

    store.update({ wpm_default: 420 });
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPatch).toHaveBeenCalledTimes(1);
    const arg = mockPatch.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.wpm_default).toBe(420);
    expect(() => structuredClone(arg)).not.toThrow();
  });

  it("debounces consecutive updates into a single save", async () => {
    mockSettingsDoc();
    const store = useSettingsStore();
    await store.init();

    store.update({ wpm_default: 420 });
    store.update({ font_size: 60 });
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPatch).toHaveBeenCalledTimes(1);
    const arg = mockPatch.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.wpm_default).toBe(420);
    expect(arg.font_size).toBe(60);
  });

  it("syncs the i18n locale when the language setting changes", async () => {
    mockSettingsDoc();
    const store = useSettingsStore();
    await store.init();

    store.update({ language: "es" });
    expect(i18n.global.locale.value).toBe("es");

    store.update({ language: "en" });
    expect(i18n.global.locale.value).toBe("en");
  });
});