import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ReadingContainer from "./ReadingContainer.vue";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { PdfStreamer } from "../../documents/pdfStreamer";
import type { ParsedDocument } from "../../documents/types";

const mockLoadDocumentFromDialog = vi.hoisted(() => vi.fn());
vi.mock("../../documents/fileLoader", () => ({
  loadDocumentFromDialog: mockLoadDocumentFromDialog,
  loadDocumentFromPath: vi.fn(),
}));

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
    show_block_counter: true,
  };
  const wrapper = mount(ReadingContainer, {
    global: { plugins: [pinia] },
  });
  await flushPromises();
  return { wrapper, settings, pinia };
}

const PDF_DOC_WITH_SECTIONS: ParsedDocument = {
  title: "Test PDF",
  content_raw: "Page one text here.\n\nPage two text here.\n\nPage three text here.",
  total_words: 12,
  file_path: "/test.pdf",
  file_type: "pdf",
  language: "en",
  streamer: new PdfStreamer([
    "Page one text here.",
    "Page two text here.",
    "Page three text here.",
  ]),
};

async function mountWithPdfDoc() {
  mockLoadDocumentFromDialog.mockResolvedValue(PDF_DOC_WITH_SECTIONS);
  const { wrapper, settings, pinia } = await mountReader();

  const documentsStore = useDocumentsStore();
  const progressStore = useProgressStore();
  vi.spyOn(documentsStore, "saveDocument").mockResolvedValue({
    id: "test-id",
    title: "Test PDF",
    total_words: 12,
    file_path: "/test.pdf",
    created_date: "",
    modified_date: "",
    file_type: "pdf",
    language: "en",
  });
  vi.spyOn(progressStore, "loadProgress").mockResolvedValue(0);

  await wrapper.find('button[aria-label="Open file"]').trigger("click");
  await flushPromises();
  return { wrapper, settings, pinia };
}

describe("ReadingContainer — rendering", () => {
  it("renders the first block's words on mount", async () => {
    const { wrapper } = await mountReader();
    const wordEl = wrapper.find('[aria-label="Reading area"] p.font-semibold');
    expect(wordEl.exists()).toBe(true);
    expect(wordEl.text().length).toBeGreaterThan(0);
  });

  it("shows paragraph-based progress for sample text", async () => {
    const { wrapper } = await mountReader();
    const progress = wrapper.find('[data-testid="progress"]');
    expect(progress.exists()).toBe(true);
    expect(progress.text()).toMatch(/^¶ 1 \/ \d+$/);
  });

  it("shows block counter when setting is enabled", async () => {
    const { wrapper } = await mountReader();
    const counter = wrapper.find('[data-testid="block-counter"]');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toMatch(/^block 1 \/ \d+$/);
  });

  it("hides block counter when setting is disabled", async () => {
    const { wrapper, settings } = await mountReader();
    settings.settings.show_block_counter = false;
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').exists()).toBe(false);
  });

  it("hides page navigation when no sections", async () => {
    const { wrapper } = await mountReader();
    expect(wrapper.find('[data-testid="page-nav"]').exists()).toBe(false);
  });

  it("applies font size and family from settings", async () => {
    const { wrapper, settings } = await mountReader();
    const wordEl = wrapper.find("p.font-semibold");
    expect(wordEl.attributes("style")).toContain("font-size: 48px");
    expect(wordEl.attributes("style")).toContain("font-family: system-ui");
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
    const nextBtn = wrapper.find('button[aria-label="Next block"]');
    await nextBtn.trigger("click");
    await nextBtn.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).not.toBe("block 1 / " + wrapper.find('[data-testid="block-counter"]').text().split(" / ")[1]);
    await wrapper.find('button[aria-label="Stop"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 1 \/ \d+$/);
  });
});

describe("ReadingContainer — block navigation", () => {
  it("Next button advances to the second block", async () => {
    const { wrapper } = await mountReader();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 1 \/ /);
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 2 \/ /);
  });

  it("Previous button goes back", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 2 \/ /);
    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 1 \/ /);
  });

  it("Previous at first block stays at 1", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 1 \/ /);
  });
});

describe("ReadingContainer — page navigation", () => {
  it("shows page navigation when sections are loaded", async () => {
    const { wrapper } = await mountWithPdfDoc();
    expect(wrapper.find('[data-testid="page-nav"]').exists()).toBe(true);
  });

  it("shows page-based progress when sections are loaded", async () => {
    const { wrapper } = await mountWithPdfDoc();
    const progress = wrapper.find('[data-testid="progress"]');
    expect(progress.text()).toMatch(/^Page 1 · ¶ \d+$/);
  });

  it("next page button advances to the second page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
    expect(wrapper.find('[data-testid="progress"]').text()).toMatch(/^Page 2 · ¶ \d+$/);
  });

  it("prev page button goes back to the first page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    await wrapper.find('button[aria-label="Previous page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");
  });

  it("prev page is disabled on the first page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    expect(wrapper.find('button[aria-label="Previous page"]').attributes("disabled")).toBeDefined();
  });

  it("next page is disabled on the last page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('button[aria-label="Next page"]').attributes("disabled")).toBeDefined();
  });

  it("page input jumps to the entered page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    const input = wrapper.find('input[aria-label="Page number"]');
    await input.setValue("3");
    await input.trigger("change");
    await flushPromises();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("3");
    expect(wrapper.find('[data-testid="progress"]').text()).toMatch(/^Page 3 · ¶ \d+$/);
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
