<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "./components/layout/AppLayout.vue";
import NotificationHost from "./components/NotificationHost.vue";
import { useSettingsStore } from "./stores/settings";
import { useDocumentsStore } from "./stores/documents";
import { useProgressStore } from "./stores/progress";

const settings = useSettingsStore();
const documents = useDocumentsStore();
const progress = useProgressStore();

onMounted(() => {
  void settings.init();
  void documents.init();
  void progress.init();
});
</script>

<template>
  <AppLayout />
  <NotificationHost />
</template>
