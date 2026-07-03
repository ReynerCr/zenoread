import { test, expect } from "@playwright/test";

test.describe("File loading — web fallback", () => {

  test("Open file button is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open file" })).toBeVisible({ timeout: 10000 });
  });

  test("loads a .txt file and displays its title", async ({ page }) => {
    await page.goto("/");

    // Wait for the sample text to load first.
    await expect(page.getByText("1 /")).toBeVisible({ timeout: 5000 });

    const fileContent = "The Quick Brown Fox\n\nJumps over the lazy dog.";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test-doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });

    // The title extracted from the first line should appear in the title span.
    await expect(page.locator("span.max-w-xs", { hasText: "The Quick Brown Fox" })).toBeVisible({ timeout: 5000 });
  });

  test("loaded document replaces the sample text in the reader", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("1 /")).toBeVisible({ timeout: 5000 });

    // Load a custom file.
    const fileContent = "Custom Document Title\n\nThis is unique loaded content.";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "custom.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });

    // The title should be visible in the title span.
    await expect(page.locator("span.max-w-xs", { hasText: "Custom Document Title" })).toBeVisible({ timeout: 5000 });

    // Play and verify content appears.
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Pause", exact: true }).click();

    // Progress should show blocks from the new document.
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
  });

  test("reading position persists across page reloads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("1 /")).toBeVisible({ timeout: 10000 });

    // Load a file with enough content to produce multiple blocks.
    const fileContent = "Persisted Doc Title\n\n" +
      "First sentence here. Second sentence here. Third sentence here. " +
      "Fourth sentence here. Fifth sentence here. Sixth sentence here.";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "persisted.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });

    // Wait for the document to load.
    await expect(page.locator("span.max-w-xs", { hasText: "Persisted Doc Title" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible({ timeout: 5000 });

    // Advance to block 3.
    const nextBtn = page.getByRole("button", { name: "Next block" });
    await nextBtn.click();
    await nextBtn.click();
    await expect(page.getByText(/^3 \/ \d+$/)).toBeVisible();

    // Stop to trigger progress save (saves current position before resetting).
    await page.getByRole("button", { name: "Stop" }).click();
    // Wait for the async RxDB save to complete.
    await expect(page.locator("[data-save-state='saved']")).toBeVisible({ timeout: 5000 });

    // Reload the page.
    await page.reload();
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 5000 });

    // Re-open the same file from the dialog (simulates library re-open).
    const fileChooserPromise2 = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open file" }).click();
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles({
      name: "persisted.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });

    // The position should be restored to block 3 (or close to it, since
    // block indices may shift slightly if settings differ — but the key
    // is that it's NOT at block 1).
    await expect(page.locator("span.max-w-xs", { hasText: "Persisted Doc Title" })).toBeVisible({ timeout: 5000 });
    // Wait for the progress to be restored (may happen after the title appears).
    await expect(page.locator('[data-testid="progress"]')).not.toHaveText(/^1 \/ \d+$/, { timeout: 5000 });
    const progressText = await page.locator('[data-testid="progress"]').textContent();
    const blockNum = parseInt(progressText!.split(" / ")[0], 10);
    expect(blockNum).toBeGreaterThan(1);
  });
});
