import { test, expect } from "@playwright/test";

test.describe("Error handling and recovery", () => {
  test("app loads normally when DB is healthy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open file" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("recovery-dialog")).not.toBeVisible();
  });

  test("recovery dialog appears when DB cannot be opened", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        get: () => undefined,
        configurable: false,
      });
    });

    await page.goto("/");

    await expect(page.getByTestId("recovery-dialog")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Storage problem detected")).toBeVisible();
  });
});