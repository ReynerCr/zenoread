<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "./components/layout/AppLayout.vue";
import NotificationHost from "./components/NotificationHost.vue";
import { useSettingsStore } from "./stores/settings";

const settings = useSettingsStore();

onMounted(() => {
  void settings.init();
});
</script>

<template>
  <AppLayout />
  <NotificationHost />
</template>
