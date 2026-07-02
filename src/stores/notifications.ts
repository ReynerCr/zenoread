import { defineStore } from "pinia";
import { ref } from "vue";

export type NotificationLevel = "info" | "error";

export interface Notification {
  id: number;
  level: NotificationLevel;
  message: string;
}

/**
 * Minimal, MVP-level notification + error surface. Components subscribe to the
 * list to display toasts/banners. A fuller error-handling system (logging,
 * recovery mode, graceful degradation) is planned for Phase 4.
 */
export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref<Notification[]>([]);
  let nextId = 1;

  function push(message: string, level: NotificationLevel = "info"): number {
    const id = nextId++;
    items.value.push({ id, level, message });
    return id;
  }

  function dismiss(id: number): void {
    items.value = items.value.filter((n) => n.id !== id);
  }

  function clear(): void {
    items.value = [];
  }

  return { items, push, dismiss, clear };
});
