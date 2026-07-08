import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ReadingContainer from "./ReadingContainer.vue";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentsStore } from "../../stores/documents";

// Mount the component with a fresh Pinia and initialized settings store.
async function mountReader() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const settings = useSettingsStore();
  settings.settings = {
    id: "user-settings",
    wpm_default: 300,
    max_words_screen: 3,
    min_words_screen: 1,
    theme: "dark",
    pause_multipliers: {
      period: 2.5,
      comma: 1.5,
      semicolon: 1.8,
      colon: 1.8,
      question: 2.5,
      exclamation: 2.5,
      paragraph: 3,
    },
    font_size: 48,
    font_family: "system-ui",
    split_on_sentence_end: true,
  };
  const wrapper = mount(ReadingContainer, {
    global: { plugins: [pinia] },
  });
  await flushPromises();
  return { wrapper, settings };
}

describe("ReadingContainer — rendering", () => {
  it("renders the first block's words on mount", async () => {
    const { wrapper } = await mountReader();
    const wordEl = wrapper.find('[aria-label="Reading area"] p.font-semibold');
    expect(wordEl.exists()).toBe(true);
    expect(wordEl.text().length).toBeGreaterThan(0);
  });

  it("shows progress as 1 / total on mount", async () => {
    const { wrapper } = await mountReader();
    const progress = wrapper.find(".tabular-nums");
    expect(progress.exists()).toBe(true);
    expect(progress.text()).toMatch(/^1 \/ \d+$/);
  });

  it("applies font size and family from settings", async () => {
    const { wrapper, settings } = await mountReader();
    const wordEl = wrapper.find("p.font-semibold");
    expect(wordEl.attributes("style")).toContain("font-size: 48px");
    expect(wordEl.attributes("style")).toContain("font-family: system-ui");
    // Change settings and confirm reactivity.
    settings.settings.font_size = 72;
    settings.settings.font_family = "Georgia";
    await flushPromises();
    expect(wrapper.find("p.font-semibold").attributes("style")).toContain("font-size: 72px");
    expect(wrapper.find("p.font-semibold").attributes("style")).toContain("font-family: Georgia");
  });
});

describe("ReadingContainer — playback controls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("Play button starts playback and changes label to Pause", async () => {
    const { wrapper } = await mountReader();
    const playBtn = wrapper.find('button[aria-label="Play"]');
    expect(playBtn.exists()).toBe(true);
    expect(playBtn.text()).toBe("Play");
    await playBtn.trigger("click");
    await flushPromises();
    const pauseBtn = wrapper.find('button[aria-label="Pause"]');
    expect(pauseBtn.exists()).toBe(true);
    expect(pauseBtn.text()).toBe("Pause");
  });

  it("Pause button pauses and label changes to Resume", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();
    await wrapper.find('button[aria-label="Pause"]').trigger("click");
    await flushPromises();
    const resumeBtn = wrapper.find('button[aria-label="Play"]');
    expect(resumeBtn.exists()).toBe(true);
    expect(resumeBtn.text()).toBe("Resume");
  });

  it("Stop button resets to the first block", async () => {
    const { wrapper } = await mountReader();
    // Skip forward a few blocks.
    const nextBtn = wrapper.find('button[aria-label="Next block"]');
    await nextBtn.trigger("click");
    await nextBtn.trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).not.toBe("1 / " + wrapper.find(".tabular-nums").text().split(" / ")[1]);
    // Stop.
    await wrapper.find('button[aria-label="Stop"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^1 \/ \d+$/);
  });
});

describe("ReadingContainer — navigation", () => {
  it("Next button advances to the second block", async () => {
    const { wrapper } = await mountReader();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^1 \/ /);
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^2 \/ /);
  });

  it("Previous button goes back", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^2 \/ /);
    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^1 \/ /);
  });

  it("Previous at first block stays at 1", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".tabular-nums").text()).toMatch(/^1 \/ /);
  });
});

describe("ReadingContainer — loading state", () => {
  it("shows loading indicator and disables open button when isLoading is true", async () => {
    const { wrapper } = await mountReader();
    const documentsStore = useDocumentsStore();
    documentsStore.isLoading = true;
    await flushPromises();
    expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Open file"]').attributes("disabled")).toBeDefined();
  });

  it("does not show loading indicator by default", async () => {
    const { wrapper } = await mountReader();
    expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(false);
  });
});
