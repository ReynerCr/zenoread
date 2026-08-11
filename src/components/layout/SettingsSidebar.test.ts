import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsSidebar from "./SettingsSidebar.vue";
import { i18n } from "../../i18n";
import es from "../../i18n/es.json";
import { useSettingsStore } from "../../stores/settings";
import { DEFAULT_USER_SETTINGS } from "../../db/schemas/userSettings.schema";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
}));

afterEach(() => {
  i18n.global.locale.value = "en";
});

describe("SettingsSidebar", () => {
  it("updates the font family from the selector", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settings = useSettingsStore();
    settings.settings = { ...DEFAULT_USER_SETTINGS };

    const wrapper = mount(SettingsSidebar, {
      props: { open: true },
      global: { plugins: [pinia, i18n] },
    });

    const select = wrapper.find("select#font-family");
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe("system-ui");

    await select.setValue("Georgia");
    expect(settings.settings.font_family).toBe("Georgia");
  });

  it("renders Spanish labels when the locale is 'es'", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settings = useSettingsStore();
    settings.settings = { ...DEFAULT_USER_SETTINGS };
    // Switch after store creation: the store's immediate locale watch would
    // reset the locale to the default settings value.
    i18n.global.locale.value = "es";

    const wrapper = mount(SettingsSidebar, {
      props: { open: true },
      global: { plugins: [pinia, i18n] },
    });

    expect(wrapper.find("h2").text()).toBe(es["settings.title"]);
    expect(wrapper.find("header button").attributes("aria-label")).toBe(es["settings.close"]);
  });
});
