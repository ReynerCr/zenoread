/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from '@vitejs/plugin-basic-ssl'

const host = process.env.TAURI_DEV_HOST;
const isHosting = !!process.env.TAURI_DEV_HOST || process.argv.includes('--host');

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    tailwindcss(),
    isHosting ? basicSsl({name: "zenossl-test"}) : null
  ].filter(Boolean),

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Vitest configuration for unit/integration tests.
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.ts"],
    // Playwright E2E specs live under e2e/ and are excluded from Vitest.
    exclude: ["e2e/**", "node_modules/**"],
  },
}));
