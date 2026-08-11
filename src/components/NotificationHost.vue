<script setup lang="ts">
import { useNotificationsStore } from "../stores/notifications";

const notifications = useNotificationsStore();
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <div
      v-for="n in notifications.items"
      :key="n.id"
      class="pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
      :class="
        n.level === 'error'
          ? 'border-red-500/40 bg-red-500/10 text-red-200'
          : 'border-zeno-border bg-zeno-surface text-zeno-text'
      "
      role="status"
    >
      <span class="flex-1">{{ n.message }}</span>
      <button
        class="text-zeno-muted hover:text-zeno-text"
        :aria-label="$t('notifications.dismiss')"
        @click="notifications.dismiss(n.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
