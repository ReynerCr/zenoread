import { createI18n } from "vue-i18n";

import en from "./en.json";
import es from "./es.json";

export type AppLocale = "en" | "es";
/** Shape of the source-of-truth catalog; keys are validated against it. */
export type MessageSchema = typeof en;

const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  // First-run users render in their OS language immediately; settings.init()
  // overrides with the saved preference once the settings doc loads.
  locale: detectLanguage(),
  fallbackLocale: "en",
  messages: { en, es },
});

export { i18n };

/**
 * Typed wrapper around `i18n.global.t` for non-component modules (stores,
 * error utils, loaders). The catalogs are flat dotted keys, so `keyof
 * MessageSchema` is the full key list.
 */
export function t(key: keyof MessageSchema, named?: Record<string, unknown>): string {
  return named === undefined ? i18n.global.t(key) : i18n.global.t(key, named);
}

/** Maps the browser/webview locale to the supported UI languages. */
export function detectLanguage(): AppLocale {
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}