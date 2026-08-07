import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * For the MVP we test the web frontend served by Vite (the same UI that runs
 * inside the Tauri WebView). Driving the packaged Tauri binary via WebDriver
 * can be layered on later without changing the specs.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
