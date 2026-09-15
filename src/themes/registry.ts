import { isTauri } from "../utils/platform";
import { reportError } from "../utils/errors";
import { t } from "../i18n";

export interface ThemeDefinition {
  id: string;
  displayName: string; // fallback if i18n key absent
  i18nKey?: string;
  colorScheme: "light" | "dark";
  colors: ThemeColors;
}

export interface ThemeColors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
}

const BUILTIN_THEME_COLORS: Record<string, ThemeColors> = {
  dark: { bg: "#0c0a09", surface: "#1c1917", border: "#292524", text: "#f5f5f4", muted: "#a9a39f", accent: "#faa517" },
  light: { bg: "#f5f5f4", surface: "#ffffff", border: "#e7e5e4", text: "#1c1917", muted: "#57524e", accent: "#faa517" },
  night: { bg: "#000000", surface: "#181818", border: "#2b2b2b", text: "#e1e1e1", muted: "#a0a0a0", accent: "#faa517" },
  parchment: { bg: "#f4ede4", surface: "#faf6f0", border: "#e0d5c7", text: "#3d3428", muted: "#564e43", accent: "#c47d3a" },
  zr_dark: { bg: "#0a0b0c", surface: "#151c2c", border: "#263047", text: "#f5f5f4", muted: "#b3aca8", accent: "#faa517" },
  zr_dark_contrast: { bg: "#0d1117", surface: "#161b22", border: "#30363d", text: "#f0f6fc", muted: "#9da7b2", accent: "#faa517" },
  zr_light: { bg: "#ededf5", surface: "#f1f1f5", border: "#d3d0e8", text: "#0a0b0c", muted: "#0e2033", accent: "#faa517" },
  zr_light_warm: { bg: "#faf5ee", surface: "#ffffff", border: "#e8ddd0", text: "#1a1520", muted: "#59524c", accent: "#faa517" }
};

export const BUILTIN_THEMES: ThemeDefinition[] = [
  { id: "dark", displayName: "Dark", i18nKey: "settings.theme.dark", colorScheme: "dark", colors: BUILTIN_THEME_COLORS.dark },
  { id: "light", displayName: "Light", i18nKey: "settings.theme.light", colorScheme: "light", colors: BUILTIN_THEME_COLORS.light },
  { id: "night", displayName: "Night", i18nKey: "settings.theme.night", colorScheme: "dark", colors: BUILTIN_THEME_COLORS.night},
  { id: "parchment", displayName: "Parchment", i18nKey: "settings.theme.parchment", colorScheme: "light", colors: BUILTIN_THEME_COLORS.parchment },
  { id: "zr-dark", displayName: "Zeno Dark", i18nKey: "settings.theme.zr-dark", colorScheme: "dark", colors: BUILTIN_THEME_COLORS.zr_dark },
  { id: "zr-dark-contrast", displayName: "Zeno Dark High Contrast", i18nKey: "settings.theme.zr-dark-contrast", colorScheme: "dark", colors: BUILTIN_THEME_COLORS.zr_dark_contrast },
  { id: "zr-light", displayName: "Zeno Light", colorScheme: "light", i18nKey: "settings.theme.zr-light", colors: BUILTIN_THEME_COLORS.zr_light },
  { id: "zr-light-warm", displayName: "Zeno Light Warm", colorScheme: "light", i18nKey: "settings.theme.zr-light-warm", colors: BUILTIN_THEME_COLORS.zr_light_warm }
];

const BUILTIN_IDS = new Set(BUILTIN_THEMES.map((t) => t.id));

/** 
 * Starts with built-in themes, extends with user-themes.json in AppData 
 * (if present) on init.
 */
const allThemes: ThemeDefinition[] = [...BUILTIN_THEMES];

export type ThemeName = string;

/** Look up a theme by id. Returns undefined if not found. */
export function getTheme(id: string): ThemeDefinition | undefined {
  return allThemes.find((t) => t.id === id);
}

/** Returns all available themes (built-in + user). */
export function getAllThemes(): readonly ThemeDefinition[] {
  return allThemes;
}

const COLOR_VARS: (keyof ThemeColors)[] = ["bg", "surface", "border", "text", "muted", "accent"];

function isValidColorValue(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function validateUserTheme(entry: unknown): entry is ThemeDefinition {
  if (!entry || typeof entry !== "object") return false;
  const obj = entry as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) return false;
  if (typeof obj.displayName !== "string" || !obj.displayName) return false;
  if (obj.i18nKey !== undefined && typeof obj.i18nKey !== "string") return false;
  if (obj.colorScheme !== "light" && obj.colorScheme !== "dark") return false;
  if (!obj.colors || typeof obj.colors !== "object") return false;
  const colors = obj.colors as Record<string, unknown>;
  return COLOR_VARS.every((k) => isValidColorValue(colors[k]));
}

function injectThemeCSS(theme: ThemeDefinition): void {
  const style = document.createElement("style");
  style.dataset.themeId = theme.id;
  style.textContent = `
    [data-theme="${theme.id}"] {
      --zeno-bg: ${theme.colors.bg};
      --zeno-surface: ${theme.colors.surface};
      --zeno-border: ${theme.colors.border};
      --zeno-text: ${theme.colors.text};
      --zeno-muted: ${theme.colors.muted};
      --zeno-accent: ${theme.colors.accent};
    }
  `;
  document.head.appendChild(style);
}

/** Inject CSS for all built-in themes. Called once on startup. */
export function initBuiltinThemes(): void {
  for (const theme of BUILTIN_THEMES) {
    injectThemeCSS(theme);
  }
}

/**
 * Loads user-defined themes from disk (Tauri only). Must be called before
 * the settings store applies the active theme. Silently skips on web or
 * when the file doesn't exist.
 */
export async function initUserThemes(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { exists, readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");

    const filePath = "user-themes.json";
    if (!await exists(filePath, { baseDir: BaseDirectory.AppData })) return;
    
    const raw = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      reportError(new Error("user-themes.json must be a JSON array"), t("errors.themes.load"), { context: "initUserThemes" });
      return;
    }

    for (const entry of parsed) {
      if (!validateUserTheme(entry)) {
        reportError(new Error("Invalid user theme entry skipped"), t("errors.themes.invalid"), { context: "initUserThemes" });
        continue;
      }

      const theme = entry as ThemeDefinition;

      if (BUILTIN_IDS.has(theme.id)) {
        reportError(new Error(`User theme "${theme.id}" skipped: conflicts with built-in theme`), t("errors.themes.conflict"), { context: "initUserThemes" });
        continue;
      }

      // Prevent duplicate user theme IDs (last one wins).
      const existingIdx = allThemes.findIndex((t) => t.id === theme.id);
      if (existingIdx !== -1) {
        allThemes.splice(existingIdx, 1);
      }

      injectThemeCSS(theme);
      allThemes.push(theme);
    }
  } catch (error) {
    // Non-fatal: app works with built-in themes only.
    reportError(error, t("errors.themes.load"), { context: "initUserThemes" });
  }
}
