/**
 * Returns true when running inside a Tauri WebView (desktop app), false when
 * running in a plain browser (e.g. Playwright E2E or web dev mode).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
