<script setup lang="ts">
import { ref } from "vue";
import ReadingContainer from "../reader/ReadingContainer.vue";
import SettingsSidebar from "./SettingsSidebar.vue";

const sidebarOpen = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
</script>

<template>
  <div class="flex h-full w-full flex-col bg-zeno-bg text-zeno-text">
    <header
      class="flex items-center justify-between border-b border-zeno-border bg-zeno-surface px-4 py-2"
    >
      <span class="text-sm font-semibold tracking-wide">ZenoRead</span>
      <button
        class="rounded-md px-3 py-1 text-sm text-zeno-muted hover:bg-zeno-bg hover:text-zeno-text"
        aria-label="Toggle settings"
        @click="toggleSidebar"
      >
        ☰ Settings
      </button>
    </header>

    <div class="flex min-h-0 flex-1">
      <main class="min-w-0 flex-1">
        <ReadingContainer />
      </main>
      <SettingsSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </div>
  </div>
</template>
