<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import AppLayout from "./components/layout/AppLayout.vue";
import NotificationHost from "./components/NotificationHost.vue";
import RecoveryDialog from "./components/RecoveryDialog.vue";
import { useSettingsStore } from "./stores/settings";
import { useDocumentsStore } from "./stores/documents";
import { useProgressStore } from "./stores/progress";
import { useErrorBoundary } from "./composables/useErrorBoundary";
import { runStartup, runShutdown } from "./utils/startup";

const settings = useSettingsStore();
const documents = useDocumentsStore();
const progress = useProgressStore();

const showRecoveryDialog = ref(false);

useErrorBoundary();

onMounted(async () => {
  const { dbOk } = await runStartup();
  if (!dbOk) {
    showRecoveryDialog.value = true;
    return;
  }

  await Promise.all([
    settings.init(),
    documents.init(),
    progress.init(),
  ]);
});

function handleBeforeUnload() {
  void runShutdown();
}

window.addEventListener("beforeunload", handleBeforeUnload);

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <AppLayout />
  <NotificationHost />
  <RecoveryDialog
    :show="showRecoveryDialog"
    @continue="showRecoveryDialog = false"
  />
</template>
