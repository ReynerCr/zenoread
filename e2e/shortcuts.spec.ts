import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts", () => {
  test("Space toggles play/pause", async ({ page }) => {
    await page.goto("/");

    const playBtn = page.getByRole("button", { name: "Play" });
    await expect(playBtn).toBeVisible();

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

    const progress = page.locator(".tabular-nums");
    await expect(progress).toHaveText(/^1 \/ \d+$/);

    await page.keyboard.press("ArrowRight");
    await expect(progress).toHaveText(/^2 \/ \d+$/);
  });

  test("ArrowLeft goes back to the previous block", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator(".tabular-nums");
    await expect(progress).toHaveText(/^1 \/ \d+$/);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(progress).toHaveText(/^3 \/ \d+$/);

    await page.keyboard.press("ArrowLeft");
    await expect(progress).toHaveText(/^2 \/ \d+$/);
  });

  test("ArrowLeft at first block stays at 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator(".tabular-nums");
    await page.keyboard.press("ArrowLeft");
    await expect(progress).toHaveText(/^1 \/ \d+$/);
  });

  test("ArrowDown stops and resets to the first block", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const progress = page.locator(".tabular-nums");
    await expect(progress).toHaveText(/^1 \/ \d+$/);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(progress).toHaveText(/^3 \/ \d+$/);

    await page.keyboard.press("ArrowDown");
    await expect(progress).toHaveText(/^1 \/ \d+$/);
  });
});
