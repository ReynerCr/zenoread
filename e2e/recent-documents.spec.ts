import { test, expect } from "@playwright/test";

test.describe("Recent documents panel", () => {
  test("toggle button opens and closes the panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Toggle recent documents" })).toBeVisible({ timeout: 10000 });

    const panel = page.getByRole("complementary", { name: "Recent documents" });

    // Open it.
    await page.getByRole("button", { name: "Toggle recent documents" }).click();
    await expect(panel).toBeVisible();
    // The close button should be visible when open.
    await expect(panel.getByRole("button", { name: "Close recent documents" })).toBeVisible();

    // Close it via the ✕ button.
    await panel.getByRole("button", { name: "Close recent documents" }).click();
    // After closing, the toggle button should still be clickable to re-open.
    await page.getByRole("button", { name: "Toggle recent documents" }).click();
    await expect(panel.getByRole("button", { name: "Close recent documents" })).toBeVisible();
  });

  test("shows desktop-only message in web mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle recent documents" }).click();

    const panel = page.getByRole("complementary", { name: "Recent documents" });
    await expect(panel).toBeVisible();
    // In web mode (Playwright), the panel should show the desktop-only notice.
    await expect(panel).toContainText("only available in the desktop app");
  });

  test("panel is visible after loading a document", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("1 /")).toBeVisible({ timeout: 10000 });

    // Load a file so the documents store has at least one entry.
    const fileContent = "Recent Test Doc\n\nSome content here.";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "recent-test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });
    await expect(page.locator("span.max-w-xs", { hasText: "Recent Test Doc" })).toBeVisible({ timeout: 5000 });

    // Open the recent panel — should still show desktop-only message in web mode.
    await page.getByRole("button", { name: "Toggle recent documents" }).click();
    const panel = page.getByRole("complementary", { name: "Recent documents" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("only available in the desktop app");
  });
});
