import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ReadingContainer from "./ReadingContainer.vue";
import { i18n } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { PdfStreamer } from "../../documents/pdfStreamer";
import { makeMockPdf, makeMockLoadingTask } from "../../documents/testHelpers";
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
    language: "en",
  };
  const wrapper = mount(ReadingContainer, {
    global: { plugins: [pinia, i18n] },
  });
  await flushPromises();
  return { wrapper, settings, pinia };
}

const PDF_DOC_WITH_SECTIONS: ParsedDocument = {
  title: "Test PDF",
  file_path: "/test.pdf",
  file_type: "pdf",
  language: "en",
  streamer: new PdfStreamer(makeMockPdf([
    "Page one text here.",
    "Page two text here.",
    "Page three text here.",
  ]), makeMockLoadingTask()),
};

const PDF_DOC_WITH_EMPTY_PAGE: ParsedDocument = {
  title: "Scanned PDF",
  file_path: "/scanned.pdf",
  file_type: "pdf",
  language: "en",
  streamer: new PdfStreamer(makeMockPdf([
    "Page one text here.",
    "",
    "Page three text here.",
  ]), makeMockLoadingTask()),
};

async function mountWithPdfDoc() {
  mockLoadDocumentFromDialog.mockResolvedValue(PDF_DOC_WITH_SECTIONS);
  const { wrapper, settings, pinia } = await mountReader();

  const documentsStore = useDocumentsStore();
  const progressStore = useProgressStore();
  vi.spyOn(documentsStore, "saveDocument").mockResolvedValue({
    id: "test-id",
    title: "Test PDF",
    section_count: 3,
    file_path: "/test.pdf",
    created_date: "",
    modified_date: "",
    file_type: "pdf",
    language: "en",
  });
  vi.spyOn(progressStore, "loadProgress").mockResolvedValue({ sectionIndex: 0, blockIndex: 0 });

  await wrapper.find('button[aria-label="Open file"]').trigger("click");
  await flushPromises();
  return { wrapper, settings, pinia };
}

async function mountWithEmptyPagePdf() {
  mockLoadDocumentFromDialog.mockResolvedValue(PDF_DOC_WITH_EMPTY_PAGE);
  const { wrapper, settings, pinia } = await mountReader();

  const documentsStore = useDocumentsStore();
  const progressStore = useProgressStore();
  vi.spyOn(documentsStore, "saveDocument").mockResolvedValue({
    id: "empty-id",
    title: "Scanned PDF",
    section_count: 3,
    file_path: "/scanned.pdf",
    created_date: "",
    modified_date: "",
    file_type: "pdf",
    language: "en",
  });
  vi.spyOn(progressStore, "loadProgress").mockResolvedValue({ sectionIndex: 0, blockIndex: 0 });

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
    expect(progress.text()).toMatch(/^¶ 1 \/ \d+ · \d+%$/);
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

  it("Next block while playing pauses and does not auto-advance", async () => {
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    // Paused at block 2; advancing time must not auto-advance to block 3.
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find('button[aria-label="Play"]').text()).toBe("Resume");
    expect(wrapper.find('[data-testid="block-counter"]').text()).toMatch(/^block 2 \/ \d+$/);
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
    expect(progress.text()).toMatch(/^Page 1 · ¶ \d+ · \d+%$/);
  });

  it("next page button advances to the second page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
    expect(wrapper.find('[data-testid="progress"]').text()).toMatch(/^Page 2 · ¶ \d+ · \d+%$/);
  });

  it("turning the page persists progress for the open document", async () => {
    const { wrapper, pinia } = await mountWithPdfDoc();
    const progressStore = useProgressStore(pinia);
    const saveSpy = vi.spyOn(progressStore, "saveProgress").mockResolvedValue(undefined);

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();

    expect(saveSpy).toHaveBeenCalledWith("test-id", 1, 0, 3, expect.any(Number));
  });

  it("updates the completion preview as blocks advance", async () => {
    const { wrapper, pinia } = await mountWithPdfDoc();
    const progressStore = useProgressStore(pinia);

    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();

    // Page 1, block 2 of 2 → (0 + 1/2) / 3 ≈ 17%.
    expect(progressStore.progressByDocId["test-id"]).toBe(17);
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
    expect(wrapper.find('[data-testid="progress"]').text()).toMatch(/^Page 3 · ¶ \d+ · \d+%$/);
  });
});

