import { defineStore } from "pinia";
import { ref } from "vue";

export type NotificationLevel = "info" | "error";

export interface Notification {
  id: number;
  level: NotificationLevel;
  message: string;
}

/**
 * Holds transient notifications (toasts/banners) for the UI.
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
