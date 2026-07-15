<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useDocumentsStore } from "../../stores/documents";
import { isTauri } from "../../utils/platform";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void; (e: "open-doc", docId: string): void }>();

const documentsStore = useDocumentsStore();
const { isLoading } = storeToRefs(documentsStore);

const sortedDocs = computed(() =>
  [...documentsStore.documents].sort(
    (a, b) => new Date(b.modified_date).getTime() - new Date(a.modified_date).getTime(),
  ),
);

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function handleOpenDoc(docId: string) {
  emit("close");
  emit("open-doc", docId);
}
</script>

<template>
  <aside
    class="flex h-full flex-col border-r border-zeno-border bg-zeno-surface transition-all duration-200 overflow-hidden"
    :class="open ? 'w-64' : 'w-0'"
    aria-label="Recent documents"
  >
    <div class="flex w-64 flex-col gap-3 p-4">
      <header class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-zeno-muted">
          Recent
        </h2>
        <button
          class="rounded-md px-2 py-1 text-zeno-muted hover:text-zeno-text"
          aria-label="Close recent documents"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <template v-if="!isTauri()">
        <p class="text-xs text-zeno-muted">
          Recent documents are only available in the desktop app.
        </p>
      </template>

      <template v-else-if="sortedDocs.length === 0">
        <p class="text-xs text-zeno-muted">
          No documents yet. Open a file to get started.
        </p>
      </template>

      <ul v-else class="flex flex-col gap-1 overflow-y-auto">
        <li v-for="doc in sortedDocs" :key="doc.id">
          <button
            class="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-zeno-bg disabled:opacity-50 disabled:cursor-not-allowed"
            :aria-label="`Open ${doc.title}`"
            :disabled="isLoading"
            @click="handleOpenDoc(doc.id)"
          >
            <span class="truncate text-xs font-medium text-zeno-text">{{ doc.title }}</span>
            <span class="text-[10px] text-zeno-muted">
              {{ doc.section_count > 1 ? `${doc.section_count} pages` : "1 section" }} · {{ formatRelativeDate(doc.modified_date) }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
