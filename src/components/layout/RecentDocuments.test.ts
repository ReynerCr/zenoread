import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RecentDocuments from "./RecentDocuments.vue";
import { useDocumentsStore } from "../../stores/documents";
import type { DocumentDocType } from "../../db/schemas/documents.schema";

const mockFind = vi.fn();
vi.mock("../../db/database", () => ({
  getDatabase: () =>
    Promise.resolve({
      reading_progress: { find: mockFind },
    }),
}));
vi.mock("../../utils/platform", () => ({ isTauri: () => true }));

function makeDoc(id: string, title: string): DocumentDocType {
  return {
    id,
    title,
    section_count: 3,
    file_path: `/${id}.txt`,
    created_date: "",
    modified_date: new Date().toISOString(),
    file_type: "txt",
    language: "en",
  };
}

describe("RecentDocuments", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockFind.mockReturnValue({ exec: () => Promise.resolve([]) });
  });

  it("shows the completion percentage for documents with progress", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documentsStore = useDocumentsStore();
    documentsStore.documents = [makeDoc("doc-1", "Alpha"), makeDoc("doc-2", "Beta")];

    mockFind.mockReturnValue({
      exec: () =>
        Promise.resolve([
          { toJSON: () => ({ document_id: "doc-1", completion_percentage: 43 }) },
        ]),
    });

    const wrapper = mount(RecentDocuments, {
      props: { open: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.find('button[aria-label="Open Alpha"]').text()).toContain("43%");
    expect(wrapper.find('button[aria-label="Open Beta"]').text()).not.toContain("%");
  });
});
