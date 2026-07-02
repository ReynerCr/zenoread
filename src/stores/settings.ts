import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

import { getDatabase } from "../db/database";
import {
  DEFAULT_USER_SETTINGS,
  SETTINGS_SINGLETON_ID,
  type UserSettingsDocType,
} from "../db/schemas/userSettings.schema";
import { reportError } from "../utils/errors";

/**
 * Holds the single UserSettings document, keeps it in sync with RxDB, and
 * reflects presentation settings (theme, font) onto the document element.
 */
export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<UserSettingsDocType>({ ...DEFAULT_USER_SETTINGS });
  const loaded = ref(false);

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

  /** Persists a partial update to the settings document. */
  async function update(patch: Partial<Omit<UserSettingsDocType, "id">>): Promise<void> {
    // Optimistically update the UI.
    settings.value = { ...settings.value, ...patch };
    try {
      const db = await getDatabase();
      const doc = await db.user_settings
        .findOne({ selector: { id: SETTINGS_SINGLETON_ID } })
        .exec();
      if (doc) {
        await doc.patch(patch);
      } else {
        await db.user_settings.insert({ ...settings.value });
      }
    } catch (error) {
      reportError(error, "Could not save your settings.");
    }
  }

  function toggleTheme(): void {
    void update({ theme: settings.value.theme === "dark" ? "light" : "dark" });
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
