import { onMounted, onUnmounted } from "vue";

export interface ShortcutHandlers {
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}

/**
 * Registers window-level keyboard shortcuts for RSVP playback. Only fires when
 * the document has focus (Tauri window focus), not system-global.
 *
 * - Space → toggle play/pause
 * - ArrowRight → next block
 * - ArrowLeft → previous block
 * - ArrowDown → stop (reset to first block)
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  function onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case "Space":
        event.preventDefault();
        handlers.onTogglePlayPause();
        break;
      case "ArrowRight":
        event.preventDefault();
        handlers.onNext();
        break;
      case "ArrowLeft":
        event.preventDefault();
        handlers.onPrev();
        break;
      case "ArrowDown":
        event.preventDefault();
        handlers.onStop();
        break;
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeyDown);
  });
}
