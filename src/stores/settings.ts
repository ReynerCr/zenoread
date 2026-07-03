import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

import { getDatabase } from "../db/database";
import {
  DEFAULT_USER_SETTINGS,
  SETTINGS_SINGLETON_ID,
  type UserSettingsDocType,
} from "../db/schemas/userSettings.schema";
import { reportError } from "../utils/errors";

const SAVE_DEBOUNCE_MS = 500;

/**
 * Holds the single UserSettings document, keeps it in sync with RxDB, and
 * reflects presentation settings (theme, font) onto the document element.
 */
export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<UserSettingsDocType>({ ...DEFAULT_USER_SETTINGS });
  const loaded = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const theme = computed(() => settings.value.theme);

  /** Loads (or seeds) the singleton settings document and subscribes to it. */
  async function init(): Promise<void> {
    if (loaded.value) return;
    try {
      const db = await getDatabase();
      let doc = await db.user_settings
        .findOne({ selector: { id: SETTINGS_SINGLETON_ID } })
        .exec();

      if (!doc) {
        doc = await db.user_settings.insert({ ...DEFAULT_USER_SETTINGS });
      }

      settings.value = doc.toJSON() as UserSettingsDocType;

      // Keep the local ref in sync with any future document changes.
      doc.$.subscribe((latest) => {
        if (latest) settings.value = latest.toJSON() as UserSettingsDocType;
      });

      loaded.value = true;
    } catch (error) {
      reportError(error, "Could not load your settings. Using defaults.");
      // Fall back to defaults so the app remains usable.
      settings.value = { ...DEFAULT_USER_SETTINGS };
      loaded.value = true;
    }
  }

  /** Persists the full settings document to RxDB (debounced). */
  async function flushSave(): Promise<void> {
    try {
      const db = await getDatabase();
      const doc = await db.user_settings
        .findOne({ selector: { id: SETTINGS_SINGLETON_ID } })
        .exec();
      if (doc) {
        await doc.patch(settings.value);
      } else {
        await db.user_settings.insert({ ...settings.value });
      }
    } catch (error) {
      reportError(error, "Could not save your settings.");
    }
  }

  /**
   * Optimistically updates the UI and schedules a debounced save to RxDB.
   * Rapid successive calls (e.g. dragging a slider) coalesce into a single
   * write after the user stops moving for SAVE_DEBOUNCE_MS.
   */
  function update(patch: Partial<Omit<UserSettingsDocType, "id">>): void {
    // Optimistically update the UI immediately.
    settings.value = { ...settings.value, ...patch };

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function toggleTheme(): void {
    update({ theme: settings.value.theme === "dark" ? "light" : "dark" });
  }

  // Reflect presentation settings onto the root element.
  watch(
    () => settings.value.theme,
    (value) => {
      document.documentElement.setAttribute("data-theme", value);
    },
    { immediate: true },
  );

  return { settings, loaded, theme, init, update, toggleTheme };
});
