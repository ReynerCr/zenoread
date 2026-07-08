import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";
import { isTauri } from "../utils/platform";
import type { ParsedDocument } from "../documents/types";
import { loadDocumentFromPath, loadDocumentFromFile } from "../documents/fileLoader";
import type { FileType } from "../db/schemas/documents.schema";
import { reportError } from "../utils/errors";

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  txt: "txt",
  md: "md",
  pdf: "pdf",
  epub: "epub",
};

function detectFileType(filename: string): FileType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] ?? null;
}

/**
 * Provides drag-and-drop file loading. On Tauri, uses the webview's
 * `onDragDropEvent` to get file paths. On web, uses HTML5 drag-and-drop
 * events on the target element to get File objects.
 *
 * @param target Ref to the DOM element to use as the drop zone (web mode only).
 * @param onLoaded Callback invoked with the parsed document.
 */
export function useDragDrop(
  target: Ref<HTMLElement | null>,
  onLoaded: (doc: ParsedDocument) => void,
) {
  const isDragOver = ref(false);

  let unlistenTauri: (() => void) | null = null;

  // --- Tauri path ---
  async function setupTauri() {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    unlistenTauri = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        isDragOver.value = true;
      } else if (event.payload.type === "leave") {
        isDragOver.value = false;
      } else if (event.payload.type === "drop") {
        isDragOver.value = false;
        const paths = event.payload.paths;
        if (paths.length === 0) return;
        void handleTauriDrop(paths[0]);
      }
    });
  }

  async function handleTauriDrop(filePath: string) {
    const fileType = detectFileType(filePath);
    if (!fileType) {
      reportError(new Error(`Unsupported file type: ${filePath}`), undefined, { context: "useDragDrop.handleTauriDrop" });
      return;
    }
    const doc = await loadDocumentFromPath(filePath, fileType, "en");
    if (doc) onLoaded(doc);
  }

  // --- Web path ---
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    isDragOver.value = true;
  }

  function onDragLeave(e: DragEvent) {
    // Only clear when leaving the container entirely (relatedTarget is null).
    if (!e.relatedTarget) isDragOver.value = false;
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const doc = await loadDocumentFromFile(file);
    if (doc) onLoaded(doc);
  }

  onMounted(() => {
    if (isTauri()) {
      void setupTauri();
    } else {
      const el = target.value;
      if (!el) return;
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("dragleave", onDragLeave);
      el.addEventListener("drop", onDrop);
    }
  });

  onBeforeUnmount(() => {
    if (unlistenTauri) unlistenTauri();
    const el = target.value;
    if (el) {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    }
  });

  return { isDragOver };
}
