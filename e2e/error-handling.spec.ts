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

  test("continue without resetting dismisses the dialog", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        get: () => undefined,
        configurable: false,
      });
    });

    await page.goto("/");
    await expect(page.getByTestId("recovery-dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Continue without resetting" }).click();
    await expect(page.getByTestId("recovery-dialog")).not.toBeVisible();

    // The app should still show the reading area.
    await expect(page.getByRole("region", { name: "Reading area" })).toBeVisible();
  });

  test("reading area is visible after continuing past recovery dialog", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        get: () => undefined,
        configurable: false,
      });
    });

    await page.goto("/");
    await expect(page.getByTestId("recovery-dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Continue without resetting" }).click();
    await expect(page.getByTestId("recovery-dialog")).not.toBeVisible();

    const readingArea = page.getByRole("region", { name: "Reading area" });
    await expect(readingArea).toBeVisible();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 5000 });
  });
});
