<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore } from "../../stores/settings";
import {
  DEFAULT_PAUSE_MULTIPLIERS,
  type PauseMultipliers,
} from "../../db/schemas/userSettings.schema";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settings = useSettingsStore();
const advancedOpen = ref(false);

const PAUSE_FIELDS: { key: keyof PauseMultipliers; label: string }[] = [
  { key: "period", label: "Period" },
  { key: "comma", label: "Comma" },
  { key: "semicolon", label: "Semicolon" },
  { key: "colon", label: "Colon" },
  { key: "question", label: "Question" },
  { key: "exclamation", label: "Exclamation" },
  { key: "paragraph", label: "Paragraph" },
];

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

function onPauseInput(key: keyof PauseMultipliers, event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isNaN(value)) return;
  void settings.update({
    pause_multipliers: { ...settings.settings.pause_multipliers, [key]: value },
  });
}

function resetPauses() {
  void settings.update({
    pause_multipliers: { ...DEFAULT_PAUSE_MULTIPLIERS },
  });
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

      <div class="flex items-center justify-between">
        <label
          class="text-xs font-medium text-zeno-muted"
          for="split-on-sentence-end"
        >
          Split at sentence end
        </label>
        <input
          id="split-on-sentence-end"
          type="checkbox"
          class="h-4 w-4 accent-zeno-accent"
          :checked="settings.settings.split_on_sentence_end"
          @change="
            settings.update({
              split_on_sentence_end: ($event.target as HTMLInputElement).checked,
            })
          "
        />
      </div>

      <!-- Advanced: pause multipliers (progressive disclosure) -->
      <div class="flex flex-col gap-3 border-t border-zeno-border pt-4">
        <button
          class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zeno-muted hover:text-zeno-text"
          :aria-expanded="advancedOpen"
          aria-controls="advanced-pauses"
          @click="advancedOpen = !advancedOpen"
        >
          <span>Advanced pauses</span>
          <span class="text-zeno-muted">{{ advancedOpen ? "▾" : "▸" }}</span>
        </button>

        <div
          v-show="advancedOpen"
          id="advanced-pauses"
          class="flex flex-col gap-4"
        >
          <p class="text-xs text-zeno-muted">
            Multipliers applied to the base word duration when a block ends with
            the given punctuation.
          </p>

          <div
            v-for="field in PAUSE_FIELDS"
            :key="field.key"
            class="flex flex-col gap-1"
          >
            <label class="text-xs text-zeno-muted" :for="`pause-${field.key}`">
              {{ field.label }}: {{ settings.settings.pause_multipliers[field.key] }}x
            </label>
            <input
              :id="`pause-${field.key}`"
              type="range"
              min="1"
              max="5"
              step="0.1"
              :value="settings.settings.pause_multipliers[field.key]"
              class="accent-zeno-accent"
              @input="onPauseInput(field.key, $event)"
            />
          </div>

          <button
            class="rounded-md border border-zeno-border px-3 py-1.5 text-xs text-zeno-muted hover:text-zeno-text"
            @click="resetPauses"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
