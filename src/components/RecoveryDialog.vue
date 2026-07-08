<script setup lang="ts">
import { ref } from "vue";
import { resetDatabase } from "../db/database";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: "continue"): void }>();

const resetting = ref(false);

async function handleReset() {
  resetting.value = true;
  try {
    await resetDatabase();
    setTimeout(() => window.location.reload(), 500);
  } catch {
    resetting.value = false;
  }
}

function handleContinue() {
  emit("continue");
}
</script>

<template>
  <div
    v-if="props.show"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
    role="alertdialog"
    aria-label="Storage problem"
    data-testid="recovery-dialog"
  >
    <div class="mx-4 max-w-md rounded-lg border border-zeno-border bg-zeno-surface p-6 shadow-xl">
      <h2 class="mb-3 text-lg font-semibold text-zeno-text">Storage problem detected</h2>
      <p class="mb-4 text-sm text-zeno-muted">
        ZenoRead couldn't access its local database. This can happen after a corrupted update or
        a browser data clear. Your reading data may be inaccessible.
      </p>
      <p class="mb-5 text-sm text-zeno-muted">
        You can reset all app data to start fresh, or continue without resetting. If you continue,
        some features may not work correctly until the issue is resolved.
      </p>
      <div class="flex justify-end gap-3">
        <button
          class="rounded-md border border-zeno-border px-4 py-2 text-sm text-zeno-muted hover:text-zeno-text"
          :disabled="resetting"
          @click="handleContinue"
        >
          Continue without resetting
        </button>
        <button
          class="rounded-md bg-red-500/80 px-4 py-2 text-sm text-white hover:bg-red-500"
          :disabled="resetting"
          @click="handleReset"
        >
          {{ resetting ? "Resetting..." : "Reset all data" }}
        </button>
      </div>
    </div>
  </div>
</template>
