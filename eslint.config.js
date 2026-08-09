// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintPluginVue from "eslint-plugin-vue";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/*.d.ts", "**/dist", "src-tauri/**"]),
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...eslintPluginVue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { parser: typescriptEslint.parser },
    },
  },
  {
    files: ["e2e/**/*.ts", "vite.config.ts", "playwright.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
]);