describe("ReadingContainer — cross-section auto-advance", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("auto-advances to the next section when playback reaches the last block", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");

    // Page 1: "Page one text here." → 2 blocks.
    // Block 0: ["Page","one","text"] → 200ms (no pause).
    // Block 1: ["here."] → 200ms * 2.5 (period) = 500ms.
    // sectionEnd fires at 200+500=700ms. Next section (preloaded) replaces
    // blocks and schedules timer at 700+200=900ms.
    // Advance 800ms: sectionEnd has fired, we're on page 2, block 0.
    await vi.advanceTimersByTimeAsync(800);

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
  });

  it("Next page while playing pauses at the new page", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
    expect(wrapper.find('button[aria-label="Play"]').text()).toBe("Resume");
    // Paused: the page does not auto-advance further while time passes.
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
  });

  it("keeps the last block when playback reaches the end of the last section", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();

    // Each page: block0 = 200ms, block1 ("here.", period x2.5) = 500ms, so a
    // page is ~700ms. Play through all three pages and past the final block.
    await vi.advanceTimersByTimeAsync(3000);

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("3");
    expect(wrapper.find('[data-testid="block-counter"]').text()).toBe("block 2 / 2");
    // Playback stopped at end-of-content (not paused/playing).
    expect(wrapper.find('button[aria-label="Pause"]').exists()).toBe(false);
    // Nothing left to resume: Play is disabled at the end.
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeDefined();

    // Next block at the end stays at the end (still finished, Play disabled).
    await wrapper.find('button[aria-label="Next block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toBe("block 2 / 2");
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeDefined();
  });

  it("re-enables Play after navigating back a block from the end", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeDefined();

    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.find('[data-testid="block-counter"]').text()).toBe("block 1 / 2");
  });

  it("re-enables Play after navigating to another page from the end", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeDefined();

    await wrapper.find('button[aria-label="Previous page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('button[aria-label="Play"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
  });

  it("wraps prev() from first block of a section to the last block of the previous section", async () => {
    const { wrapper } = await mountWithPdfDoc();
    await flushPromises();

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");

    await wrapper.find('button[aria-label="Previous block"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");
    const counter = wrapper.find('[data-testid="block-counter"]').text();
    const blockNum = parseInt(counter.match(/^block (\d+) \//)![1], 10);
    expect(blockNum).toBeGreaterThan(1);
  });
});

describe("ReadingContainer — empty page handling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows empty page message when navigating to an empty page", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    // Page 1 has text, page 2 is empty.
    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="empty-page"]').text()).toBe("Page 2 has no text content");
  });

  it("shows 'no text' in progress label for empty pages", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="progress"]').text()).toBe("Page 2 · no text");
  });

  it("can navigate past an empty page with next page button", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(false);
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("3");
  });

  it("can navigate back from an empty page with prev page button", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    await wrapper.find('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="Previous page"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(false);
    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("1");
  });

  it("pauses playback when auto-advancing into an empty page", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();

    // Page 1: "Page one text here." → 2 blocks.
    // Block 0: ["Page","one","text"] → 200ms.
    // Block 1: ["here."] → 200ms * 2.5 (period) = 500ms.
    // sectionEnd at 700ms → page 2 (empty, preloaded) → pause.
    await vi.advanceTimersByTimeAsync(800);

    expect(wrapper.find('input[aria-label="Page number"]').attributes("value")).toBe("2");
    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(true);
    // Playback should be paused, not playing.
    expect(wrapper.find('button[aria-label="Play"]').exists()).toBe(true);
  });

  it("page input can jump to an empty page", async () => {
    const { wrapper } = await mountWithEmptyPagePdf();
    await flushPromises();

    const input = wrapper.find('input[aria-label="Page number"]');
    await input.setValue("2");
    await input.trigger("change");
    await flushPromises();

    expect(wrapper.find('[data-testid="empty-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="progress"]').text()).toBe("Page 2 · no text");
  });
});

function makePdfDoc(title: string, pages: string[]): { doc: ParsedDocument; destroy: ReturnType<typeof vi.fn> } {
  const loadingTask = makeMockLoadingTask();
  const streamer = new PdfStreamer(makeMockPdf(pages), loadingTask);
  return {
    doc: { title, file_path: `/${title}.pdf`, file_type: "pdf", language: "en", streamer },
    destroy: loadingTask.destroy as ReturnType<typeof vi.fn>,
  };
}

