import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsSidebar from "./SettingsSidebar.vue";
import { useSettingsStore } from "../../stores/settings";
import { DEFAULT_USER_SETTINGS } from "../../db/schemas/userSettings.schema";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
}));

describe("SettingsSidebar", () => {
  it("updates the font family from the selector", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settings = useSettingsStore();
    settings.settings = { ...DEFAULT_USER_SETTINGS };

    const wrapper = mount(SettingsSidebar, {
      props: { open: true },
      global: { plugins: [pinia] },
    });

    const select = wrapper.find("select#font-family");
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe("system-ui");

    await select.setValue("Georgia");
    expect(settings.settings.font_family).toBe("Georgia");
  });
});
