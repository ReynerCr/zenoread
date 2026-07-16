<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentsStore } from "../../stores/documents";
import { useProgressStore } from "../../stores/progress";
import { resetDatabase } from "../../db/database";
import {
  DEFAULT_PAUSE_MULTIPLIERS,
  DEFAULT_USER_SETTINGS,
  type PauseMultipliers,
} from "../../db/schemas/userSettings.schema";
import SliderInput from "../ui/SliderInput.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settings = useSettingsStore();
const documentsStore = useDocumentsStore();
const progressStore = useProgressStore();
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

function onWpmChange(value: number) {
  void settings.update({ wpm_default: value });
}

function onMaxWordsChange(value: number) {
  void settings.update({ max_words_screen: value });
}

function onFontSizeChange(value: number) {
  void settings.update({ font_size: value });
}

function onPauseChange(key: keyof PauseMultipliers, value: number) {
  void settings.update({
    pause_multipliers: { ...settings.settings.pause_multipliers, [key]: value },
  });
}

function resetPauses() {
  void settings.update({
    pause_multipliers: { ...DEFAULT_PAUSE_MULTIPLIERS },
  });
}

function resetAllSettings() {
  if (!confirm("Reset all settings to their defaults?")) return;
  const { id, ...defaults } = DEFAULT_USER_SETTINGS;
  void id;
  void settings.update(defaults);
}

async function resetAppData() {
  if (!confirm("Delete ALL app data (settings, documents, progress)? This cannot be undone.")) return;
  await resetDatabase();
  documentsStore.clearAll();
  documentsStore.setCurrent(null);
  progressStore.clearProgress();
  // Reload to ensure all stores re-initialize from the fresh database.
  window.location.reload();
}
</script>

<template>
  <aside
    class="flex h-full flex-col border-l border-zeno-border bg-zeno-surface transition-all duration-200 overflow-hidden"
    :class="open ? 'w-72' : 'w-0'"
    aria-label="Settings"
    :data-settings-loaded="settings.loaded"
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

      <SliderInput
        label="Reading speed"
        :min="100"
        :max="1000"
        :step="10"
        :model-value="settings.settings.wpm_default"
        unit="WPM"
        @update:model-value="onWpmChange"
      />

      <SliderInput
        label="Words per screen"
        :min="1"
        :max="15"
        :step="1"
        :model-value="settings.settings.max_words_screen"
        @update:model-value="onMaxWordsChange"
      />

      <SliderInput
        label="Font size"
        :min="16"
        :max="120"
        :step="2"
        :model-value="settings.settings.font_size"
        unit="px"
        @update:model-value="onFontSizeChange"
      />

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

      <div class="flex items-center justify-between">
        <label
          class="text-xs font-medium text-zeno-muted"
          for="show-block-counter"
        >
          Show block counter
        </label>
        <input
          id="show-block-counter"
          type="checkbox"
          class="h-4 w-4 accent-zeno-accent"
          :checked="settings.settings.show_block_counter"
          @change="
            settings.update({
              show_block_counter: ($event.target as HTMLInputElement).checked,
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

          <SliderInput
            v-for="field in PAUSE_FIELDS"
            :key="field.key"
            :label="field.label"
            :min="1"
            :max="5"
            :step="0.1"
            :model-value="settings.settings.pause_multipliers[field.key]"
            unit="x"
            @update:model-value="(v: number) => onPauseChange(field.key, v)"
          />

          <button
            class="rounded-md border border-zeno-border px-3 py-1.5 text-xs text-zeno-muted hover:text-zeno-text"
            @click="resetPauses"
          >
            Reset pauses to defaults
          </button>
        </div>
      </div>

      <!-- Danger zone: reset settings + reset app data -->
      <div class="flex flex-col gap-2 border-t border-zeno-border pt-4">
        <button
          class="rounded-md border border-zeno-border px-3 py-1.5 text-xs text-zeno-muted hover:text-zeno-text"
          @click="resetAllSettings"
        >
          Reset all settings
        </button>
        <button
          class="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
          @click="resetAppData"
        >
          Delete all app data
        </button>
      </div>
    </div>
  </aside>
</template>
