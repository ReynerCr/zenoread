/**
 * Returns true when running inside a Tauri WebView (desktop app), false when
 * running in a plain browser (e.g. Playwright E2E or web dev mode).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Returns true when running on an Android device (Tauri Android WebView or a
 * mobile browser).
 */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}
