<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "../../stores/settings";
import { useDocumentsStore } from "../../stores/documents";
import { resetDatabase } from "../../db/database";
import {
  DEFAULT_PAUSE_MULTIPLIERS,
  DEFAULT_USER_SETTINGS,
  type PauseMultipliers,
} from "../../db/schemas/userSettings.schema";
import SliderInput from "../ui/SliderInput.vue";
import { detectLanguage } from "../../i18n";
import { isTauri } from "../../utils/platform";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settings = useSettingsStore();
const documentsStore = useDocumentsStore();
const { t } = useI18n();
const advancedOpen = ref(false);

const PAUSE_FIELDS: { key: keyof PauseMultipliers; labelKey: string }[] = [
  { key: "period", labelKey: "settings.pause.period" },
  { key: "comma", labelKey: "settings.pause.comma" },
  { key: "semicolon", labelKey: "settings.pause.semicolon" },
  { key: "colon", labelKey: "settings.pause.colon" },
  { key: "question", labelKey: "settings.pause.question" },
  { key: "exclamation", labelKey: "settings.pause.exclamation" },
  { key: "paragraph", labelKey: "settings.pause.paragraph" },
];

const FONT_FAMILIES: { label?: string; labelKey?: string; value: string }[] = [
  { labelKey: "settings.fontFamily.system", value: "system-ui" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Arial", value: "Arial" },
  { label: "Verdana", value: "Verdana" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
  { label: "Courier New", value: "Courier New" },
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

function onFontFamilyChange(value: string) {
  void settings.update({ font_family: value });
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

function confirmDialog(message: string): Promise<boolean> {
  if (isTauri()) {
    return tauriConfirm(message);
  }
  return Promise.resolve(window.confirm(message));
}

async function resetAllSettings() {
  if (!(await confirmDialog(t("settings.confirmResetDefaults")))) return;
  const { id, ...defaults } = DEFAULT_USER_SETTINGS;
  void id;
  void settings.update({ ...defaults, language: detectLanguage() });
}

async function resetAppData() {
  if (!(await confirmDialog(t("settings.confirmDeleteAll")))) return;
  await resetDatabase();
  documentsStore.clearAll();
  documentsStore.setCurrent(null);
  // Reload to ensure all stores re-initialize from the fresh database.
  window.location.reload();
}
</script>

<template>
  <aside
    class="flex h-full flex-col border-l border-zeno-border bg-zeno-surface transition-all duration-200 overflow-hidden"
    :class="open ? 'w-72' : 'w-0'"
    :aria-label="$t('settings.title')"
    :data-settings-loaded="settings.loaded"
  >
    <div class="flex w-72 flex-col gap-6 p-5">
      <header class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-zeno-muted">
          {{ $t('settings.title') }}
        </h2>
        <button
          class="rounded-md px-2 py-1 text-zeno-muted hover:text-zeno-text"
          :aria-label="$t('settings.close')"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <SliderInput
        :label="$t('settings.readingSpeed')"
        :min="100"
        :max="1000"
        :step="10"
        :model-value="settings.settings.wpm_default"
        unit="WPM"
        @update:model-value="onWpmChange"
      />

      <SliderInput
        :label="$t('settings.wordsPerScreen')"
        :min="1"
        :max="15"
        :step="1"
        :model-value="settings.settings.max_words_screen"
        @update:model-value="onMaxWordsChange"
      />

      <SliderInput
        :label="$t('settings.fontSize')"
        :min="16"
        :max="120"
        :step="2"
        :model-value="settings.settings.font_size"
        unit="px"
        @update:model-value="onFontSizeChange"
      />

      <div class="flex items-center justify-between">
        <label
          class="text-xs font-medium text-zeno-muted"
          for="font-family"
        >
          {{ $t('settings.fontFamily') }}
        </label>
        <div class="relative">
          <select
            id="font-family"
            class="appearance-none rounded-md border border-zeno-border bg-zeno-bg py-1 pl-2 pr-6 text-sm text-zeno-text"
            :value="settings.settings.font_family"
            @change="onFontFamilyChange(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="f in FONT_FAMILIES"
              :key="f.value"
              :value="f.value"
              :style="{ fontFamily: f.value }"
            >
              {{ f.labelKey ? $t(f.labelKey) : f.label }}
            </option>
          </select>
          <span
            class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zeno-muted"
          >
            ▾
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zeno-muted">{{ $t('settings.theme') }}</span>
        <button
          class="rounded-md border border-zeno-border px-3 py-1 text-sm text-zeno-text hover:bg-zeno-bg"
          @click="settings.toggleTheme()"
        >
          {{ settings.theme === "dark" ? $t('settings.theme.dark') : $t('settings.theme.light') }}
        </button>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zeno-muted">{{ $t('settings.language') }}</span>
        <button
          class="rounded-md border border-zeno-border px-3 py-1 text-sm text-zeno-text hover:bg-zeno-bg"
          @click="settings.update({ language: settings.settings.language === 'en' ? 'es' : 'en' })"
        >
          {{ settings.settings.language === "en" ? $t('settings.language.en') : $t('settings.language.es') }}
        </button>
      </div>

      <div class="flex items-center justify-between">
        <label
          class="text-xs font-medium text-zeno-muted"
          for="split-on-sentence-end"
        >
          {{ $t('settings.splitSentenceEnd') }}
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
        >
      </div>

      <div class="flex items-center justify-between">
        <label
          class="text-xs font-medium text-zeno-muted"
          for="show-block-counter"
        >
          {{ $t('settings.showBlockCounter') }}
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
        >
      </div>

      <!-- Advanced: pause multipliers (progressive disclosure) -->
      <div class="flex flex-col gap-3 border-t border-zeno-border pt-4">
        <button
          class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zeno-muted hover:text-zeno-text"
          :aria-expanded="advancedOpen"
          aria-controls="advanced-pauses"
          @click="advancedOpen = !advancedOpen"
        >
          <span>{{ $t('settings.advancedPauses') }}</span>
          <span class="text-zeno-muted">{{ advancedOpen ? "▾" : "▸" }}</span>
        </button>

        <div
          v-show="advancedOpen"
          id="advanced-pauses"
          class="flex flex-col gap-4"
        >
          <p class="text-xs text-zeno-muted">
            {{ $t('settings.pauseMultipliers.help') }}
          </p>

          <SliderInput
            v-for="field in PAUSE_FIELDS"
            :key="field.key"
            :label="$t(field.labelKey)"
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
            {{ $t('settings.resetPauses') }}
          </button>
        </div>
      </div>

      <!-- Danger zone: reset settings + reset app data -->
      <div class="flex flex-col gap-2 border-t border-zeno-border pt-4">
        <button
          class="rounded-md border border-zeno-border px-3 py-1.5 text-xs text-zeno-muted hover:text-zeno-text"
          @click="resetAllSettings"
        >
          {{ $t('settings.resetAllSettings') }}
        </button>
        <button
          class="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
          @click="resetAppData"
        >
          {{ $t('settings.deleteAllData') }}
        </button>
      </div>
    </div>
  </aside>
</template>
