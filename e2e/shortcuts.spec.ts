import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts", () => {
  test("Space toggles play/pause", async ({ page }) => {
    await page.goto("/");

    const playBtn = page.getByRole("button", { name: "Play" });
    await expect(playBtn).toBeVisible({ timeout: 10000 });
    // Wait for the sample text to load and the controller to be ready.
    const progress = page.locator('[data-testid="progress"]');
    await expect(progress).toBeVisible({ timeout: 10000 });
    await expect(progress).toHaveText(/^¶ 1 \/ \d+ · \d+%$/);
    // Let the settings store settle (the watch on block-sizing settings can
    // reload the text and reset playback state on first load).
    await page.waitForTimeout(300);
    await expect(progress).toHaveText(/^¶ 1 \/ \d+ · \d+%$/);

    // Click on empty space to blur any focused element, then use keyboard.
    await page.locator("body").click();
    // Space starts playback → button text becomes Pause.
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveText("Pause");
    // Space pauses → button text becomes Resume (aria-label stays "Play").
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveText("Resume");
    // Space resumes → button text becomes Pause again.
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveText("Pause");
  });

  test("ArrowRight advances to the next block", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator("[data-testid=\"progress\"]");
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · 0%$/);
    await page.waitForTimeout(300);
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · 0%$/);

    // The sample text is a single paragraph, so the block advance is only
    // visible in the completion percentage.
    await page.keyboard.press("ArrowRight");
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · [1-9]\d*%$/);
  });

  test("ArrowLeft goes back to the previous block", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator("[data-testid=\"progress\"]");
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · 0%$/);
    // Wait for stores to settle (settings init may trigger a reload).
    await page.waitForTimeout(300);
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · 0%$/);
    await page.keyboard.press("ArrowRight");
    const afterFirst = await progress.textContent();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    // Back to the same block means back to the same completion percentage.
    await expect(progress).toHaveText(afterFirst!);
  });

  test("ArrowLeft at first block stays at 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator("[data-testid=\"progress\"]");
    await page.keyboard.press("ArrowLeft");
    await expect(progress).toHaveText(/^¶ \d+ \/ \d+ · 0%$/);
  });
});
