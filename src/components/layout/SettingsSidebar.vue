<script setup lang="ts">
import { useSettingsStore } from "../../stores/settings";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settings = useSettingsStore();

function onWpmInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isNaN(value)) void settings.update({ wpm_default: value });
}

function onMaxWordsInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isNaN(value)) void settings.update({ max_words_screen: value });
}

function onFontSizeInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isNaN(value)) void settings.update({ font_size: value });
}
</script>

<template>
  <aside
    class="flex h-full flex-col border-l border-zeno-border bg-zeno-surface transition-all duration-200 overflow-hidden"
    :class="open ? 'w-72' : 'w-0'"
    aria-label="Settings"
  >
    <div class="flex w-72 flex-col gap-6 p-5">
      <header class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-zeno-muted">
          Settings
        </h2>
        <button
          class="rounded-md px-2 py-1 text-zeno-muted hover:text-zeno-text"
          aria-label="Close settings"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-zeno-muted">
          Reading speed (WPM): {{ settings.settings.wpm_default }}
        </label>
        <input
          type="range"
          min="100"
          max="1000"
          step="10"
          :value="settings.settings.wpm_default"
          class="accent-zeno-accent"
          @input="onWpmInput"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-zeno-muted">
          Words per screen: {{ settings.settings.max_words_screen }}
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          :value="settings.settings.max_words_screen"
          class="accent-zeno-accent"
          @input="onMaxWordsInput"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-zeno-muted">
          Font size: {{ settings.settings.font_size }}px
        </label>
        <input
          type="range"
          min="16"
          max="120"
          step="2"
          :value="settings.settings.font_size"
          class="accent-zeno-accent"
          @input="onFontSizeInput"
        />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zeno-muted">Theme</span>
        <button
          class="rounded-md border border-zeno-border px-3 py-1 text-sm text-zeno-text hover:bg-zeno-bg"
          @click="settings.toggleTheme()"
        >
          {{ settings.theme === "dark" ? "Dark" : "Light" }}
        </button>
      </div>
    </div>
  </aside>
</template>
