<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    min: number;
    max: number;
    step?: number;
    modelValue: number;
    unit?: string;
  }>(),
  { step: 1, unit: "" },
);

const emit = defineEmits<{ (e: "update:modelValue", value: number): void }>();

const inputId = computed(() =>
  props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
);

function onSliderInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isNaN(value)) emit("update:modelValue", value);
}

function onNumberInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw === "") return;
  let value = Number(raw);
  if (Number.isNaN(value)) return;
  value = Math.max(props.min, Math.min(props.max, value));
  emit("update:modelValue", value);
}

function onNumberBlur(event: Event) {
  const el = event.target as HTMLInputElement;
  const raw = el.value;
  if (raw === "" || Number.isNaN(Number(raw))) {
    // Only reset if the input was cleared or is invalid.
    el.value = String(props.modelValue);
  }
}

const displayValue = computed(() => {
  const unit = props.unit ? ` ${props.unit}` : "";
  return `${props.modelValue}${unit}`;
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label
        class="text-xs font-medium text-zeno-muted"
        :for="`slider-${inputId}`"
      >
        {{ label }}: {{ displayValue }}
      </label>
      <input
        :id="`number-${inputId}`"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        class="w-16 rounded border border-zeno-border bg-zeno-bg px-1.5 py-0.5 text-xs text-zeno-text tabular-nums focus:border-zeno-accent focus:outline-none"
        @input="onNumberInput"
        @blur="onNumberBlur"
      >
    </div>
    <div class="flex items-center gap-2">
      <span class="w-6 text-right text-[10px] tabular-nums text-zeno-muted/60">{{ min }}</span>
      <input
        :id="`slider-${inputId}`"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        class="flex-1 accent-zeno-accent"
        @input="onSliderInput"
      >
      <span class="w-6 text-[10px] tabular-nums text-zeno-muted/60">{{ max }}</span>
    </div>
  </div>
</template>