async function mountWithDoc(
  doc: ParsedDocument,
  id: string,
): Promise<{ wrapper: ReturnType<typeof mount>; settings: ReturnType<typeof useSettingsStore>; pinia: ReturnType<typeof createPinia> }> {
  mockLoadDocumentFromDialog.mockResolvedValue(doc);
  const { wrapper, settings, pinia } = await mountReader();

  const documentsStore = useDocumentsStore();
  const progressStore = useProgressStore();
  vi.spyOn(documentsStore, "saveDocument").mockResolvedValue({
    id,
    title: doc.title,
    section_count: doc.streamer.sectionCount,
    file_path: doc.file_path,
    created_date: "",
    modified_date: "",
    file_type: "pdf",
    language: "en",
  });
  vi.spyOn(progressStore, "loadProgress").mockResolvedValue({ sectionIndex: 0, blockIndex: 0 });

  await wrapper.find('button[aria-label="Open file"]').trigger("click");
  await flushPromises();
  return { wrapper, settings, pinia };
}

describe("ReadingContainer — streamer lifecycle", () => {
  it("closes the previous streamer when opening a new document", async () => {
    const first = makePdfDoc("First Doc", ["First page text."]);
    const { wrapper } = await mountWithDoc(first.doc, "first-id");
    await flushPromises();

    const second = makePdfDoc("Second Doc", ["Second page text."]);
    mockLoadDocumentFromDialog.mockResolvedValue(second.doc);
    const documentsStore = useDocumentsStore();
    vi.spyOn(documentsStore, "saveDocument").mockResolvedValue({
      id: "second-id",
      title: "Second Doc",
      section_count: 1,
      file_path: "/Second Doc.pdf",
      created_date: "",
      modified_date: "",
      file_type: "pdf",
      language: "en",
    });

    await wrapper.find('button[aria-label="Open file"]').trigger("click");
    await flushPromises();

    expect(first.destroy).toHaveBeenCalled();
  });

  it("closes the streamer on component unmount", async () => {
    const { doc, destroy } = makePdfDoc("Unmount Doc", ["Only page text."]);
    const { wrapper } = await mountWithDoc(doc, "unmount-id");
    await flushPromises();

    wrapper.unmount();
    await flushPromises();

    expect(destroy).toHaveBeenCalled();
  });

  it("closes the streamer on beforeunload", async () => {
    const { doc, destroy } = makePdfDoc("Unload Doc", ["Only page text."]);
    await mountWithDoc(doc, "unload-id");
    await flushPromises();

    window.dispatchEvent(new Event("beforeunload"));
    await flushPromises();

    expect(destroy).toHaveBeenCalled();
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

describe("ReadingContainer — a load pauses playback and keeps the document", () => {
  it("pauses playback and keeps the document while the picker is open and on cancel", async () => {
    let resolveDialog!: (v: null) => void;
    mockLoadDocumentFromDialog.mockImplementation(
      () => new Promise((r) => { resolveDialog = r; }),
    );
    const { wrapper } = await mountReader();
    await wrapper.find('button[aria-label="Play"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('button[aria-label="Pause"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="Open file"]').trigger("click");
    await flushPromises();

    // Spinner shows and playback pauses (Resume) while picking.
    expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Play"]').text()).toBe("Resume");

    resolveDialog(null); // cancel
    await flushPromises();

    // Loader gone; the document is kept (content restored, not the empty prompt)
    // and playback stays paused.
    expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Play"]').text()).toBe("Resume");
    expect(wrapper.find('[aria-label="Reading area"] p.font-semibold').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Reading area"]').text()).not.toContain("Load a document to start reading.");
  });

  it("keeps the document after a cancelled dialog when not playing", async () => {
    mockLoadDocumentFromDialog.mockResolvedValue(null);
    const { wrapper } = await mountReader();
    expect(wrapper.find('[aria-label="Reading area"] p.font-semibold').exists()).toBe(true);

    await wrapper.find('button[aria-label="Open file"]').trigger("click");
    await flushPromises();

    // Pause is a no-op when not playing; the current document content remains.
    expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Reading area"] p.font-semibold').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Reading area"]').text()).not.toContain("Load a document to start reading.");
  });
});
