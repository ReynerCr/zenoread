<script setup lang="ts">
defineProps<{
  isPlaying: boolean;
  isPaused: boolean;
  isFinished: boolean;
  hasSections: boolean;
  currentPage: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  "toggle-play-pause": [];
  stop: [];
  "next-block": [];
  "prev-block": [];
  "prev-page": [];
  "next-page": [];
  "page-input": [value: string];
}>();

function onPageInput(event: Event) {
  emit("page-input", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div v-if="hasSections" class="flex items-center gap-1" data-testid="page-nav">
    <button
      class="rounded-md border border-zeno-border px-2 py-1 text-xs text-zeno-text hover:bg-zeno-surface disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label="Previous page"
      :disabled="currentPage <= 1"
      @click="emit('prev-page')"
    >
      ◀
    </button>
    <input
      type="number"
      :min="1"
      :max="totalPages"
      :value="currentPage"
      class="w-12 rounded-md border border-zeno-border bg-zeno-bg px-2 py-1 text-center text-xs text-zeno-text tabular-nums"
      aria-label="Page number"
      @change="onPageInput"
    />
    <span class="text-xs text-zeno-muted tabular-nums">/ {{ totalPages }}</span>
    <button
      class="rounded-md border border-zeno-border px-2 py-1 text-xs text-zeno-text hover:bg-zeno-surface disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label="Next page"
      :disabled="currentPage >= totalPages"
      @click="emit('next-page')"
    >
      ▶
    </button>
  </div>

  <div class="flex items-center gap-2">
    <button
      class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
      aria-label="Previous block"
      @click="emit('prev-block')"
    >
      ◀
    </button>
    <button
      class="rounded-md border border-zeno-border px-4 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface disabled:opacity-30 disabled:cursor-not-allowed"
      :aria-label="isPlaying ? 'Pause' : 'Play'"
      :disabled="isFinished"
      @click="emit('toggle-play-pause')"
    >
      {{ isPlaying ? "Pause" : isPaused ? "Resume" : "Play" }}
    </button>
    <button
      class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
      aria-label="Stop"
      @click="emit('stop')"
    >
      Stop
    </button>
    <button
      class="rounded-md border border-zeno-border px-3 py-1.5 text-sm text-zeno-text hover:bg-zeno-surface"
      aria-label="Next block"
      @click="emit('next-block')"
    >
      ▶
    </button>
  </div>
</template>