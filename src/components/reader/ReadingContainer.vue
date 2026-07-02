<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "../../stores/settings";

const settings = useSettingsStore();

// The reading word is styled from user settings now so the RSVP renderer
// (Phase 2) can drop straight into this centered container.
const wordStyle = computed(() => ({
  fontSize: `${settings.settings.font_size}px`,
  fontFamily: settings.settings.font_family,
}));
</script>

<template>
  <section
    class="flex h-full w-full items-center justify-center bg-zeno-bg px-8"
    aria-label="Reading area"
  >
    <div class="flex flex-col items-center gap-4 text-center">
      <p
        class="font-semibold tracking-wide text-zeno-text select-none"
        :style="wordStyle"
      >
        ZenoRead
      </p>
      <p class="max-w-md text-sm text-zeno-muted">
        Load a document to start reading. Playback controls and the RSVP engine
        arrive in Phase 2.
      </p>
    </div>
  </section>
</template>
