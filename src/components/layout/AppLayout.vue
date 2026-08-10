<script setup lang="ts">
import { ref } from "vue";
import ReadingContainer from "../reader/ReadingContainer.vue";
import SettingsSidebar from "./SettingsSidebar.vue";
import RecentDocuments from "./RecentDocuments.vue";

const settingsOpen = ref(false);
const recentOpen = ref(false);
const readerRef = ref<InstanceType<typeof ReadingContainer> | null>(null);

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function toggleRecent() {
  recentOpen.value = !recentOpen.value;
}

function handleOpenDoc(docId: string) {
  readerRef.value?.openFromLibrary(docId);
}
</script>

<template>
  <div class="flex h-full w-full flex-col bg-zeno-bg text-zeno-text">
    <header
      class="flex items-center justify-between border-b border-zeno-border bg-zeno-surface px-4 py-2"
    >
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold tracking-wide">ZenoRead</span>
        <button
          class="rounded-md px-2 py-1 text-xs text-zeno-muted hover:bg-zeno-bg hover:text-zeno-text"
          aria-label="Toggle recent documents"
          @click="toggleRecent"
        >
          📂 Recent
        </button>
      </div>
      <button
        class="rounded-md px-3 py-1 text-sm text-zeno-muted hover:bg-zeno-bg hover:text-zeno-text"
        aria-label="Toggle settings"
        @click="toggleSettings"
      >
        ☰ Settings
      </button>
    </header>

    <div class="flex min-h-0 flex-1">
      <RecentDocuments
        :open="recentOpen"
        @close="recentOpen = false"
        @open-doc="handleOpenDoc"
      />
      <main class="min-w-0 flex-1">
        <ReadingContainer ref="readerRef" />
      </main>
      <SettingsSidebar
        :open="settingsOpen"
        @close="settingsOpen = false"
      />
    </div>
  </div>
</template>
